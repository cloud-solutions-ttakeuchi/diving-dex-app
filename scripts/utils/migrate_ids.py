import json
import os
import time
import hashlib

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "src/data")
TARGET_FILE = os.path.join(DATA_DIR, "locations_seed.json")

def generate_new_id(prefix: str, name: str) -> str:
    # Use strict UTF-8 encoding for hash to be consistent
    name_hash = hashlib.md5(name.encode('utf-8')).hexdigest()[:6]
    # Use current time
    timestamp = int(time.time())
    return f"{prefix}_{timestamp}_{name_hash}"

def migrate_ids():
    if not os.path.exists(TARGET_FILE):
        print(f"File not found: {TARGET_FILE}")
        return

    print(f"Reading {TARGET_FILE}...")
    with open(TARGET_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Dictionary to ensure uniqueness if needed, though hash+timestamp is pretty safe.
    # We will traverse: Region -> Zone -> Area -> Point

    count = 0

    for region in data:
        region['id'] = generate_new_id("r", region['name'])
        count += 1

        for zone in region.get('children', []):
            zone['id'] = generate_new_id("z", zone['name'])
            count += 1

            for area in zone.get('children', []):
                area['id'] = generate_new_id("a", area['name'])
                count += 1

                for point in area.get('children', []):
                    point['id'] = generate_new_id("p", point['name'])
                    count += 1

    print(f"Migrated {count} IDs.")

    with open(TARGET_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Saved to {TARGET_FILE}")

if __name__ == "__main__":
    migrate_ids()
