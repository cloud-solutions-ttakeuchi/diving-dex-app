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

def get_existing_point_names(data: List[Dict]) -> Set[str]:
    names = set()
    for region in data:
        for zone in region.get("children", []):
            for area in zone.get("children", []):
                for point in area.get("children", []):
                    names.add(point["name"])
    return names

def generate_points(region: str, zone: str, area: str) -> List[Dict]:
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-2.5-flash')

    prompt = f"""
    あなたはベテランのダイビングガイドです。
    ダイビングエリア「{region}」 > 「{zone}」 > 「{area}」にある、具体的なダイビングポイントをリストアップしてください。
    表記揺れ（同じ場所、名前は違うが地理的には重複している場所）を避けるようにしてください。

    条件:
    1. {area}の代表的なポイントを3〜5個選定してください。
    2. 各Pointの緯度経度（latitude, longitude）も推測値で良いので必ず入れてください。
    3. JSON形式のみ出力してください。

    {SCHEMA_PROMPT}

    Context: {region} > {zone} > {area}
    """

    for attempt in range(5):
        try:
            response = model.generate_content(prompt)
            text = response.text.strip()
            if text.startswith("```json"): text = text[7:]
            if text.startswith("```"): text = text[3:]
            if text.endswith("```"): text = text[:-3]
            if text.strip().endswith("}"): text += "]"

            return json.loads(text)
        except Exception as e:
            if "429" in str(e):
                wait_time = 5
                print(f"    ⚠️ Quota exceeded. Retrying in {wait_time}s... ({attempt+1}/5)")
                time.sleep(wait_time)
            else:
                print(f"Error generating points for {area}: {e}")
                return []
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
        time.sleep(2)

    # Save
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_locations, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Done! Saved locations to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
