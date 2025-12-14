import json
import os
import time
import math
import google.generativeai as genai
from typing import List, Dict

# 設定
API_KEY = os.environ.get("GOOGLE_API_KEY", "YOUR_API_KEY_HERE")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CREATURES_FILE = os.path.join(BASE_DIR, "src/data/creatures_seed.json")
LOCATIONS_FILE = os.path.join(BASE_DIR, "src/data/locations_seed.json")
BATCH_SIZE = 20

def get_target_regions() -> List[str]:
    """locations_seed.json から生息地の候補リスト（Region + Zone名）を抽出"""
    regions = set()
    if os.path.exists(LOCATIONS_FILE):
        with open(LOCATIONS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for r in data:
                regions.add(r["name"]) # Region (例: 日本)
                # Zoneも候補に入れる (例: 沖縄, 伊豆) -> 日本全体より詳細な方が良い
                for z in r.get("children", []):
                    regions.add(z["name"])

    # 手動で補正したい主要エリアがあれば追加
    defaults = ["沖縄", "伊豆", "小笠原", "高知", "和歌山", "パラオ", "モルディブ", "フィリピン", "バリ", "タイ", "メキシコ", "ハワイ"]
    for d in defaults:
        regions.add(d)

    return list(regions)

def map_regions_batch(creatures: List[Dict], region_list: List[str]) -> List[Dict]:
    """Geminiにバッチで生息域を判定させる"""
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-2.5-flash')

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

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```json"): text = text[7:]
        if text.startswith("```"): text = text[3:]
        if text.endswith("```"): text = text[:-3]

        return json.loads(text)
    except Exception as e:
        print(f"    ⚠️ API/Parse Error: {e}")
        return []

def main():
    if not os.path.exists(CREATURES_FILE):
        print("❌ Creatures file not found.")
        return

    print("Loading data...")
    with open(CREATURES_FILE, 'r', encoding='utf-8') as f:
        creatures = json.load(f)

    target_regions = get_target_regions()
    print(f"Target Regions: {target_regions[:10]}...")

    print(f"Mapping regions for {len(creatures)} creatures...")

    updated_count = 0
    num_batches = math.ceil(len(creatures) / BATCH_SIZE)

    for i in range(num_batches):
        batch_slice = creatures[i*BATCH_SIZE : (i+1)*BATCH_SIZE]

        # 既にregionsが十分入っている場合はスキップするなどの判定を入れることも可能だが、
        # 今回は補完目的なので全チェック、あるいは「無いものだけ」などが良い
        # ここでは「regionsが空 または 少ない」場合に実行するロジックにする
        targets = [c for c in batch_slice if not c.get("regions")]

        if not targets:
            print(f"Skipping batch {i+1} (All have regions).")
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
