import json
import os
import time
import math
import google.generativeai as genai
from typing import List, Dict
import argparse

# 設定
API_KEYS = os.environ.get("GOOGLE_API_KEY", "").split(",")
if not API_KEYS or not API_KEYS[0]:
    raise ValueError("GOOGLE_API_KEY environment variable is not set.")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "src/data")
CREATURES_FILE = os.path.join(DATA_DIR, "creatures_seed.json")
LOCATIONS_FILE = os.path.join(DATA_DIR, "locations_seed.json")
BATCH_SIZE = 10

def get_all_areas() -> List[str]:
    if not os.path.exists(LOCATIONS_FILE):
        print("❌ Locations file not found.")
        return []

    with open(LOCATIONS_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    areas = []
    for region in data:
        for zone in region.get('children', []):
            for area in zone.get('children', []):
                areas.append(area['name'])

    # Remove duplicates and sort
    return sorted(list(set(areas)))

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
                # 65s passed, try to recover
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

def map_areas_batch(creatures: List[Dict], area_list: List[str]) -> List[Dict]:
    """Geminiにバッチで生息エリアを判定させる"""

    names = [c["name"] for c in creatures]

    prompt = f"""
    生物リスト: {json.dumps(names, ensure_ascii=False)}

    上記の各海洋生物について、以下のエリアリストのうち「実際にダイビングで見られる・生息しているエリア」を選んでください。
    ※ 広い地域ではなく、具体的なダイビングエリアとして適切なものを複数選んでください。

    エリア候補リスト: {json.dumps(area_list, ensure_ascii=False)}

    条件:
    1. 出力は以下のJSON形式 (Array of Objects) のみにしてください。
    2. キーは "areas" としてください。
    3. 生息しているかわからない、またはリスト内に適切なエリアがない場合は空配列、あるいは最も近いエリアを選んでください。

    Example Output:
    [
      {{"name": "カクレクマノミ", "areas": ["石垣島・マンタスクランブル周辺", "セブ島・マクタン", "バリ島・トランベン"]}},
      {{"name": "ダンゴウオ", "areas": ["伊豆・川奈", "三浦半島・城ヶ島"]}}
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
            # Handle user potentially getting array closed issue? Unlikely if JSON.

            try:
                result = json.loads(text)
            except json.JSONDecodeError:
                # Fallback clean up
                if text.strip().endswith("}"): text += "]" # Common Gemini truncation
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

                # Decoupled stop: Only stop THIS resource, allowing fallback to Lite/Other keys

            elif "404" in error_str or "not found" in error_str.lower():
                print(f"    ℹ️ Model {resource.model_name} not found. Removing from pool.")
                if resource in RESOURCE_POOL:
                    RESOURCE_POOL.remove(resource)
            else:
                print(f"    ❌ Error with {resource.model_name}: {e}")
                resource.status = 'stand-by'
                time.sleep(1)

def main():
    parser = argparse.ArgumentParser(description="Map creatures to specific Areas.")
    parser.add_argument("--mode", choices=["append", "overwrite", "clean"], default="append",
                        help="Mode: append (skip existing), overwrite (re-map all), clean (remove areas first).")
    args = parser.parse_args()

    if not os.path.exists(CREATURES_FILE):
        print("❌ Creatures file not found.")
        return

    print("Loading creature data...")
    with open(CREATURES_FILE, 'r', encoding='utf-8') as f:
        creatures = json.load(f)

    # Clean mode
    if args.mode == "clean":
        print("🧹 Clean mode: Clearing all existing area mappings.")
        for c in creatures:
            c["areas"] = []
            # Note: We do NOT clear 'regions' here unless asked, but user wants to switch context.

    area_list = get_all_areas()
    print(f"Loaded {len(area_list)} Areas candidates from locations_seed.json.")
    if not area_list:
        print("❌ No areas found. Aborting.")
        return

    print(f"Mapping Areas for {len(creatures)} creatures. Mode: {args.mode}")

    updated_count = 0
    # Batch processing
    num_batches = math.ceil(len(creatures) / BATCH_SIZE)

    for i in range(num_batches):
        batch_slice = creatures[i*BATCH_SIZE : (i+1)*BATCH_SIZE]

        # Filter Logic
        if args.mode == "append":
             # Only process if 'areas' is missing or empty
             targets = [c for c in batch_slice if not c.get("areas")]
        else:
             targets = batch_slice

        if not targets:
            # print(f"Skipping batch {i+1} (No targets).")
            continue

        print(f"Processing Batch {i+1}/{num_batches} ({len(targets)} items)...")
        results = map_areas_batch(targets, area_list)

        if not results:
            print("    ⚠️ Batch failed or returned empty.")
            continue

        # Merge results
        result_map = {r["name"]: r.get("areas", []) for r in results if "name" in r}

        for c in targets:
            if c["name"] in result_map:
                c["areas"] = result_map[c["name"]]
                updated_count += 1

        # Intermediate save (Safety: Save every batch)
        with open(CREATURES_FILE, 'w', encoding='utf-8') as f:
            json.dump(creatures, f, indent=2, ensure_ascii=False)

        # Wait a bit? (Already done in api call)

    # Final Save
    with open(CREATURES_FILE, 'w', encoding='utf-8') as f:
        json.dump(creatures, f, indent=2, ensure_ascii=False)

    print(f"✅ Done! Updated 'areas' for {updated_count} creatures.")

if __name__ == "__main__":
    main()
