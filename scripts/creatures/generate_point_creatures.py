import json
import os
import random

# --- 設定 ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "src/data")

CREATURES_FILE = os.path.join(DATA_DIR, "creatures_seed.json")
LOCATIONS_FILE = os.path.join(DATA_DIR, "locations_seed.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "point_creatures_seed.json")

# レアリティの重み付け (baseRarity -> localRarityの変動確率)
RARITY_LEVELS = ["Common", "Rare", "Epic", "Legendary"]

def get_rarity_index(rarity):
    try:
        if not rarity: return 0
        return RARITY_LEVELS.index(rarity)
    except ValueError:
        return 0 # Default to Common

def determine_local_rarity(base_rarity, area_count=None):
    """
    ベースレアリティと生息エリア数を元に、そのポイントでのレアリティを決定する。
    area_count (生息しているエリアの総数) が多いほど Common になりやすく、少ないほど Legendary になりやすい。
    """
    base_idx = get_rarity_index(base_rarity)

    # Area Count Based Logic (Override Base Rarity if area_count provided)
    if area_count is not None:
        if area_count >= 12:
            calc_rarity = "Common"
        elif area_count >= 5:
            calc_rarity = "Rare"
        elif area_count >= 2:
            calc_rarity = "Epic"
        else:
            calc_rarity = "Legendary"

        # Calculate index from this calculated rarity
        base_idx = get_rarity_index(calc_rarity)

    # ランダム要素 (0.0 to 1.0) で多少揺らぎを持たせる
    rand = random.random()

    if rand < 0.8:
        # 80%の確率で計算通り
        return RARITY_LEVELS[base_idx]
    elif rand < 0.95:
        # 15%の確率で1段階変動 (±1)
        shift = random.choice([-1, 1])
        new_idx = max(0, min(len(RARITY_LEVELS) - 1, base_idx + shift))
        return RARITY_LEVELS[new_idx]
    else:
        # 5%の確率で2段階変動
        shift = random.choice([-2, 2])
        new_idx = max(0, min(len(RARITY_LEVELS) - 1, base_idx + shift))
        return RARITY_LEVELS[new_idx]

import argparse
import shutil
# ... (imports remain)
import json
import os
import random

# ... (imports/constants up to main)

def main():
    parser = argparse.ArgumentParser(description="Generate Point-Creature associations.")
    parser.add_argument("--mode", choices=["append", "overwrite", "clean"], default="append",
                        help="Mode: append (keep existing, add new), overwrite (replace file content), clean (backup & clear first).")
    args = parser.parse_args()

    if not os.path.exists(CREATURES_FILE) or not os.path.exists(LOCATIONS_FILE):
        print(f"❌ Error: Required input files not found checking: {CREATURES_FILE} and {LOCATIONS_FILE}")
        return

    # Clean mode handling
    if args.mode == "clean":
        if os.path.exists(OUTPUT_FILE):
            timestamp = int(os.path.getmtime(OUTPUT_FILE)) # or use time.time()
            backup_path = f"{OUTPUT_FILE}.{timestamp}.bak"
            shutil.move(OUTPUT_FILE, backup_path)
            print(f"🧹 Clean mode: Existing file backed up to {backup_path}")
        else:
             print("🧹 Clean mode: No existing file to backup.")

    print(f"🚀 Generating Point-Creature associations... Mode: {args.mode}")

    # Load Data
    with open(CREATURES_FILE, 'r', encoding='utf-8') as f:
        creatures = json.load(f)

    with open(LOCATIONS_FILE, 'r', encoding='utf-8') as f:
        locations = json.load(f)

    point_creatures = []
    existing_ids = set()

    # Load existing if append mode
    if args.mode == "append" and os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                point_creatures = json.load(f)
                existing_ids = {pc["id"] for pc in point_creatures}
                print(f"📂 Loaded {len(point_creatures)} existing associations (Append mode).")
        except:
            print("⚠️ Failed to load existing file, starting fresh.")

    # 1. Map Creatures for efficient lookup
    # creatures_all: Simply hold all creatures to iterate if efficient enough,
    # but we can index by Region AND Area for speed.
    # Given dataset size (~200 creatures), iterating all for each point (800) is 160,000 checks. Fast enough in Python.
    # Let's keep it simple: List of all creatures.

    # However, to maintain current structure:
    # We'll just iterate all creatures at the leaf level if they have 'areas',
    # or fallback to 'region' map for those who don't.

    # 2. Iterate through Location Hierarchy to find Points
    total_points = 0
    new_links_count = 0

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
                                # Type check
                                if point_obj.get("type") and point_obj.get("type") != "Point": continue
                                point_id = point_obj.get("id")
                                if not point_id: continue

                                total_points += 1

                                # Find potential creatures
                                potential_creatures = []

                                for c in creatures:
                                    # Strategy:
                                    # 1. If 'areas' exists and is not empty, perform Exact Area Match.
                                    # 2. If 'areas' is empty, fallback to Region Fuzzy Match.

                                    c_areas = c.get("areas", [])
                                    c_regions = c.get("regions", [])

                                    is_candidate = False

                                    if c_areas:
                                        # Strict Match: Point's Area must be in creature's area list
                                        if area_name in c_areas:
                                            is_candidate = True
                                    elif c_regions:
                                        # Fallback Fuzzy Match
                                        for r in c_regions:
                                            if (r in region_name) or (r in zone_name) or (r in area_name):
                                                is_candidate = True
                                                break

                                    if is_candidate:
                                        potential_creatures.append(c)

                                # Deduplicate by ID (Already unique in list iteration but safe to keep logic if extended)
                                unique_candidates = {c['id']: c for c in potential_creatures}.values()

                                # Generate PointCreature records
                                for c in unique_candidates:
                                    link_id = f"{point_id}_{c['id']}"

                                    # Check existence for append mode
                                    if args.mode == "append" and link_id in existing_ids:
                                        continue

                                    # Determine Rarity
                                    # Pass area count if available
                                    area_count = len(c.get("areas", [])) if c.get("areas") else None
                                    local_rarity = determine_local_rarity(c.get("baseRarity"), area_count)

                                    pc_record = {
                                        "id": link_id,
                                        "pointId": point_id,
                                        "creatureId": c['id'],
                                        "localRarity": local_rarity,
                                        "status": "approved"
                                    }
                                    point_creatures.append(pc_record)
                                    new_links_count += 1

    # Save
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(point_creatures, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Generated/Added {new_links_count} associations. Total: {len(point_creatures)} across {total_points} points.")
    print(f"   Saved to: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
