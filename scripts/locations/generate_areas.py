import os
import json
import time
import google.generativeai as genai
from typing import List, Dict

# --- 設定 ---
API_KEY = os.environ.get("GOOGLE_API_KEY", "YOUR_API_KEY_HERE")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG_DIR = os.path.join(BASE_DIR, "scripts/config")
DATA_DIR = os.path.join(BASE_DIR, "src/data")
INPUT_FILE = os.path.join(CONFIG_DIR, "target_zones.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "locations_seed.json")
PRODUCED_AREAS_FILE = os.path.join(CONFIG_DIR, "target_areas.json")

SCHEMA_PROMPT = """
出力フォーマットは以下のJSON配列（Array of Objects）のみにしてください。
Markdownのバッククォートは不要です。

Object Schema:
[
  {
    "name": "Area Name (e.g. 恩納村)",
    "type": "Area",
    "description": "Area description (e.g. Major diving hub in Okinawa)"
  }
]
"""

def generate_areas(region: str, zone: str) -> List[Dict]:
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-2.5-flash')

    prompt = f"""
    あなたはベテランのダイビングガイドです。
    ダイビングエリア「{region}」の「{zone}」にある、主要なダイビングエリア（Area/地区/港）をリストアップしてください。

    例:
    Region: 日本, Zone: 沖縄本島 -> Area: [恩納村, 北谷, 本部, 糸満]
    Region: 日本, Zone: 伊豆半島 -> Area: [伊豆海洋公園, 富戸, 大瀬崎, 神子元]

    条件:
    1. {zone}の中に、代表的なAreaを2〜4個選定してください。
    2. JSON形式のみ出力してください。

    {SCHEMA_PROMPT}

    Context: {region} > {zone}
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
                print(f"Error generating areas for {zone}: {e}")
                return []
    return []

import argparse
import shutil

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
                new_a["id"] = f"a_{int(time.time())}_{new_a['name']}"
                existing_areas.append(new_a)
                print(f"    + Added Area: {new_a['name']}")
                produced_areas_list.append({"region": region_name, "zone": zone_name, "area": new_a["name"]})
            else:
                # 既にある場合は、既存のIDなどを維持したいか、上書きしたいか。
                # ここでは単純にスキップしつつ、NextStepリストには入れる
                print(f"    . Exists: {new_a['name']}")
                produced_areas_list.append({"region": region_name, "zone": zone_name, "area": new_a["name"]})

        zone_node["children"] = existing_areas
        time.sleep(2)

    # Save Main Data
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_locations, f, indent=2, ensure_ascii=False)

    # Save Config for Next Step
    with open(PRODUCED_AREAS_FILE, 'w', encoding='utf-8') as f:
        json.dump(produced_areas_list, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Done! Saved locations to {OUTPUT_FILE}")
    print(f"📝 Generated next step config: {PRODUCED_AREAS_FILE}")

if __name__ == "__main__":
    main()
