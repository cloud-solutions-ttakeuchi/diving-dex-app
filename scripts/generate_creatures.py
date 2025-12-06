import os
import json
import time
import math
import google.generativeai as genai
import hashlib
from typing import List, Dict

# --- 設定 ---
API_KEY = os.environ.get("GOOGLE_API_KEY", "YOUR_API_KEY_HERE")
OUTPUT_FILE = "src/data/creatures_seed.json"
TARGET_AREAS = ["東伊豆","西伊豆", "沖縄", "石垣島","奄美大島", "慶良間諸島","小笠原諸島","八丈島", "宮古島", "パラオ", "モルディブ", "フレンチポリネシア", "フィジー", "メキシコ"]
TARGET_THEMES = ["サメ", "スズメダイ", "チョウチョウオ", "ハゼ", "ウミウシ", "甲殻類", "カエルアンコウ"] # 種別指定
COUNT_PER_AREA = 50
BATCH_SIZE = 10

# --- データモデル定義 ---
SCHEMA_PROMPT = """
出力フォーマットは以下のJSON配列（Array of Objects）のみにしてください。
Markdownのバッククォートは不要です。

Object Schema:
{
  "name": "生物の和名（例: カクレクマノミ）",
  "scientificName": "学名（例: Amphiprion ocellaris）",
  "englishName": "英名（例: Common Clownfish）",
  "family": "科目（例: スズメダイ科）",
  "imageKeyword": "この生物の画像検索に使える英単語1語",
  "category": "カテゴリ（魚類 / ウミウシ / 甲殻類 / 大物 / サンゴ / その他）",
  "tags": ["検索用タグ配列", "色", "模様", "特徴"],
  "description": "100文字程度のダイバー向け解説文。豆知識を含むと良い。",
  "baseRarity": "Common / Rare / Epic / Legendary (ダイバーにとってのレア度)",
  "depthRange": { "min": 最小水深(int), "max": 最大水深(int) },
  "size": "平均サイズ（例: 10cm）",
  "season": ["spring", "summer", "autumn", "winter"],
  "specialAttributes": ["毒", "擬態", "夜行性", "噛みつく", "被写体", "危険", "かわいい", "美しい", "人気者", "大物"],
  "waterTempRange": { "min": 20, "max": 30 },
  "regions": ["生息する広域エリア名"]
}
"""

def _call_gemini_api(target: str, count: int, mode: str = "area") -> List[Dict]:
    """Gemini APIを実際に叩く内部関数（小分け実行用）"""
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-2.0-flash')

    if mode == "area":
        prompt_context = f"「{target}」のダイビングスポットで見られる代表的な海洋生物"
    else:
        prompt_context = f"海洋生物のカテゴリ「{target}」に属する代表的な種類"

    prompt = f"""
    あなたはベテランのダイビングガイド兼海洋生物学者です。
    {prompt_context}を {count} 種類リストアップし、
    以下のスキーマに従ってJSONデータを作成してください。

    条件:
    1. ダイバーに人気のある生物を中心に選定すること。
    2. 実在する正確なデータに基づき記述すること。
    3. JSON以外の文字列（解説など）は一切出力しないこと。

    {SCHEMA_PROMPT}
    """

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()

        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        if text.strip().endswith("}"):
             text += "]"

        data = json.loads(text)
        return data

    except Exception as e:
        print(f"    ⚠️ API Error or Parse Error: {str(e)[:100]}...")
        return []

def generate_creatures(target: str, total_count: int, mode: str = "area") -> List[Dict]:
    """指定された数をバッチ分割して生成し、結合して返す"""
    print(f"Generating {total_count} creatures for {target} ({mode}) (in batches of {BATCH_SIZE})...")

    combined_data = []
    num_batches = math.ceil(total_count / BATCH_SIZE)

    for i in range(num_batches):
        current_batch_count = min(BATCH_SIZE, total_count - len(combined_data))
        print(f"  - Batch {i+1}/{num_batches}: Requesting {current_batch_count} items...")

        batch_data = _call_gemini_api(target, current_batch_count, mode)

        if batch_data:
            for idx, item in enumerate(batch_data):
                # Unique ID Generation
                seed_str = item.get("scientificName") or item.get("name") or str(time.time())
                unique_hash = hashlib.sha256(seed_str.encode()).hexdigest()[:16]
                item["id"] = f"c_{unique_hash}"

                keyword = item.get("imageKeyword", "underwater").replace(" ", "")
                item["image"] = f"https://loremflickr.com/400/400/{keyword},underwater"

                if "regions" not in item:
                    item["regions"] = []

                # Areaモードの場合のみ、そのエリアをregionsに追加
                if mode == "area" and target not in item["regions"]:
                    item["regions"].append(target)

            combined_data.extend(batch_data)
            print(f"    -> Got {len(batch_data)} items.")
        else:
            print(f"    -> Failed to get batch {i+1}. Retrying once...")
            time.sleep(2)
            batch_data = _call_gemini_api(target, current_batch_count, mode)
            if batch_data:
                 combined_data.extend(batch_data)
                 print(f"    -> Retry successful. Got {len(batch_data)} items.")

        time.sleep(2)

    return combined_data

def main():
    if API_KEY == "YOUR_API_KEY_HERE":
        print("⚠️ エラー: APIキーが設定されていません。")
        return

    # 1. 既存データの読み込み
    all_creatures = []
    creature_map = {}

    if os.path.exists(OUTPUT_FILE):
        print(f"📂 Loading existing data from {OUTPUT_FILE}...")
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                all_creatures = json.load(f)
                for c in all_creatures:
                    if "name" in c:
                        creature_map[c["name"]] = c
            print(f"   -> Loaded {len(all_creatures)} creatures.")
        except json.JSONDecodeError:
            print("   -> File was empty or invalid JSON. Starting fresh.")
    else:
        print("📂 No existing file found. Starting fresh.")

    print(f"🚀 Generating new data using API Key: {API_KEY[:5]}...")

    added_count = 0
    updated_count = 0

    # 処理対象リストの作成 (Area + Theme)
    tasks = []
    for area in TARGET_AREAS:
        tasks.append({"target": area, "mode": "area", "count": COUNT_PER_AREA})
    for theme in TARGET_THEMES:
        tasks.append({"target": theme, "mode": "theme", "count": 30}) # テーマ別は少し少なめでOK

    for task in tasks:
        target = task["target"]
        mode = task["mode"]
        count = task["count"]

        new_creatures = generate_creatures(target, count, mode)

        if new_creatures:
            target_added = 0
            target_updated = 0

            for new_c in new_creatures:
                name = new_c.get("name")

                if name in creature_map:
                    # 【既存データの更新】
                    existing_c = creature_map[name]

                    # 1. regionsの更新 (Areaモードの場合のみ)
                    if mode == "area":
                        if "regions" not in existing_c: existing_c["regions"] = []
                        if target not in existing_c["regions"]:
                            existing_c["regions"].append(target)
                            updated_count += 1
                            target_updated += 1

                    # 2. 属性の更新 (family, scientificNameなど)
                    for key in ["scientificName", "englishName", "baseRarity", "family"]:
                        if key not in existing_c and key in new_c:
                            existing_c[key] = new_c[key]
                            # カウントは重複するので厳密にはしないが、更新されたとみなす
                else:
                    # 【新規データの追加】
                    all_creatures.append(new_c)
                    creature_map[name] = new_c
                    target_added += 1
                    added_count += 1

            print(f"  -> {target} ({mode}) Result: Added {target_added} new, Updated {target_updated} (regions/attr) existing items.")
        else:
            print(f"  -> Failed to generate items for {target}.")

        print("-" * 30)

    # 3. 保存
    if added_count > 0 or updated_count > 0:
        os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(all_creatures, f, indent=2, ensure_ascii=False)

        print(f"\n✅ Done! Added: {added_count}, Updated: {updated_count}")
        print(f"Total creatures in file: {len(all_creatures)}")
    else:
        print("\nℹ️ No changes made to the data.")

if __name__ == "__main__":
    main()
