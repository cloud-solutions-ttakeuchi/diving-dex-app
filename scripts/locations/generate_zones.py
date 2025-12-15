import os
import json
import time
import hashlib
import google.generativeai as genai
from typing import List, Dict

# --- 設定 ---
# API Key Handling　　APIKEY　カンマ区切りで複数指定可
API_KEYS = os.environ.get("GOOGLE_API_KEY", "").split(",")
if not API_KEYS or not API_KEYS[0]:
    raise ValueError("GOOGLE_API_KEY environment variable is not set.")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG_DIR = os.path.join(BASE_DIR, "scripts/config")
DATA_DIR = os.path.join(BASE_DIR, "src/data")
INPUT_FILE = os.path.join(CONFIG_DIR, "target_regions.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "locations_seed.json")
PRODUCED_ZONES_FILE = os.path.join(CONFIG_DIR, "target_zones.json")

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

def generate_zones(region: str, zone: str) -> List[Dict]:
    # Note: `zone` parameter here seems redundant or misused potentially based on variable name,
    # but maintaining signature. The prompt uses 'region'.

    prompt = f"""
    あなたはダイビング旅行プランナーです。
    指定された「国・地域（Region）」にある、ダイビングで有名な「エリア（Zone）」をリストアップしてください。

    対象Region: {region}

    出力フォーマット（JSON）:
    [
      {{
        "name": "Zone名（例: ケラマ諸島, 石垣島, 本島北部）",
        "description": "そのエリアの特徴を100文字以内で",
        "id": "一意なID（英数字）"
      }}
    ]

    注意点:
    - Regionを代表する主要なダイビングエリアを3〜5個程度。
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

            elif "404" in error_str or "not found" in error_str.lower():
                print(f"    ℹ️ Model {resource.model_name} not found. Removing from pool.")
                if resource in RESOURCE_POOL:
                    RESOURCE_POOL.remove(resource)
            else:
                print(f"    ❌ Error with {resource.model_name}: {e}")
                resource.status = 'stand-by'
                time.sleep(1)

import argparse
import shutil

def main():
    parser = argparse.ArgumentParser(description="Generate Zones data.")
    parser.add_argument("--mode", choices=["append", "overwrite", "clean"], default="append",
                        help="Execution mode: append (skip existing), overwrite (replace existing), clean (start fresh)")
    args = parser.parse_args()

    if not os.path.exists(INPUT_FILE):
        print(f"❌ Config file not found: {INPUT_FILE}")
        return

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        target_regions = json.load(f)

    all_locations = []

    # Mode: Clean
    if args.mode == "clean":
        if os.path.exists(OUTPUT_FILE):
            shutil.copy(OUTPUT_FILE, OUTPUT_FILE + ".bak")
            print(f"📦 Backed up existing file to {OUTPUT_FILE}.bak")
        all_locations = []
    # Mode: Append / Overwrite
    elif os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            try:
                all_locations = json.load(f)
            except:
                pass

    produced_zones_list = []

    print(f"🚀 Generating Zones for {len(target_regions)} regions... [Mode: {args.mode.upper()}]")

    for region_name in target_regions:
        print(f"  Processing {region_name}...")

        # 既存Region検索
        existing_region = next((r for r in all_locations if r["name"] == region_name), None)

        # Mode: Append - Skip if exists
        if args.mode == "append" and existing_region:
            print(f"    ⏭️  Skipping {region_name} (Already exists).")
            # Next step用に既存Zoneをリストアップ
            for z in existing_region.get("children", []):
                produced_zones_list.append({"region": region_name, "zone": z["name"]})
            continue

        # Mode: Overwrite - Remove existing if exists to regenerate
        if args.mode == "overwrite" and existing_region:
            print(f"    ♻️  Overwriting {region_name}...")
            # 既存リストから除外して新規作成扱いに（IDなども一新される）
            all_locations = [r for r in all_locations if r["name"] != region_name]
            existing_region = None

        # Generate (Clean, Overwrite, or Append-new)
        zones_data = generate_zones(region_name)
        if not zones_data: continue

        if existing_region:
            # Merge logic (Append/Update existing region)
            existing_zones = existing_region.get("children", [])
            existing_zone_names = {z["name"] for z in existing_zones}

            for new_z in zones_data:
                if new_z["name"] not in existing_zone_names:
                    name_hash = hashlib.md5(new_z['name'].encode()).hexdigest()[:6]
                    new_z["id"] = f"z_{int(time.time())}_{name_hash}"
                    new_z["displayOrder"] = 0
                    existing_zones.append(new_z)
                    print(f"    + Added Zone: {new_z['name']}")
                else:
                    print(f"    . Exists: {new_z['name']}")

                produced_zones_list.append({"region": region_name, "zone": new_z["name"]})
            existing_region["children"] = existing_zones
        else:
            # New Region construction
            new_region_data = {
                "name": region_name,
                "description": f"{region_name}のダイビングスポット一覧", # Placeholder description
                "children": zones_data,
                "id": f"r_{int(time.time())}_{hashlib.md5(region_name.encode()).hexdigest()[:6]}"
            }

            for i, z in enumerate(new_region_data.get("children", [])):
                name_hash = hashlib.md5(z['name'].encode()).hexdigest()[:6]
                z["id"] = f"z_{int(time.time())}_{name_hash}"
                z["displayOrder"] = 0
                produced_zones_list.append({"region": region_name, "zone": z["name"]})

            all_locations.append(new_region_data)
            print(f"    + Added New Region: {region_name} with {len(zones_data)} zones.")

        # Save Incrementally
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(all_locations, f, indent=2, ensure_ascii=False)
        print(f"    💾 Progress saved to {OUTPUT_FILE}")

        time.sleep(2)

    # Save Config for Next Step (Final)
    with open(PRODUCED_ZONES_FILE, 'w', encoding='utf-8') as f:
        json.dump(produced_zones_list, f, indent=2, ensure_ascii=False)

    print(f"\n✅ All Done!")
    print(f"📝 Generated next step config: {PRODUCED_ZONES_FILE}")

if __name__ == "__main__":
    main()
