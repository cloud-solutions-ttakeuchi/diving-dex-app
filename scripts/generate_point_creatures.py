import json
import os
import random

# --- 設定 ---
CREATURES_FILE = "src/data/creatures_real.json"
LOCATIONS_FILE = "src/data/locations_seed.json"
OUTPUT_FILE = "src/data/point_creatures_seed.json"

# レアリティの重み付け (baseRarity -> localRarityの変動確率)
RARITY_LEVELS = ["Common", "Rare", "Epic", "Legendary"]

def get_rarity_index(rarity):
    try:
        return RARITY_LEVELS.index(rarity)
    except ValueError:
        return 0 # Default to Common

def determine_local_rarity(base_rarity):
    """
    ベースレアリティを元に、そのポイントでのレアリティを決定する。
    基本はベースと同じだが、稀に変動する（その場所では激レア、あるいは逆に普通に見れるなど）
    """
    base_idx = get_rarity_index(base_rarity)

    # ランダム要素 (0.0 to 1.0)
    rand = random.random()

    if rand < 0.7:
        # 70%の確率でベースと同じ
        return base_rarity
    elif rand < 0.9:
        # 20%の確率で1段階変動 (±1)
        shift = random.choice([-1, 1])
        new_idx = max(0, min(len(RARITY_LEVELS) - 1, base_idx + shift))
        return RARITY_LEVELS[new_idx]
    else:
        # 10%の確率で2段階変動もありうる
        shift = random.choice([-2, 2])
        new_idx = max(0, min(len(RARITY_LEVELS) - 1, base_idx + shift))
        return RARITY_LEVELS[new_idx]

def main():
    if not os.path.exists(CREATURES_FILE) or not os.path.exists(LOCATIONS_FILE):
        print("❌ Error: Input files not found.")
        return

    print("🚀 Generating Point-Creature associations...")

    # Load Data
    with open(CREATURES_FILE, 'r', encoding='utf-8') as f:
        creatures = json.load(f)

    with open(LOCATIONS_FILE, 'r', encoding='utf-8') as f:
        locations = json.load(f)

    point_creatures = []

    # 1. Map Creatures by Region for easier lookup
    # creatures_by_region = { "沖縄": [c1, c2], "伊豆": [c3] ... }
    creatures_by_region = {}

    for c in creatures:
        regions = c.get("regions", [])
        for r in regions:
            if r not in creatures_by_region:
                creatures_by_region[r] = []
            creatures_by_region[r].append(c)

    # 2. Iterate through Location Hierarchy to find Points
    for region_obj in locations:
        region_name = region_obj.get("name")

        if "children" in region_obj:
            for zone_obj in region_obj["children"]:
                zone_name = zone_obj.get("name")

                if "children" in zone_obj:
                    for area_obj in zone_obj["children"]:
                        area_name = area_obj.get("name")

                        if "children" in area_obj:
                            for point_obj in area_obj["children"]:
                                if point_obj.get("type") != "Point": continue

                                point_id = point_obj.get("id")

                                # Find potential creatures for this point
                                # Logic: Match Region, Zone, or Area name in creature's 'regions' list
                                potential_creatures = []

                                # Check matches in map keys
                                for key in creatures_by_region:
                                    if key in region_name or key in zone_name or key in area_name:
                                        potential_creatures.extend(creatures_by_region[key])

                                # Deduplicate by ID
                                unique_candidates = {c['id']: c for c in potential_creatures}.values()

                                # Generate PointCreature records
                                for c in unique_candidates:
                                    # Randomly decide if it appears at this SPECIFIC point
                                    # (Not every creature in the region is at every point)
                                    if random.random() > 0.4: # 60% chance to inhabit
                                        local_rarity = determine_local_rarity(c.get("baseRarity", "Common"))

                                        pc_record = {
                                            "id": f"{point_id}_{c['id']}",
                                            "pointId": point_id,
                                            "creatureId": c['id'],
                                            "localRarity": local_rarity,
                                            "status": "approved"
                                        }
                                        point_creatures.append(pc_record)

    # Save
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(point_creatures, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Generated {len(point_creatures)} associations.")
    print(f"   Saved to: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
