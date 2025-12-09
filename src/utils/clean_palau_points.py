import json
import sys

def clean_palau(data):
    # Target: Palau > Rock Islands > Blue Corner surroundings (id: p_a_1765003017_0_1_2_1) - KEEP
    # Remove: Palau > Koror > Malakal Harbor > Blue Hole
    # Remove: Palau > Rock Islands > Big Dropoff surroundings > Blue Hole

    # Also clean Sandbar if feasible, but let's focus on Blue Hole first as requested.

    palau = next((r for r in data if r['name'] == 'パラオ'), None)
    if not palau:
        print("Palau not found")
        return False

    removed_count = 0

    # helper to find and remove
    def remove_child_by_name(parent_node, child_name):
        initial_len = len(parent_node.get('children', []))
        parent_node['children'] = [c for c in parent_node.get('children', []) if c['name'] != child_name]
        removed_len = len(parent_node.get('children', []))
        return initial_len - removed_len

    # 1. Koror > Malakal Harbor
    koror = next((z for z in palau.get('children', []) if z['name'] == 'コロール'), None)
    if koror:
        malakal = next((a for a in koror.get('children', []) if a['name'] == 'マラカル港'), None)
        if malakal:
            removed = remove_child_by_name(malakal, 'ブルーホール')
            if removed:
                print(f"Removed Blue Hole from Malakal Harbor")
                removed_count += removed

    # 2. Rock Islands > Big Dropoff
    rock = next((z for z in palau.get('children', []) if z['name'] == 'ロックアイランド'), None)
    if rock:
        big_drop = next((a for a in rock.get('children', []) if a['name'] == 'ビッグドロップオフ周辺'), None)
        if big_drop:
            removed = remove_child_by_name(big_drop, 'ブルーホール')
            if removed:
                print(f"Removed Blue Hole from Big Dropoff")
                removed_count += removed

        # Ensure Blue Corner HAS it
        blue_corner = next((a for a in rock.get('children', []) if a['name'] == 'ブルーコーナー周辺'), None)
        if blue_corner:
            bh = next((p for p in blue_corner.get('children', []) if p['name'] == 'ブルーホール'), None)
            if bh:
                print("Confirmed Blue Hole exists in Blue Corner (Keep).")
            else:
                print("WARNING: Blue Hole NOT found in Blue Corner!")

    return removed_count

file_path = 'src/data/locations_seed.json'
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    count = clean_palau(data)

    if count > 0:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Successfully removed {count} duplicate Blue Hole entries.")
    else:
        print("No changes made (maybe already cleaned?).")

except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
