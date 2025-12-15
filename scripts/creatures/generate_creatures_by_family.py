import os
import json
import time
import math
import hashlib
import google.generativeai as genai
from typing import List, Dict

# --- 設定 ---
# --- 設定 ---
# API Key Handling
API_KEYS = os.environ.get("GOOGLE_API_KEY", "").split(",")
if not API_KEYS or not API_KEYS[0]:
    raise ValueError("GOOGLE_API_KEY environment variable is not set.")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG_DIR = os.path.join(BASE_DIR, "scripts/config")
DATA_DIR = os.path.join(BASE_DIR, "src/data")
TARGET_FAMILIES_FILE = os.path.join(CONFIG_DIR, "target_families.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "creatures_seed.json")

BATCH_SIZE = 5
COUNT_PER_GROUP = 10

SCHEMA_PROMPT = """
出力スキーマ(JSON Array):
[
  {
    "name": "生物名(和名)",
    "englishName": "English Name",
    "scientificName": "Scientific Name",
    "family": "科名(和名)",
    "category": "魚類 | ウミウシ | 甲殻類 | サンゴ | その他 | 大物",
    "description": "50文字程度の解説",
    "imageKeyword": "画像検索用キーワード",
    "tags": ["特徴タグ1", "特徴タグ2", "色", "模様"],
    "rarity": "Common | Rare | Epic | Legendary (一般的なダイビングでの遭遇難易度)",
    "size": "サイズ目安 (例: 15cm, 1.5m)",
    "depthRange": {
      "min": 最小水深(数値),
      "max": 最大水深(数値)
    },
    "stats": {
      "rarity": 1-100 (数値),
      "popularity": 1-100 (人気度),
      "danger": 0-100 (危険度 毒や攻撃性),
      "size": 1-100 (サイズ感),
      "speed": 1-100 (泳ぐ速さ),
      "lifespan": 1-100 (寿命イメージ)
    },
    "waterTempRange": {
        "min": 20,
        "max": 30
    },
    "specialAttributes": ["毒", "擬態", "共生", "夜行性", "固有種", "被写体", "美しい", "かわいい", "群れ", "大物", "回遊魚"] の中から該当するもの,
    "season": ["春", "夏", "秋", "冬"] の中から見られる季節（複数可）
  }
]
"""
# --- Class Definitions for Robust API Handling ---

class APIResource:
    def __init__(self, api_key: str, model_name: str, priority: int):
        self.api_key = api_key
        self.model_name = model_name
        self.priority = priority
        self.status = 'stand-by' # 'stand-by' | 'active' | 'stop'
        self.quota_exceed_dt = 0.0

RESOURCE_POOL: List[APIResource] = []

# Initialize Pool
# Priority: Flash > Flash-Lite
for key in API_KEYS:
    if not key: continue
    RESOURCE_POOL.append(APIResource(key, 'gemini-2.5-flash', 1))

for key in API_KEYS:
    if not key: continue
    RESOURCE_POOL.append(APIResource(key, 'gemini-2.5-flash-lite', 2))

def get_best_resource() -> APIResource:
    """Design: Priority & Status based selection"""
    current_time = time.time()

    # 1. Check for release from 'stop' state
    for r in RESOURCE_POOL:
        if r.status == 'stop':
            if current_time - r.quota_exceed_dt > 65:
                r.status = 'stand-by'
                r.quota_exceed_dt = 0.0

    # 2. Select 'stand-by' with highest priority
    candidates = [r for r in RESOURCE_POOL if r.status == 'stand-by']
    if candidates:
        candidates.sort(key=lambda x: x.priority)
        best = candidates[0]
        best.status = 'active'
        return best

    return None

def _call_gemini_api(target: str, count: int) -> List[Dict]:
    """Gemini APIを叩く"""

    prompt = f"""
    あなたは海洋生物学者です。
    ダイバーに人気の高い「{target}」の仲間を {count} 種類リストアップしてください。

    条件:
    1. ダイビングで見られる種を中心に選定すること。
    2. 学名(scientificName)は正確に記述すること。
    3. JSON以外の文字列は出力しないこと。
    4. stat, tags, description, depthRange, waterTempRange, specialAttributes など全てのフィールドを網羅的に生成すること。
    5. specialAttributesは、配列内のプリセット値から適切なものを選んでください。

    {SCHEMA_PROMPT}
    """

    while True:
        resource = get_best_resource()

        if not resource:
            stopped_resources = [r for r in RESOURCE_POOL if r.status == 'stop']
            if not stopped_resources:
                print("    ❌ All resources invalid/stopped but no timer set. Aborting.")
                return []

            earliest_release = min(r.quota_exceed_dt for r in stopped_resources) + 65
            wait_seconds = earliest_release - time.time()

            if wait_seconds > 0:
                print(f"    ⏳ All resources exhausted. Waiting {wait_seconds:.1f}s for rate limit release...")
                time.sleep(wait_seconds + 1)
                continue
            else:
                time.sleep(1)
                continue

        try:
            # Execute Request
            genai.configure(api_key=resource.api_key)
            model = genai.GenerativeModel(resource.model_name)

            response = model.generate_content(prompt)
            text = response.text.strip()
            # Remove markdown if present
            if text.startswith("```json"): text = text[7:]
            if text.startswith("```"): text = text[3:]
            if text.endswith("```"): text = text[:-3]
            if text.strip().endswith("}"): text += "]"

            data = json.loads(text)
            result = data if isinstance(data, list) else [data]
            if result:
                # Success
                key_display_idx = API_KEYS.index(resource.api_key) + 1
                print(f"    ✅ Success with {resource.model_name} (Key #{key_display_idx})")

                resource.status = 'stand-by'

                # 🛑 RATE LIMIT HANDLING: Wait 5 seconds after success
                time.sleep(5)
                return result

        except Exception as e:
            error_str = str(e)
            if "429" in error_str:
                print(f"    ⚠️ Quota exceeded (429): {resource.model_name} (Key ends {resource.api_key[-4:]})")
                # print(f"    DEBUG Info: {error_str[:200]}...") # Uncomment to see full error details if needed

                resource.status = 'stop'
                resource.quota_exceed_dt = time.time()

                # PREVIOUSLY: We stopped all models with this key.
                # CHANGE: Only stop THIS specific model/key combo to allow fallback to Lite (which has separate RPM).
                # for r in RESOURCE_POOL:
                #    if r.api_key == resource.api_key:
                #        r.status = 'stop'
                #        r.quota_exceed_dt = time.time()

            elif "404" in error_str or "not found" in error_str.lower():
                print(f"    ℹ️ Model {resource.model_name} not found. Removing from pool.")
                if resource in RESOURCE_POOL:
                    RESOURCE_POOL.remove(resource)
            else:
                print(f"    ❌ Error with {resource.model_name}: {e}")
                resource.status = 'stand-by'
                time.sleep(1)

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

import argparse
import shutil

# ... (imports remain)
import os
import json
import time
import math
import hashlib
import google.generativeai as genai
from typing import List, Dict

# ... (rest of imports/constants up to main)

def main():
    parser = argparse.ArgumentParser(description="Generate creature data based on taxonomy.")
    parser.add_argument("--mode", choices=["append", "overwrite", "clean"], default="append",
                        help="Generation mode: append (default), overwrite, or clean.")
    args = parser.parse_args()

    if not API_KEYS:
        print("⚠️ API Key missing.")
        return

    # Clean mode: Backup and delete existing file
    if args.mode == "clean":
        if os.path.exists(OUTPUT_FILE):
            timestamp = int(time.time())
            backup_path = f"{OUTPUT_FILE}.{timestamp}.bak"
            shutil.move(OUTPUT_FILE, backup_path)
            print(f"🧹 Clean mode: Existing file backed up to {backup_path}")
        else:
            print("🧹 Clean mode: No existing file to backup.")

    # 既存データの読み込み (学名で名寄せ用マップ作成)
    all_creatures = []
    scientific_map = {}

    if os.path.exists(OUTPUT_FILE) and args.mode != "clean":
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                all_creatures = json.load(f)
                for c in all_creatures:
                    if "scientificName" in c:
                        scientific_map[c["scientificName"]] = c
        except Exception as e:
            print(f"⚠️ Error loading existing file: {e}")
            pass

    print(f"📂 Loaded {len(all_creatures)} creatures. Mode: {args.mode}")

    added_count = 0
    updated_count = 0
    skipped_count = 0

    # 生成対象リストの読み込み
    target_groups = []
    if os.path.exists(TARGET_FAMILIES_FILE):
        with open(TARGET_FAMILIES_FILE, 'r', encoding='utf-8') as f:
            target_groups = json.load(f)
        print(f"📖 Loaded {len(target_groups)} target families from file.")
    else:
        print(f"⚠️ Target families file not found: {TARGET_FAMILIES_FILE}")
        return

    # Resume Logic: Load processed log
    PROCESSED_LOG = os.path.join(CONFIG_DIR, "processed_families_log.json")
    processed_groups = set()
    if os.path.exists(PROCESSED_LOG) and args.mode == "append":
        try:
            with open(PROCESSED_LOG, 'r', encoding='utf-8') as f:
                processed_groups = set(json.load(f))
            print(f"🔄 Resuming... Skipping {len(processed_groups)} already processed families.")
        except:
            pass
    elif args.mode == "clean":
        # Clear log on clean
        if os.path.exists(PROCESSED_LOG):
            os.remove(PROCESSED_LOG)

    for group in target_groups:
        if args.mode == "append" and group in processed_groups:
             print(f"    ⏭️  Skipping {group} (Already processed).")
             continue

        # Check if we need to generate for this group at all (optimization for append)
        # Note: Since we generate by group, checking individual items happens after fetching,
        # or we could try to skip the whole group if we knew it was fully populated.
        # For now, we'll fetch and then filter/merge.

        new_items = generate_creatures_by_group(group, COUNT_PER_GROUP)

        # Mark as processed ONLY if we successfully got items.
        # If new_items is empty (e.g. due to API errors), do NOT mark as processed so we can retry.
        if new_items and args.mode == "append":
            processed_groups.add(group)
            with open(PROCESSED_LOG, 'w', encoding='utf-8') as f:
                json.dump(list(processed_groups), f, indent=2, ensure_ascii=False)

        for item in new_items:
            s_name = item.get("scientificName")

            if s_name and s_name in scientific_map:
                existing = scientific_map[s_name]

                if args.mode == "overwrite":
                    # For safety in this context (creatures linked by ID), let's UPDATE content.
                    # CRITICAL FIX: Do NOT overwrite ID or Image if they exist
                    safe_update_item = item.copy()
                    if "id" in safe_update_item: del safe_update_item["id"]
                    if "image" in safe_update_item: del safe_update_item["image"]
                    if "imageUrl" in safe_update_item: del safe_update_item["imageUrl"] # Just in case

                    existing.update(safe_update_item) # item has new data (description, etc)

                    updated_count += 1

                elif args.mode == "append":
                    # Append: Skip
                    skipped_count += 1
                    continue
            else:
                # New item
                all_creatures.append(item)
                if s_name: scientific_map[s_name] = item
                added_count += 1

        # Save validation (file update) per group to prevent data loss on crash
        os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(all_creatures, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Done! Added: {added_count}, Updated/Overwritten: {updated_count}, Skipped: {skipped_count}")

if __name__ == "__main__":
    main()
