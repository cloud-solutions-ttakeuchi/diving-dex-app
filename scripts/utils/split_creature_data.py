import json
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "src/data")
CREATURES_FILE = os.path.join(DATA_DIR, "creatures_seed.json")
COMPLETE_FILE = os.path.join(DATA_DIR, "creatures_complete.json")
PREPARE_FILE = os.path.join(DATA_DIR, "creatures_prepare.json")

def main():
    print("✂️ Splitting Creature Data...")

    if not os.path.exists(CREATURES_FILE):
        print("❌ Creatures seed file not found.")
        return

    with open(CREATURES_FILE, 'r', encoding='utf-8') as f:
        creatures = json.load(f)

    complete_list = []
    prepare_list = []

    # Criteria for "Complete": Must have minimal valid fields
    required_keys = ["tags", "stats", "depthRange"]
    # Note: 'stats' is empty in some cases? We check existence.

    for c in creatures:
        is_complete = True
        for key in required_keys:
            if key not in c or not c[key]: # exists and not empty/None
                is_complete = False
                break

        if is_complete:
            complete_list.append(c)
        else:
            prepare_list.append(c)

    # Save files
    with open(COMPLETE_FILE, 'w', encoding='utf-8') as f:
        json.dump(complete_list, f, indent=2, ensure_ascii=False)

    with open(PREPARE_FILE, 'w', encoding='utf-8') as f:
        json.dump(prepare_list, f, indent=2, ensure_ascii=False)

    print(f"✅ Split Complete.")
    print(f"   📂 Complete: {len(complete_list)} items -> {COMPLETE_FILE}")
    print(f"   📝 Prepare : {len(prepare_list)} items -> {PREPARE_FILE}")

if __name__ == "__main__":
    main()
