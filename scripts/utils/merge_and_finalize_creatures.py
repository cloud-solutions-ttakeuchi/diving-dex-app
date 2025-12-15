import json
import os
import shutil

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "src/data")
COMPLETE_FILE = os.path.join(DATA_DIR, "creatures_complete.json")
PREPARE_FILE = os.path.join(DATA_DIR, "creatures_prepare.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "creatures_seed.json")

def main():
    print("🔄 Merging Creature Data...")

    if not os.path.exists(COMPLETE_FILE) or not os.path.exists(PREPARE_FILE):
        print("❌ Complete or Prepare file not found.")
        return

    with open(COMPLETE_FILE, 'r', encoding='utf-8') as f:
        complete_list = json.load(f)

    with open(PREPARE_FILE, 'r', encoding='utf-8') as f:
        prepare_list = json.load(f)

    print(f"📂 Complete: {len(complete_list)} items")
    print(f"📂 Prepare : {len(prepare_list)} items")

    merged_list = complete_list + prepare_list

    # Sort by ID or Name for consistency?
    # Let's sort by ID to be deterministic
    merged_list.sort(key=lambda x: x.get("id", ""))

    print(f"📦 Total Merged: {len(merged_list)} items")

    # Safety Backup
    if os.path.exists(OUTPUT_FILE):
        shutil.copy(OUTPUT_FILE, OUTPUT_FILE + ".pre_merge.bak")
        print("📦 Created backup of existing seed file.")

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(merged_list, f, indent=2, ensure_ascii=False)

    print(f"✅ Merge Complete! Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
