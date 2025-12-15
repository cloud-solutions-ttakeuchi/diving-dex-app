import os
import json
import time
import hashlib
import google.generativeai as genai
import argparse
import shutil
from typing import List, Dict

# --- 設定 ---
# API Key
API_KEYS = os.environ.get("GOOGLE_API_KEY", "").split(",")
if not API_KEYS or not API_KEYS[0]:
    raise ValueError("GOOGLE_API_KEY environment variable is not set.")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG_DIR = os.path.join(BASE_DIR, "scripts/config")
DATA_DIR = os.path.join(BASE_DIR, "src/data")
INPUT_FILE = os.path.join(CONFIG_DIR, "target_zones.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "locations_seed.json")
PRODUCED_AREAS_FILE = os.path.join(CONFIG_DIR, "target_areas.json")

# --- Class Definitions for Robust API Handling ---

class APIResource:
    def __init__(self, api_key: str, model_name: str, priority: int):
        self.api_key = api_key
        self.model_name = model_name
        self.priority = priority
        self.status = 'stand-by' # 'stand-by' | 'active' | 'stop'
        self.quota_exceed_dt = 0.0

RESOURCE_POOL: List[APIResource] = []

# Initialize Pool
# Priority: Flash > Flash-Lite
for key in API_KEYS:
    if not key: continue
    RESOURCE_POOL.append(APIResource(key, 'gemini-2.5-flash', 1))

for key in API_KEYS:
    if not key: continue
    RESOURCE_POOL.append(APIResource(key, 'gemini-2.5-flash-lite', 2))

def get_best_resource() -> APIResource:
    """Design: Priority & Status based selection"""
    current_time = time.time()

    # 1. Check for release from 'stop' state
    for r in RESOURCE_POOL:
        if r.status == 'stop':
            if current_time - r.quota_exceed_dt > 65:
                r.status = 'stand-by'
                r.quota_exceed_dt = 0.0

    # 2. Select 'stand-by' with highest priority
    candidates = [r for r in RESOURCE_POOL if r.status == 'stand-by']
    if candidates:
        candidates.sort(key=lambda x: x.priority)
        best = candidates[0]
        best.status = 'active'
        return best

    return None

def generate_areas(region: str, zone: str) -> List[Dict]:
    prompt = f"""
    あなたはダイビング旅行プランナーです。
    指定された「Zone（エリア・地方）」にある、具体的な「Area（地名・集落名）」をリストアップしてください。

    Region: {region}
    Zone: {zone}

    出力フォーマット（JSON）:
    [
      {{
        "name": "Area名（例: 石垣市街, 川平, 北部）",
        "description": "そのエリアの特徴を100文字以内で",
        "id": "一意なID（英数字）"
      }}
    ]

    注意点:
    - 具体的で実在する地名、ダイビングショップが集まるエリアなどを3〜5個程度。
    - 決してMarkdownのコードブロック(```json ... ```)を含めないでください。純粋なJSON文字列のみを返してください。
    """

    while True:
        resource = get_best_resource()

        if not resource:
            stopped_resources = [r for r in RESOURCE_POOL if r.status == 'stop']
            if not stopped_resources:
                print("    ❌ All resources invalid/stopped but no timer set. Aborting.")
                return []

            earliest_release = min(r.quota_exceed_dt for r in stopped_resources) + 65
            wait_seconds = earliest_release - time.time()

            if wait_seconds > 0:
                print(f"    ⏳ All resources exhausted. Waiting {wait_seconds:.1f}s for rate limit release...")
                time.sleep(wait_seconds + 1)
                continue
            else:
                time.sleep(1)
                continue

        try:
            # Execute Request
            genai.configure(api_key=resource.api_key)
            model = genai.GenerativeModel(resource.model_name)

            response = model.generate_content(prompt)
            text = response.text.strip()
            # Remove markdown if present
            if text.startswith("```json"):
                text = text[7:]
            if text.endswith("```"):
                text = text[:-3]

            result = json.loads(text)
            if result:
                # Success
                key_display_idx = API_KEYS.index(resource.api_key) + 1
                print(f"    ✅ Success with {resource.model_name} (Key #{key_display_idx})")

                resource.status = 'stand-by'

                # 🛑 RATE LIMIT HANDLING: Wait 5 seconds after success
                time.sleep(5)
                return result

        except Exception as e:
            error_str = str(e)
            if "429" in error_str:
                print(f"    ⚠️ Quota exceeded (429): {resource.model_name} (Key ends {resource.api_key[-4:]})")
                resource.status = 'stop'
                resource.quota_exceed_dt = time.time()

                # PREVIOUSLY: We stopped all models with this key.
                # CHANGE: Only stop THIS specific model/key combo to allow fallback to Lite.
                # for r in RESOURCE_POOL:
                #    if r.api_key == resource.api_key:
                #        r.status = 'stop'
                #        r.quota_exceed_dt = time.time()

            elif "404" in error_str or "not found" in error_str.lower():
                print(f"    ℹ️ Model {resource.model_name} not found. Removing from pool.")
                if resource in RESOURCE_POOL:
                    RESOURCE_POOL.remove(resource)
            else:
                print(f"    ❌ Error with {resource.model_name}: {e}")
                resource.status = 'stand-by'
                time.sleep(1)

def main():
    parser = argparse.ArgumentParser(description="Generate Areas data.")
    parser.add_argument("--mode", choices=["append", "overwrite", "clean"], default="append",
                        help="Execution mode: append (skip existing), overwrite (replace existing), clean (start fresh)")
    args = parser.parse_args()

    if not os.path.exists(INPUT_FILE):
        print(f"❌ Config file not found: {INPUT_FILE}")
        return

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        target_zones = json.load(f)

    all_locations = []

    # Mode: Clean -> Backup and reset
    if args.mode == "clean":
        if os.path.exists(OUTPUT_FILE):
            shutil.copy(OUTPUT_FILE, OUTPUT_FILE + ".bak")
            print(f"📦 Backed up existing file to {OUTPUT_FILE}.bak")
        all_locations = []
    # Mode: Append / Overwrite -> Load existing
    elif os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            try:
                all_locations = json.load(f)
            except:
                pass

    produced_areas_list = []
    print(f"🚀 Generating Areas for {len(target_zones)} zones... [Mode: {args.mode.upper()}]")

    for target in target_zones:
        region_name = target["region"]
        zone_name = target["zone"]
        print(f"  Processing {region_name} > {zone_name}...")

        # Region/Zone Node検索
        region_node = next((r for r in all_locations if r["name"] == region_name), None)
        if not region_node:
            print(f"    ⚠️ Region {region_name} not found. Skipping.")
            continue

        zone_node = next((z for z in region_node.get("children", []) if z["name"] == zone_name), None)
        if not zone_node:
            print(f"    ⚠️ Zone {zone_name} not found. Skipping.")
            continue

        existing_areas = zone_node.get("children", [])

        # Mode: Append - Check if areas already exist
        if args.mode == "append" and len(existing_areas) > 0:
            print(f"    ⏭️  Skipping (Areas already exist).")
            # Next Step用に記録
            for a in existing_areas:
                produced_areas_list.append({"region": region_name, "zone": zone_name, "area": a["name"]})
            continue

        # Mode: Overwrite - Clear existing areas
        if args.mode == "overwrite" and len(existing_areas) > 0:
            print(f"    ♻️  Overwriting areas...")
            existing_areas = []

        # Generate
        new_areas = generate_areas(region_name, zone_name)

        # Merge (Overwriteの場合は空配列への追加になるので実質新規)
        existing_area_names = {a["name"] for a in existing_areas}

        for i, new_a in enumerate(new_areas):
            if new_a["name"] not in existing_area_names:
                name_hash = hashlib.md5(new_a['name'].encode()).hexdigest()[:6]
                new_a["id"] = f"a_{int(time.time())}_{name_hash}"
                existing_areas.append(new_a)
                print(f"    + Added Area: {new_a['name']}")
                produced_areas_list.append({"region": region_name, "zone": zone_name, "area": new_a["name"]})
            else:
                # 既にある場合は、既存のIDなどを維持したいか、上書きしたいか。
                # ここでは単純にスキップしつつ、NextStepリストには入れる
                print(f"    . Exists: {new_a['name']}")
                produced_areas_list.append({"region": region_name, "zone": zone_name, "area": new_a["name"]})

        zone_node["children"] = existing_areas

        # Save Main Data Incrementally
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(all_locations, f, indent=2, ensure_ascii=False)
        print(f"    💾 Progress saved to {OUTPUT_FILE}")

        time.sleep(2)

    # Save Config for Next Step (Final)
    with open(PRODUCED_AREAS_FILE, 'w', encoding='utf-8') as f:
        json.dump(produced_areas_list, f, indent=2, ensure_ascii=False)

    print(f"\n✅ All Done!")
    print(f"📝 Generated next step config: {PRODUCED_AREAS_FILE}")

if __name__ == "__main__":
    main()
