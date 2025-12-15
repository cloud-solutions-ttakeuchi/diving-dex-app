import json
import os
import time
import math
import google.generativeai as genai
from typing import List, Dict, Optional
import argparse

# Configuration
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "src/data")
PREPARE_FILE = os.path.join(DATA_DIR, "creatures_prepare.json")

# Load Env
if "GOOGLE_API_KEY" not in os.environ:
    env_path = os.path.join(BASE_DIR, "scripts/config/env.ini")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith("GOOGLE_API_KEY="):
                        key_val = line.strip().split("=", 1)[1]
                        # Remove potential surrounding quotes
                        key_val = key_val.strip('"').strip("'")
                        os.environ["GOOGLE_API_KEY"] = key_val
                        break
        except Exception as e:
            print(f"⚠️ Failed to read env.ini: {e}")

API_KEYS = os.environ.get("GOOGLE_API_KEY", "").split(",")
if not API_KEYS or not API_KEYS[0]:
    print("❌ GOOGLE_API_KEY not found in env or env.ini")
    # Don't raise error immediately to allow user to see message, but returns below will handle it
    # allow falling through to validation check
    pass
else:
    # Clean keys
    API_KEYS = [k.strip() for k in API_KEYS if k.strip()]

if not API_KEYS:
     raise ValueError("GOOGLE_API_KEY environment variable is not set or empty.")

BATCH_SIZE = 10

# --- API Handling Class (Shared Logic) ---
class APIResource:
    def __init__(self, api_key: str, model_name: str, priority: int):
        self.api_key = api_key
        self.model_name = model_name
        self.priority = priority
        self.status = 'stand-by'
        self.quota_exceed_dt = 0.0

RESOURCE_POOL: List[APIResource] = []
# Priority: Flash > Lite
for key in API_KEYS:
    if not key: continue
    RESOURCE_POOL.append(APIResource(key, 'gemini-2.5-flash', 1))

for key in API_KEYS:
    if not key: continue
    RESOURCE_POOL.append(APIResource(key, 'gemini-2.5-flash-lite', 2))

def get_best_resource() -> Optional[APIResource]:
    current_time = time.time()
    # Check for release
    for r in RESOURCE_POOL:
        if r.status == 'stop':
            if current_time - r.quota_exceed_dt > 65:
                r.status = 'stand-by'
                r.quota_exceed_dt = 0.0

    # Select best
    candidates = [r for r in RESOURCE_POOL if r.status == 'stand-by']
    if candidates:
        candidates.sort(key=lambda x: x.priority)
        best = candidates[0]
        best.status = 'active'
        return best
    return None

def generate_attributes_batch(creatures: List[Dict]) -> List[Dict]:
    """Gemini to generate missing attributes"""

    # Minimal info for prompt
    items = [{"name": c["name"], "scientificName": c.get("scientificName", "")} for c in creatures]

    prompt = f"""
    You are a marine biologist database expert.
    Generate the missing biological data for the following {len(items)} marine creatures.

    Creatures List: {json.dumps(items, ensure_ascii=False)}

    Output Requirement:
    Return a valid JSON Array of Objects. Each object must strictly follow this schema:
    {{
        "name": "Creature Name (match input)",
        "category": "Classification (魚類, ウミウシ, 甲殻類, サメ, その他)",
        "tags": ["Tag1", "Tag2", ... (3-5 tags e.g. 色, 特徴, 生態)],
        "baseRarity": "Common" | "Rare" | "Epic" | "Legendary",
        "stats": {{
            "rarity": Integer (1-100, higher is rarer),
            "popularity": Integer (1-100),
            "danger": Integer (1-100),
            "lifespan": Integer (years, approx),
            "speed": Integer (1-100),
            "size": Integer (max size in cm)
        }},
        "depthRange": {{ "min": Integer (m), "max": Integer (m) }},
        "waterTempRange": {{ "min": Integer (C), "max": Integer (C) }},
        "specialAttributes": ["Attr1", ... (e.g. 擬態, 被写体, 美しい, 危険)],
        "size": "String representation (e.g. '30cm')"
    }}

    * Ensure numerical values are reasonable estimates based on the species.
    * 'waterTempRange' typically 20-30 for tropical, but vary if deep/cold water.
    * Use specific Japanese terms for tags and specialAttributes.
    * Return ONLY the JSON Array.
    """

    while True:
        resource = get_best_resource()

        if not resource:
            # Handle exhaustion
            stopped = [r for r in RESOURCE_POOL if r.status == 'stop']
            if not stopped:
                print("    ❌ All resources invalid. Aborting.")
                return []

            earliest = min(r.quota_exceed_dt for r in stopped) + 65
            wait = earliest - time.time()
            if wait > 0:
                print(f"    ⏳ Waiting {wait:.1f}s for API release...")
                time.sleep(wait + 1)
                continue
            else:
                time.sleep(1)
                continue

        try:
            genai.configure(api_key=resource.api_key)
            model = genai.GenerativeModel(resource.model_name)
            response = model.generate_content(prompt)

            text = response.text.strip()
            # Clean Markdown
            if text.startswith("```json"): text = text[7:]
            if text.startswith("```"): text = text[3:]
            if text.endswith("```"): text = text[:-3]

            try:
                result = json.loads(text)
            except json.JSONDecodeError:
                # Basic fix for truncation
                if text.strip().endswith("}"): text += "]"
                result = json.loads(text)

            resource.status = 'stand-by'
            # Display Success
            key_idx = API_KEYS.index(resource.api_key) + 1
            print(f"    ✅ Generated data for {len(result)} items using {resource.model_name} (Key #{key_idx})")

            time.sleep(2) # Lite cooldown
            return result

        except Exception as e:
            if "429" in str(e):
                print(f"    ⚠️ Quota Exceeded (429): {resource.model_name}")
                resource.status = 'stop'
                resource.quota_exceed_dt = time.time()
            else:
                print(f"    ❌ Error: {e}")
                resource.status = 'stand-by'
                time.sleep(1)

def main():
    print("🚀 Starting Data Filling for PREPARE file...")

    if not os.path.exists(PREPARE_FILE):
        print(f"❌ File not found: {PREPARE_FILE}")
        return

    with open(PREPARE_FILE, 'r', encoding='utf-8') as f:
        creatures = json.load(f)

    print(f"🔍 Processing {len(creatures)} creatures.")

    # We process ALL items in prepare file as they are by definition missing data
    targets = creatures

    num_batches = math.ceil(len(targets) / BATCH_SIZE)
    updated_count = 0

    for i in range(num_batches):
        batch = targets[i*BATCH_SIZE : (i+1)*BATCH_SIZE]
        print(f"Processing Batch {i+1}/{num_batches} ({len(batch)} items)...")

        # Identify which ones actually need update (double check)
        # But split logic already ensures this.

        generated_data = generate_attributes_batch(batch)

        if not generated_data:
            print("    ⚠️ Empty result for batch.")
            continue

        # Merge
        gen_map = {item["name"]: item for item in generated_data}

        for c in batch:
            if c["name"] in gen_map:
                gen = gen_map[c["name"]]
                # Update missing fields
                for k, v in gen.items():
                    # Upsert keys
                    c[k] = v
                updated_count += 1

        # Save per batch (Robustness)
        with open(PREPARE_FILE, 'w', encoding='utf-8') as f:
            json.dump(creatures, f, indent=2, ensure_ascii=False)

    print(f"✅ Completed! Updated {updated_count} creatures.")

if __name__ == "__main__":
    main()
