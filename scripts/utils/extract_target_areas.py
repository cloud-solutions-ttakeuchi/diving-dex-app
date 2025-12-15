import json
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
INPUT_FILE = os.path.join(BASE_DIR, "src/data/locations_seed.json")
OUTPUT_FILE = os.path.join(BASE_DIR, "scripts/config/target_areas.json")

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"File not found: {INPUT_FILE}")
        return

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    target_areas = []

    for region in data:
        region_name = region.get("name")
        if not region_name: continue

        for zone in region.get("children", []):
            zone_name = zone.get("name")
            if not zone_name: continue

            for area in zone.get("children", []):
                area_name = area.get("name")
                if not area_name: continue

                target_areas.append({
                    "region": region_name,
                    "zone": zone_name,
                    "area": area_name
                })

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(target_areas, f, indent=2, ensure_ascii=False)

    print(f"Extracted {len(target_areas)} areas to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
