import json
import os
import requests
import time

# 設定
INPUT_FILE = "src/data/creatures_seed.json"   # マスタデータ（生物リストの正）
OUTPUT_FILE = "src/data/creatures_real.json"  # 画像取得結果の保存先
SAVE_INTERVAL = 10  # 中間保存の間隔

def fetch_wiki_image(query, lang='ja'):
    """Wikipedia APIから画像を取得"""
    base_url = f"https://{lang}.wikipedia.org/w/api.php"
    headers = { "User-Agent": "DiveDexBot/1.0 (contact@example.com)" }
    params = {
        "action": "query", "format": "json", "prop": "pageimages|pageterms",
        "piprop": "original", "titles": query, "pithumbsize": 500, "redirects": 1
    }
    try:
        response = requests.get(base_url, params=params, headers=headers, timeout=10)
        if response.status_code != 200: return None
        data = response.json()
        pages = data.get("query", {}).get("pages", {})
        for page_id, page in pages.items():
            if page_id == "-1" or "original" not in page: continue
            return {
                "url": page["original"]["source"],
                "credit": f"Wikipedia ({lang})",
                "license": "CC BY-SA"
            }
    except Exception:
        pass
    return None

def load_and_merge_data():
    """
    seed（全リスト）とreal（取得済み画像）をマージする重要ロジック
    """
    # 1. seed（最新の生物リスト）がない場合は始まらない
    if not os.path.exists(INPUT_FILE):
        print(f"❌ Seed file not found: {INPUT_FILE}")
        return []

    print(f"📂 Loading seed data from {INPUT_FILE}...")
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        seed_creatures = json.load(f)

    # 2. real（過去に取得した画像データ）があれば読み込む
    real_image_map = {}
    if os.path.exists(OUTPUT_FILE):
        print(f"📂 Loading existing images from {OUTPUT_FILE}...")
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                real_creatures = json.load(f)
                # 名前をキーにして、有効な画像データだけをマップに保持
                for c in real_creatures:
                    img = c.get("image", "")
                    # 本物の画像（loremflickr以外）を持っている場合のみ記憶
                    if img.startswith("http") and "loremflickr" not in img:
                        real_image_map[c["name"]] = {
                            "image": c["image"],
                            "imageCredit": c.get("imageCredit"),
                            "imageLicense": c.get("imageLicense")
                        }
        except json.JSONDecodeError:
            pass

    # 3. seedリストに、realの画像を適用（マージ）
    merged_count = 0
    for c in seed_creatures:
        name = c["name"]
        if name in real_image_map:
            # 既に画像取得済みのデータがあれば、seedの情報を上書き
            c.update(real_image_map[name])
            merged_count += 1

    print(f"   -> Merged existing images for {merged_count} creatures.")
    return seed_creatures

def save_data(data):
    """保存処理"""
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(" 💾 Saved progress.")

def main():
    # マージ済みのリストを取得（これで新規追加分も、取得済み分も正しい状態になる）
    creatures = load_and_merge_data()
    if not creatures:
        return

    print(f"Checking images for {len(creatures)} creatures...")

    updated_count = 0
    skipped_count = 0

    for i, creature in enumerate(creatures):
        name = creature.get("name", "Unknown")
        current_image = creature.get("image", "")

        # --- スキップ判定 ---
        # マージ済みなので、ここでのチェックで「過去に取得済み」かどうかわかる
        if current_image.startswith("http") and "loremflickr" not in current_image:
             skipped_count += 1
             continue
        # ------------------

        en_keyword = creature.get("imageKeyword", "")
        print(f"[{i+1}/{len(creatures)}] 🔍 Searching: {name}...", end="", flush=True)

        # 優先順位: 学名(en) -> 和名(ja) -> 英名(en) -> キーワード(en)
        scientific_name = creature.get("scientificName")
        english_name = creature.get("englishName")

        # 1. 学名で検索 (最も確実)
        if scientific_name:
            # print(f" (Scientific: {scientific_name})...", end="", flush=True)
            image_data = fetch_wiki_image(scientific_name, 'en') # 学名は英語Wikipediaでヒットしやすい

        # 2. 和名で検索
        if not image_data:
            image_data = fetch_wiki_image(name, 'ja')

        # 3. 英名で検索 (スペースありの正式名)
        if not image_data and english_name:
             # print(f" (English: {english_name})...", end="", flush=True)
             image_data = fetch_wiki_image(english_name, 'en')

        # 4. キーワードで検索 (最後の手段)
        if not image_data and en_keyword and en_keyword != english_name:
            print(f" (Keyword: {en_keyword})...", end="", flush=True)
            image_data = fetch_wiki_image(en_keyword, 'en')

        if image_data:
            creature["image"] = image_data["url"]
            creature["imageCredit"] = image_data["credit"]
            creature["imageLicense"] = image_data["license"]
            print(" ✅ Found!")
            updated_count += 1
        else:
            print(" ❌ Not found")

        # 中間保存
        if updated_count > 0 and updated_count % SAVE_INTERVAL == 0:
            save_data(creatures)

        time.sleep(1.0)

    # 最終保存
    save_data(creatures)

    print(f"\n✨ Done!")
    print(f"   - Total checked: {len(creatures)}")
    print(f"   - Newly Fetched: {updated_count}")
    print(f"   - Skipped (Already done): {skipped_count}")
    print(f"   - Saved to: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
