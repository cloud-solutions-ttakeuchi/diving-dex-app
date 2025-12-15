import json
import os
import time
import math
import google.generativeai as genai
from typing import List, Dict

# 設定
# 設定
# API Key Handling
API_KEYS = os.environ.get("GOOGLE_API_KEY", "").split(",")
if not API_KEYS or not API_KEYS[0]:
    raise ValueError("GOOGLE_API_KEY environment variable is not set.")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG_DIR = os.path.join(BASE_DIR, "scripts/config")
DATA_DIR = os.path.join(BASE_DIR, "src/data")
CREATURES_FILE = os.path.join(DATA_DIR, "creatures_seed.json")
TARGET_REGIONS_FILE = os.path.join(CONFIG_DIR, "target_regions.json")
BATCH_SIZE = 10

def get_target_regions() -> List[str]:
    if not os.path.exists(TARGET_REGIONS_FILE):
        return ["沖縄", "パラオ", "フィリピン", "インドネシア", "モルディブ", "伊豆", "小笠原"]
    with open(TARGET_REGIONS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

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

def map_regions_batch(creatures: List[Dict], region_list: List[str]) -> List[Dict]:
    """Geminiにバッチで生息域を判定させる"""

    names = [c["name"] for c in creatures]

    prompt = f"""
    生物リスト: {json.dumps(names, ensure_ascii=False)}

    上記の各海洋生物について、以下のエリアリストのうち「実際にダイビングで見られる・生息しているエリア」を選んでください。

    エリア候補: {json.dumps(region_list, ensure_ascii=False)}

    条件:
    1. 出力は以下のJSON形式 (Array of Objects) のみにしてください。
    2. 生息しているかわからない場合は空配列にしてください。

    Example Output:
    [
      {{"name": "カクレクマノミ", "regions": ["沖縄", "フィリピン", "バリ", "パラオ"]}},
      {{"name": "ダンゴウオ", "regions": ["伊豆", "東北"]}}
    ]
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
            if text.startswith("```json"): text = text[7:]
            if text.startswith("```"): text = text[3:]
            if text.endswith("```"): text = text[:-3]

            result = json.loads(text)

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

import argparse
import shutil
# ... (imports remain)
import json
import os
import time
import math
import google.generativeai as genai
from typing import List, Dict

# ... (imports/constants up to main)

def main():
    parser = argparse.ArgumentParser(description="Map creatures to regions.")
    parser.add_argument("--mode", choices=["append", "overwrite", "clean"], default="append",
                        help="Mode: append (skip existing), overwrite (re-map all), clean (reset all regions first).")
    args = parser.parse_args()

    if not os.path.exists(CREATURES_FILE):
        print("❌ Creatures file not found.")
        return

    print("Loading data...")
    with open(CREATURES_FILE, 'r', encoding='utf-8') as f:
        creatures = json.load(f)

    # Clean mode logic: Reset existing regions
    if args.mode == "clean":
        print("🧹 Clean mode: Clearing all existing region mappings.")
        for c in creatures:
            c["regions"] = []
        # Essentially behaves like overwrite from here, but starting empty

    target_regions = get_target_regions()
    print(f"Target Regions: {target_regions[:10]}...")
    print(f"Mapping regions for {len(creatures)} creatures. Mode: {args.mode}")

    updated_count = 0
    num_batches = math.ceil(len(creatures) / BATCH_SIZE)

    for i in range(num_batches):
        batch_slice = creatures[i*BATCH_SIZE : (i+1)*BATCH_SIZE]

        # Target Selection Logic based on Mode
        if args.mode == "append":
             # Only process if regions is empty/missing
             targets = [c for c in batch_slice if not c.get("regions")]
        else: # overwrite or clean (clean is already cleared above, so same logic)
             targets = batch_slice # Process ALL

        if not targets:
            print(f"Skipping batch {i+1} (No targets for {args.mode}).")
            continue

        print(f"Processing Batch {i+1}/{num_batches} ({len(targets)} items)...")
        results = map_regions_batch(targets, target_regions)

        # 結果のマージ
        result_map = {r["name"]: r["regions"] for r in results}

        for c in targets:
            if c["name"] in result_map:
                c["regions"] = result_map[c["name"]]
                updated_count += 1

        time.sleep(2)

    # 保存
    with open(CREATURES_FILE, 'w', encoding='utf-8') as f:
        json.dump(creatures, f, indent=2, ensure_ascii=False)

    print(f"✅ Done! Updated regions for {updated_count} creatures.")

if __name__ == "__main__":
    main()
