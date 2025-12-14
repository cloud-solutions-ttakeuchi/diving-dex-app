import os
import json
import time
import math
import hashlib
import google.generativeai as genai
from typing import List, Dict

# --- 設定 ---
API_KEY = os.environ.get("GOOGLE_API_KEY", "YOUR_API_KEY_HERE")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTPUT_FILE = os.path.join(BASE_DIR, "src/data/creatures_seed.json")

# 生成対象のグループ（科目・カテゴリ）
TARGET_FAMILIES_FILE = os.path.join(BASE_DIR, "scripts/config/target_families.json")

COUNT_PER_GROUP = 30
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
  "specialAttributes": ["毒", "擬態", "夜行性", "噛みつく", "被写体", "危険", "かわいい", "美しい", "人気者", "大物"]
}
"""

def _call_gemini_api(target: str, count: int) -> List[Dict]:
    """Gemini APIを叩く"""
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-2.5-flash')

    prompt = f"""
    あなたは海洋生物学者です。
    ダイバーに人気の高い「{target}」の仲間を {count} 種類リストアップしてください。

    条件:
    1. ダイビングで見られる種を中心に選定すること。
    2. 学名(scientificName)は正確に記述すること。
    3. JSON以外の文字列は出力しないこと。

    {SCHEMA_PROMPT}
    """

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()

        if text.startswith("```json"): text = text[7:]
        if text.startswith("```"): text = text[3:]
        if text.endswith("```"): text = text[:-3]
        if text.strip().endswith("}"): text += "]"

        data = json.loads(text)
        return data if isinstance(data, list) else [data]

    except Exception as e:
        print(f"    ⚠️ API Error: {e}")
        return []

def generate_creatures_by_group(target: str, total_count: int) -> List[Dict]:
    """バッチ処理で生成"""
    print(f"Generating {total_count} creatures for group: {target}...")
    combined_data = []
    num_batches = math.ceil(total_count / BATCH_SIZE)

    for i in range(num_batches):
        current_count = min(BATCH_SIZE, total_count - len(combined_data))
        batch_data = _call_gemini_api(target, current_count)

        if batch_data:
            for item in batch_data:
                # ID生成 (学名を優先キーとする)
                seed_str = item.get("scientificName") or item.get("name")
                unique_hash = hashlib.sha256(seed_str.encode()).hexdigest()[:16]
                item["id"] = f"c_{unique_hash}"
                item["image"] = "" # 画像は別途取得

            combined_data.extend(batch_data)
            print(f"    -> Batch {i+1}/{num_batches}: Got {len(batch_data)} items.")
        else:
            print(f"    -> Batch {i+1}/{num_batches}: Failed.")

        time.sleep(2)

    return combined_data

def main():
    if API_KEY == "YOUR_API_KEY_HERE":
        print("⚠️ API Key missing.")
        return

    # 既存データの読み込み (学名で名寄せ用マップ作成)
    all_creatures = []
    scientific_map = {}

    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                all_creatures = json.load(f)
                for c in all_creatures:
                    if "scientificName" in c:
                        scientific_map[c["scientificName"]] = c
        except:
            pass

    print(f"📂 Loaded {len(all_creatures)} creatures. Starting generation...")

    added_count = 0
    updated_count = 0

    # 生成対象リストの読み込み
    target_groups = []
    if os.path.exists(TARGET_FAMILIES_FILE):
        with open(TARGET_FAMILIES_FILE, 'r', encoding='utf-8') as f:
            target_groups = json.load(f)
        print(f"📖 Loaded {len(target_groups)} target families from file.")
    else:
        print(f"⚠️ Target families file not found: {TARGET_FAMILIES_FILE}")
        return

    for group in target_groups:
        new_items = generate_creatures_by_group(group, COUNT_PER_GROUP)

        for item in new_items:
            s_name = item.get("scientificName")

            if s_name and s_name in scientific_map:
                # 既存あり: 情報更新 (画像は上書きしない)
                existing = scientific_map[s_name]
                # マージロジック (空なら埋めるなど)
                updated_count += 1
            else:
                # 新規追加
                all_creatures.append(item)
                if s_name: scientific_map[s_name] = item
                added_count += 1

    # 保存
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_creatures, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Done! Added: {added_count}, Updated: {updated_count}")

if __name__ == "__main__":
    main()
