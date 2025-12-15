import os
import json
import time
import hashlib
import difflib
import google.generativeai as genai
import argparse
import shutil
from typing import List, Dict, Set

# --- 設定 ---　APIKEY　カンマ区切りで複数指定可
API_KEYS = os.environ.get("GOOGLE_API_KEY", "").split(",")
if not API_KEYS or not API_KEYS[0]:
    raise ValueError("GOOGLE_API_KEY environment variable is not set.")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG_DIR = os.path.join(BASE_DIR, "scripts/config")
DATA_DIR = os.path.join(BASE_DIR, "src/data")
INPUT_FILE = os.path.join(CONFIG_DIR, "target_areas.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "locations_seed.json")

# 重複判定の閾値
SIMILARITY_THRESHOLD = 0.85

SCHEMA_PROMPT = """
出力フォーマットは以下のJSON配列（Array of Objects）のみにしてください。
Markdownのバッククォートは不要です。

Object Schema:
[
  {
    "name": "Point Name (e.g. 青の洞窟)",
    "type": "Point",
    "level": "Beginner / Intermediate / Advanced",
    "maxDepth": int (meter),
    "entryType": "boat / beach",
    "current": "none / weak / strong / drift",
    "topography": ["cave", "dropoff", "sand", "rock" ...],
    "features": ["特徴タグ1", "特徴タグ2"],
    "latitude": float (e.g. 26.4),
    "longitude": float (e.g. 127.8),
    "description": "ポイントの魅力や特徴を100文字程度で。",
    "imageKeyword": "画像検索用英単語 (e.g. blue cave okinawa)"
  }
]
"""

def is_similar(name1: str, name2: str) -> bool:
    """文字列の類似度判定 (Levenshtein-like)"""
    matcher = difflib.SequenceMatcher(None, name1, name2)
    return matcher.ratio() >= SIMILARITY_THRESHOLD

def check_duplicate(new_point_name: str, existing_names: Set[str]) -> str:
    """重複チェック"""
    if new_point_name in existing_names: return new_point_name
    for existing in existing_names:
        if is_similar(new_point_name, existing):
            return existing
    return None

    return None

def get_existing_point_names(data: List[Dict]) -> Set[str]:
    names = set()
    for region in data:
        for zone in region.get("children", []):
            for area in zone.get("children", []):
                for point in area.get("children", []):
                    names.add(point["name"])
    return names

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
# Distribute keys: Key1-Flash(1), Key2-Flash(1), Key1-Lite(2), Key2-Lite(2)
for key in API_KEYS:
    if not key: continue
    # Primary models (Priority 1)
    RESOURCE_POOL.append(APIResource(key, 'gemini-2.5-flash', 1))

for key in API_KEYS:
    if not key: continue
    # Secondary models (Priority 2)
    RESOURCE_POOL.append(APIResource(key, 'gemini-2.5-flash-lite', 2))

def get_best_resource() -> APIResource:
    """Design: Priority & Status based selection"""
    current_time = time.time()

    # 1. Check for release from 'stop' state
    for r in RESOURCE_POOL:
        if r.status == 'stop':
            # Check if 65 seconds (safe margin) have passed since quota exceeded
            if current_time - r.quota_exceed_dt > 65:
                # Be careful: if it was a key-level limit, other models with same key might also need release?
                # For simplicity, we check individually, or we could link them.
                # User design implies model-level check or key-level.
                # Let's simple check: if time passed, set to stand-by
                r.status = 'stand-by'
                r.quota_exceed_dt = 0.0

    # 2. Select 'stand-by' with highest priority (lowest number)
    candidates = [r for r in RESOURCE_POOL if r.status == 'stand-by']
    if candidates:
        # Sort by priority
        candidates.sort(key=lambda x: x.priority)
        best = candidates[0]
        best.status = 'active'
        return best

    # 3. If no stand-by, check 'active'. (Should be empty if we are single-threaded properly,
    # but practically we return None if all are 'stop')
    # If all stopped, we need to wait.
    return None

def generate_points(region: str, zone: str, area: str) -> List[Dict]:
    prompt = f"""
    あなたはベテランのダイビングガイドです。
    指定された「Area（エリア）」にある、個別の「Point（ダイビングスポット）」をリストアップしてください。

    Region: {region}
    Zone: {zone}
    Area: {area}

    出力フォーマット（JSON）:
    [
      {{
        "name": "Point名（例: マンタスクランブル, 北の根）",
        "desc": "ポイントの特徴、見られる生物、水深、流れなどを150文字以内で",
        "latitude": 緯度(数値),
        "longitude": 経度(数値)
      }}
    ]

    注意点:
    - 具体的で実在するダイビングポイントを3〜6個程度。
    - Point名はユニークである必要があります（「北の根」などはエリア名を冠するなど区別できるように）。
    - 緯度経度は概算で構いません。
    - コードブロックは含めないでください。
    """

    # Retry loop based on pool status
    # We loop until success or absolute failure of logic

    while True:
        resource = get_best_resource()

        if not resource:
            # All resources are 'stop'.
            # Find the one that expires soonest and wait for it.
            stopped_resources = [r for r in RESOURCE_POOL if r.status == 'stop']
            if not stopped_resources:
                print("    ❌ All resources invalid/stopped but no timer set. Aborting.")
                return []

            # Find max wait needed (or min wait to get ONE resource back)
            # We want to get at least one back, so find min remaining time
            current_time = time.time()
            # rem_times = [65 - (current_time - r.quota_exceed_dt) for r in stopped_resources]
            # wait_seconds = min(rem_times)

            # Logic from user: "Check quota_exceed_dt... if no models > 65s, wait 65s (or diff)"
            # Let's find the earliest expire time
            earliest_release = min(r.quota_exceed_dt for r in stopped_resources) + 65
            wait_seconds = earliest_release - current_time

            if wait_seconds > 0:
                print(f"    ⏳ All resources exhausted. Waiting {wait_seconds:.1f}s for rate limit release...")
                time.sleep(wait_seconds + 1) # +1 buffer
                continue # Retry loop to refresh statuses
            else:
                # Should be released instantly by get_best_resource next loop
                time.sleep(1)
                continue

        try:
            # Execute Request
            # print(f"    🚀 Requesting with {resource.model_name} (Key ends {resource.api_key[-4:]})...") # Debug
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

                # Release resource to stand-by
                resource.status = 'stand-by'

                # 🛑 RATE LIMIT HANDLING: Wait 5 seconds after success
                time.sleep(5)
                return result

        except Exception as e:
            error_str = str(e)
            if "429" in error_str:
                print(f"    ⚠️ Quota exceeded (429): {resource.model_name} (Key ends {resource.api_key[-4:]})")
                # 3. Error: Set quota_exceed_dt, status='stop'
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
                # Permanently remove or stop? Let's just stop effectively forever or remove
                if resource in RESOURCE_POOL:
                    RESOURCE_POOL.remove(resource)
            else:
                print(f"    ❌ Error with {resource.model_name}: {e}")
                # Unknown error, maybe temporary? Move to stand-by to retry later or stop briefly?
                # Let's treat as 'stop' for safety but short duration?
                # Or just rotate. User logic: "Resume from standby".
                # Let's set to stand-by (give up this turn) but allow other key.
                resource.status = 'stand-by'
                # But to avoid infinite loop on same error, maybe sleep?
                time.sleep(1)

        # Loop continues to pick next 'best' resource

def main():
    parser = argparse.ArgumentParser(description="Generate Points data.")
    parser.add_argument("--mode", choices=["append", "overwrite", "clean"], default="append",
                        help="Execution mode: append (skip existing), overwrite (replace existing), clean (start fresh)")
    args = parser.parse_args()

    if not os.path.exists(INPUT_FILE):
        print(f"❌ Config file not found: {INPUT_FILE}")
        return

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        target_areas = json.load(f)

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

    # 全重複チェック用セット作成
    global_existing_points = get_existing_point_names(all_locations)
    print(f"ℹ️  Existing unique points: {len(global_existing_points)}")

    print(f"🚀 Generating Points for {len(target_areas)} areas... [Mode: {args.mode.upper()}]")

    for target in target_areas:
        region_name = target["region"]
        zone_name = target["zone"]
        area_name = target["area"]

        print(f"  Processing {region_name} > {zone_name} > {area_name}...")

        # Area Node検索
        region_node = next((r for r in all_locations if r["name"] == region_name), None)
        if not region_node: continue
        zone_node = next((z for z in region_node.get("children", []) if z["name"] == zone_name), None)
        if not zone_node: continue
        area_node = next((a for a in zone_node.get("children", []) if a["name"] == area_name), None)
        if not area_node:
            print(f"    ⚠️ Area {area_name} not found. Skipping.")
            continue

        existing_points = area_node.get("children", [])

        # Mode: Append - Skip if points exist
        if args.mode == "append" and len(existing_points) > 0:
             print(f"    ⏭️  Skipping (Points already exist).")
             continue

        # Mode: Overwrite - Clear existing points
        if args.mode == "overwrite" and len(existing_points) > 0:
             print(f"    ♻️  Overwriting points...")
             # Remove removed points from global tracker to allow recreation if names match
             for p in existing_points:
                 if p["name"] in global_existing_points:
                     global_existing_points.remove(p["name"])
             existing_points = []

        new_points = generate_points(region_name, zone_name, area_name)

        for new_p in new_points:
            sim_name = check_duplicate(new_p["name"], global_existing_points)

            if sim_name:
                print(f"    ⚠️ SKIPPING: '{new_p['name']}' (Similar to '{sim_name}')")
            else:
                # ID generation: standardized to ASCII (timestamp + hash)
                name_hash = hashlib.md5(new_p['name'].encode()).hexdigest()[:6]
                new_p["id"] = f"p_{int(time.time())}_{name_hash}"
                new_p["image"] = ""
                existing_points.append(new_p)
                global_existing_points.add(new_p["name"])
                print(f"    + Added Point: {new_p['name']}")

        area_node["children"] = existing_points

        # Save Incrementally
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(all_locations, f, indent=2, ensure_ascii=False)
        print(f"    💾 Progress saved to {OUTPUT_FILE}")

        time.sleep(2)

    print(f"\n✅ All Done!")

if __name__ == "__main__":
    main()
