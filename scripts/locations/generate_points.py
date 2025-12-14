import os
import json
import time
import difflib
import google.generativeai as genai
from typing import List, Dict, Set

# --- 設定 ---
API_KEY = os.environ.get("GOOGLE_API_KEY", "YOUR_API_KEY_HERE")
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

# API Key Handling
API_KEYS = os.environ.get("GOOGLE_API_KEY", "").split(",")
if not API_KEYS or not API_KEYS[0]:
    raise ValueError("GOOGLE_API_KEY environment variable is not set.")

current_key_index = 0

def get_current_key():
    return API_KEYS[current_key_index]

def rotate_key():
    global current_key_index
    if len(API_KEYS) > 1:
        current_key_index = (current_key_index + 1) % len(API_KEYS)
        print(f"    🔄 Switching to API Key #{current_key_index + 1}/{len(API_KEYS)}")
        return True
    return False

def get_existing_point_names(data: List[Dict]) -> Set[str]:
    names = set()
    for region in data:
        for zone in region.get("children", []):
            for area in zone.get("children", []):
                for point in area.get("children", []):
                    names.add(point["name"])
    return names

# Models to cycle through
CANDIDATE_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemma-3-27b-it',
    'gemma-3-12b-it',
    'gemma-3-4b-it',
    'gemma-3-2b-it',
    'gemma-3-1b-it',
]

def generate_points(region: str, zone: str, area: str) -> List[Dict]:
    global current_key_index

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

    for model_name in CANDIDATE_MODELS:
        for attempt in range(len(API_KEYS) * 2): # Allow multiple attempts per model, cycling keys
            try:
                # Configure with current key
                genai.configure(api_key=get_current_key())
                model = genai.GenerativeModel(model_name)

                response = model.generate_content(prompt)
                text = response.text.strip()
                # Remove markdown if present
                if text.startswith("```json"):
                    text = text[7:]
                if text.endswith("```"):
                    text = text[:-3]

                result = json.loads(text)
                if result:
                    print(f"    ✅ Success with {model_name}")
                    return result

            except Exception as e:
                error_str = str(e)
                if "429" in error_str:
                    print(f"    ⚠️ Quota exceeded: {model_name} (Key #{current_key_index + 1})")
                    if rotate_key():
                        # If key rotated, immediately retry with the new key for the same model
                        continue
                    else:
                        # No more keys, wait before next attempt (or model)
                        time.sleep(1)
                elif "404" in error_str or "not found" in error_str.lower():
                    # Fallback for models that might not include -it suffix or differ in naming
                    print(f"    ℹ️ Model {model_name} not found/supported. Skipping.")
                    break # Break from key attempts for this model, try next model
                else:
                    print(f"    ❌ Error with {model_name}: {e}")
                    break # Break from key attempts for this model, try next model

    print(f"    💀 All models failed for {area}")
    return []

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
                new_p["id"] = f"p_{int(time.time())}_{new_p['name']}"
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
