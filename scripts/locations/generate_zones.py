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
INPUT_FILE = os.path.join(CONFIG_DIR, "target_regions.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "locations_seed.json")
PRODUCED_ZONES_FILE = os.path.join(CONFIG_DIR, "target_zones.json")

SCHEMA_PROMPT = """
出力フォーマットは以下のJSON配列（Array of Objects）のみにしてください。
Markdownのバッククォートは不要です。

Object Schema:
[
  {
    "name": "Region Name (e.g. 日本)",
    "type": "Region",
    "children": [
      {
        "name": "Zone Name (e.g. 沖縄本島)",
        "type": "Zone",
        "description": "Zone description"
      }
    ]
  }
]
"""

def generate_zones(region: str) -> List[Dict]:
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-2.5-flash')

    prompt = f"""
    あなたはダイビング旅行プランナーです。
    ダイビングエリア「{region}」について、主要なダイビングエリア（Zone）をリストアップしてください。
    Zoneとは、沖縄本島、石垣島、伊豆半島など、大きな地理的区分のことです。

    条件:
    1. {region}の中に、代表的なZoneを3〜5個選定してください。
    2. JSON形式のみ出力してください。

    {SCHEMA_PROMPT}
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
                wait_time = 5
                print(f"    ⚠️ Quota exceeded. Retrying in {wait_time}s... Error: {e}")
                time.sleep(wait_time)
                time.sleep(wait_time)
            else:
                print(f"Error generating zones for {region}: {e}")
                return []
    return []

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
        new_data = generate_zones(region_name)
        if not new_data: continue

        new_region_data = new_data[0] # Listの先頭

        if existing_region:
            # Merge logic (本来ここに来るのはAppendで部分的マージが必要な場合だが、
            # 現在のRegion単位判定ではここに来にくい。念のため残す)
            existing_zones = existing_region.get("children", [])
            existing_zone_names = {z["name"] for z in existing_zones}

            for new_z in new_region_data.get("children", []):
                if new_z["name"] not in existing_zone_names:
                    new_z["id"] = f"z_{int(time.time())}_{new_z['name']}"
                    existing_zones.append(new_z)
                    print(f"    + Added Zone: {new_z['name']}")
                else:
                    print(f"    . Exists: {new_z['name']}")

                produced_zones_list.append({"region": region_name, "zone": new_z["name"]})
            existing_region["children"] = existing_zones
        else:
            # New Region
            new_region_data["id"] = f"r_{int(time.time())}"
            for i, z in enumerate(new_region_data.get("children", [])):
                z["id"] = f"z_{int(time.time())}_{i}"
                produced_zones_list.append({"region": region_name, "zone": z["name"]})

            all_locations.append(new_region_data)
            print(f"    + Added New Region: {region_name}")

        time.sleep(2)

    # Save
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_locations, f, indent=2, ensure_ascii=False)

    # Save Config for Next Step
    with open(PRODUCED_ZONES_FILE, 'w', encoding='utf-8') as f:
        json.dump(produced_zones_list, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Done! Saved locations to {OUTPUT_FILE}")
    print(f"📝 Generated next step config: {PRODUCED_ZONES_FILE}")

if __name__ == "__main__":
    main()
