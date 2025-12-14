import os
import json
import time
import google.generativeai as genai
from typing import List, Dict

# --- 設定 ---
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

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG_DIR = os.path.join(BASE_DIR, "scripts/config")
DATA_DIR = os.path.join(BASE_DIR, "src/data")
INPUT_FILE = os.path.join(CONFIG_DIR, "target_zones.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "locations_seed.json")
PRODUCED_AREAS_FILE = os.path.join(CONFIG_DIR, "target_areas.json")

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

def generate_areas(region: str, zone: str) -> List[Dict]:
    global current_key_index

    prompt = f"""
    あなたはベテランのダイビングガイドです。
    指定された「Zone（地域）」に含まれる、具体的な「Area（ダイビングスポットの集まり）」をリストアップしてください。

    Region: {region}
    Zone: {zone}

    出力フォーマット（JSON）:
    [
      {{
        "name": "Area名（例: 嘉比島, マンタスクランブル周辺）",
        "description": "そのエリアのダイビングの特徴を100文字以内で"
      }}
    ]

    注意点:
    - Zoneをさらに細分化したエリアです。
    - 3〜5個程度挙げてください。
    - コードブロックは含めないでください。
    """

    for model_name in CANDIDATE_MODELS:
        for attempt in range(len(API_KEYS) * 2):
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
                    if rotate_key(): continue
                    time.sleep(1)
                elif "404" in error_str or "not found" in error_str.lower():
                    print(f"    ℹ️ Model {model_name} not found/supported. Skipping.")
                    break
                else:
                    print(f"    ❌ Error with {model_name}: {e}")
                    break

    print(f"    💀 All models failed for {zone}")
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
