import json
import os
import shutil

# Files
# Files
BACKUP_FILE = "src/data/backup/creatures_seed.bak.json"
CURRENT_FILE = "src/data/creatures_seed.json"
OUTPUT_FILE = "src/data/creatures_seed.json"

def main():
    print("🔄 Starting Data Restoration...")

    if not os.path.exists(BACKUP_FILE):
        print(f"❌ Backup file not found: {BACKUP_FILE}")
        return

    if not os.path.exists(CURRENT_FILE):
        print(f"❌ Current file not found: {CURRENT_FILE}")
        return

    # Load Data
    with open(BACKUP_FILE, 'r', encoding='utf-8') as f:
        backup_data = json.load(f)

    with open(CURRENT_FILE, 'r', encoding='utf-8') as f:
        current_data = json.load(f)

    print(f"📂 Loaded Backup: {len(backup_data)} items")
    print(f"📂 Loaded Current: {len(current_data)} items")

    # Index Backup by ID and Name for robust matching
    backup_map_id = {c.get("id"): c for c in backup_data if c.get("id")}
    backup_map_name = {c.get("name"): c for c in backup_data if c.get("name")}

    restored_count = 0

    # Fields to restore strictly from backup if missing or to enforce
    # We want to keep ALL fields from backup that are missing in current

    for current_c in current_data:
        c_id = current_c.get("id")
        c_name = current_c.get("name")

        # Find match
        backup_c = backup_map_id.get(c_id)
        if not backup_c:
            backup_c = backup_map_name.get(c_name)

        if backup_c:
            # Merge Logic:
            # 1. Preserve critical new fields in Current: 'areas', 'regions' (if updated), 'image' (if updated)
            # 2. Restore everything else from Backup

            # List of keys present in Backup
            for key, val in backup_c.items():
                # specific handling for 'imageUrl' vs 'image'
                if key == "imageUrl":
                    # If current has no 'image', use backup 'imageUrl' as 'image'
                    if not current_c.get("image"):
                        current_c["image"] = val
                    continue

                if key == "regions":
                    # If current has regions, keep them (likely newer mapping)
                    # If current has NO regions, use backup
                    if not current_c.get("regions"):
                         current_c["regions"] = val
                    continue

                # For all other fields (stats, tags, depthRange, etc.)
                # If key is NOT in current, copy from backup
                if key not in current_c:
                    current_c[key] = val

                # Special Case: 'rarity'
                # Backup has "rarity": "Common" AND "stats": {"rarity": 20}
                # Current might have lost "rarity" string.
                if key == "rarity" and "rarity" not in current_c:
                     current_c[key] = val

            restored_count += 1
        else:
            print(f"⚠️ No backup match found for: {c_name} ({c_id})")

    # Save
    # Backup the current BROKEN file just in case, before overwriting
    failed_backup_path = CURRENT_FILE + ".broken_schema.bak"
    shutil.copy(CURRENT_FILE, failed_backup_path)
    print(f"📦 Backed up current (broken) file to: {failed_backup_path}")

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(current_data, f, indent=2, ensure_ascii=False)

    print(f"✅ Restoration Complete. Merged data for {restored_count} creatures.")
    print("Please verify the output file.")

if __name__ == "__main__":
    main()
