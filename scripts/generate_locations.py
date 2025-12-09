import os
import json
import time
import google.generativeai as genai
from typing import List, Dict

# --- 設定 ---
# 【重要】APIキーの設定
API_KEY = os.environ.get("GOOGLE_API_KEY", "YOUR_API_KEY_HERE")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_FILE = os.path.join(BASE_DIR, "src/data/locations_seed.json")

# 生成対象のRegion（国・地域レベル）
TARGET_REGIONS = ["日本", "パラオ", "フィリピン", "モルディブ", "バリ", "フレンチポリネシア", "メキシコ", "カナダ", "アメリカ", "オーストラリア"]

# --- データモデル定義 (AIへの指示用) ---
SCHEMA_PROMPT = """
出力フォーマットは以下のJSON配列（Array of Objects）のみにしてください。
Markdownのバッククォートは不要です。

Object Schema (Recursive):
[
  {
    "id": "r_{region_name}",
    "name": "Region Name (e.g. 日本)",
    "type": "Region",
    "description": "Region description",
    "children": [
      {
        "id": "z_{zone_name}",
        "name": "Zone Name (e.g. 沖縄本島)",
        "type": "Zone",
        "description": "Zone description",
        "children": [
          {
            "id": "a_{area_name}",
            "name": "Area Name (e.g. 恩納村)",
            "type": "Area",
            "children": [
              {
                "id": "p_{point_name}",
                "name": "Point Name (e.g. 青の洞窟)",
                "type": "Point",
                "level": "Beginner / Intermediate / Advanced",
                "maxDepth": int (meter),
                "entryType": "boat / beach",
                "current": "none / weak / strong / drift",
                "topography": ["cave", "dropoff", "sand", "rock" ...],
                "features": ["特徴タグ1", "特徴タグ2"],
                "description": "ポイントの魅力や特徴を100文字程度で。",
                "imageKeyword": "画像検索用英単語 (e.g. blue cave okinawa)"
              }
            ]
          }
        ]
      }
    ]
  }
]
"""

def generate_locations(region: str) -> List[Dict]:
    """Geminiを使って特定Region配下の階層データを一括生成する"""
    print(f"Generating location hierarchy for {region}...")

    genai.configure(api_key=API_KEY)
    # 構造が複雑なので、より賢いモデルを推奨
    model = genai.GenerativeModel('gemini-2.0-flash')

    prompt = f"""
    あなたはベテランのダイビング旅行プランナーです。
    ダイビングエリア「{region}」について、代表的なダイビングスポットを階層構造で整理してください。

    階層ルール:
    Region ({region}) > Zone (主要な島や地方) > Area (港や地区) > Point (具体的なポイント名)

    条件:
    1. {region}の中に、代表的なZoneを2〜3個選定してください。
    2. 各Zoneの中に、代表的なAreaを2〜3個選定してください。
    3. 各Areaの中に、有名なPointを2〜3個選定してください。
    4. 各Pointには、リアルな水深やレベル、地形情報を入れてください。
    5. JSON形式のみ出力してください。

    {SCHEMA_PROMPT}
    """

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()

        # Markdown除去
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        # 配列の閉じ括弧漏れなどの簡易補正
        if text.strip().endswith("}"):
             text += "]"

        data = json.loads(text)

        # 配列でない場合（単一オブジェクトの場合）は配列に入れる
        if isinstance(data, dict):
            data = [data]

        # IDのユニーク化と画像URL生成の再帰処理
        base_time = int(time.time())

        for r_idx, reg in enumerate(data):
            # Region
            if "id" not in reg: reg["id"] = f"r_{base_time}_{r_idx}"

            if "children" in reg:
                for z_idx, zone in enumerate(reg["children"]):
                    # Zone
                    if "id" not in zone: zone["id"] = f"z_{base_time}_{r_idx}_{z_idx}"

                    if "children" in zone:
                        for a_idx, area in enumerate(zone["children"]):
                            # Area
                            if "id" not in area: area["id"] = f"a_{base_time}_{r_idx}_{z_idx}_{a_idx}"

                            if "children" in area:
                                for p_idx, point in enumerate(area["children"]):
                                    # Point
                                    if "id" not in point: point["id"] = f"p_{base_time}_{r_idx}_{z_idx}_{a_idx}_{p_idx}"

                                    # 画像URL生成 (廃止: 猫が出るため)
                                    # keyword = point.get("imageKeyword", "diving").replace(" ", "")
                                    # point["image"] = f"https://loremflickr.com/400/300/{keyword},underwater"
                                    point["image"] = ""

        return data

    except Exception as e:
        print(f"Error generating data for {region}: {e}")
        return []

def main():
    # キー設定のチェック
    if API_KEY == "YOUR_API_KEY_HERE":
        print("⚠️ エラー: APIキーが設定されていません。")
        return

    all_locations = []

    # 既存ファイルがあれば読み込む（追記モード）
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                all_locations = json.load(f)
                print(f"📂 Loaded {len(all_locations)} existing regions.")
        except json.JSONDecodeError:
            pass

    print(f"🚀 Generating data using API Key: {API_KEY[:5]}...")

    for region in TARGET_REGIONS:
        # Check if region exists
        existing_region_index = next((i for i, r in enumerate(all_locations) if r["name"] == region), -1)

        if existing_region_index != -1:
             print(f"  -> Merging into existing {region} (Update mode)...")
             new_data_list = generate_locations(region)
             if not new_data_list: continue

             # Merge Logic
             existing_region = all_locations[existing_region_index]
             new_region = new_data_list[0]

             existing_zones = existing_region.get("children", [])
             new_zones = new_region.get("children", [])

             for new_z in new_zones:
                 existing_z = next((z for z in existing_zones if z["name"] == new_z["name"]), None)
                 if existing_z:
                     # Zone exists, merge areas
                     existing_areas = existing_z.get("children", [])
                     new_areas = new_z.get("children", [])
                     for new_a in new_areas:
                         existing_a = next((a for a in existing_areas if a["name"] == new_a["name"]), None)
                         if existing_a:
                             # Area exists, merge Points
                             existing_points = existing_a.get("children", [])
                             new_points = new_a.get("children", [])
                             for new_p in new_points:
                                 if not any(p["name"] == new_p["name"] for p in existing_points):
                                     print(f"    + Adding Point: {new_p['name']} to Area: {new_a['name']}")
                                     existing_points.append(new_p)
                             existing_a["children"] = existing_points
                         else:
                             # Area does not exist, add it
                             print(f"    + Adding Area: {new_a['name']} to Zone: {new_z['name']}")
                             existing_areas.append(new_a)
                     existing_z["children"] = existing_areas
                 else:
                     # Zone does not exist, add it
                     print(f"    + Adding Zone: {new_z['name']}")
                     existing_zones.append(new_z)

             existing_region["children"] = existing_zones
             all_locations[existing_region_index] = existing_region
             time.sleep(5)
             continue

        locations = generate_locations(region)
        if locations:
            all_locations.extend(locations)
            print(f"  -> Generated hierarchy for {region}.")
        else:
            print(f"  -> Failed to generate items for {region}.")

        # レート制限回避
        time.sleep(5)

    # JSONファイルとして保存
    if all_locations:
        os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(all_locations, f, indent=2, ensure_ascii=False)

        print(f"\n✅ Successfully generated location data in '{OUTPUT_FILE}'")
    else:
        print("\n❌ No data generated.")

if __name__ == "__main__":
    main()
