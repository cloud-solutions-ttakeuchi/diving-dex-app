import json
import os

# --- 設定 ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "src/data")
CREATURES_FILE = os.path.join(DATA_DIR, "creatures_seed.json")

def main():
    if not os.path.exists(CREATURES_FILE):
        print(f"❌ Error: File not found: {CREATURES_FILE}")
        return

    print("🚀 Updating Base Rarity based on Area Count Logic...")

    with open(CREATURES_FILE, 'r', encoding='utf-8') as f:
        creatures = json.load(f)

    updated_count = 0

    # Distribution Counters
    stats = {"Common": 0, "Rare": 0, "Epic": 0, "Legendary": 0}

    for c in creatures:
        areas = c.get("areas", [])
        area_count = len(areas)

        # Logic: (Strict, No Random factor for Base Rarity)
        if area_count >= 12:
            new_rarity = "Common"
        elif area_count >= 5:
            new_rarity = "Rare"
        elif area_count >= 2:
            new_rarity = "Epic"
        else:
            new_rarity = "Legendary"

        # Update Rarity
        original_rarity = c.get("rarity")

        # Only count if changed (optional, but good for log)
        if original_rarity != new_rarity:
            updated_count += 1

        c["rarity"] = new_rarity

        # Also update stats.rarity (number) for sorting compatibility
        # Common: 25, Rare: 50, Epic: 75, Legendary: 95 approximately
        rarity_score_map = {
            "Common": 20,
            "Rare": 50,
            "Epic": 80,
            "Legendary": 95
        }

        if "stats" in c:
            c["stats"]["rarity"] = rarity_score_map[new_rarity]
        else:
             c["stats"] = {
                "rarity": rarity_score_map[new_rarity],
                "popularity": 50, "size": 50, "danger": 0, "lifespan": 50, "speed": 50 # Defaults
             }

        stats[new_rarity] += 1

    # Save
    with open(CREATURES_FILE, 'w', encoding='utf-8') as f:
        json.dump(creatures, f, indent=2, ensure_ascii=False)

    print(f"✅ Updated {updated_count} creatures.")
    print("\n--- New Base Rarity Distribution ---")
    for r, count in stats.items():
        pct = (count / len(creatures)) * 100
        print(f"{r:<10}: {count:>3} ({pct:.1f}%)")

if __name__ == "__main__":
    main()
