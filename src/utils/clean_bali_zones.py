import json
import sys

def clean_bali(data):
    bali = next((r for r in data if r['name'] == 'バリ'), None)
    if not bali: return 0

    # Source -> Target mapping
    moves = {
        '南部': '南部バリ',
        '東部': '東部バリ',
        '北西部': '北西部バリ',
        'ペニダ島': 'ヌサペニダ',
    }

    zones = bali.get('children', [])
    modified_count = 0

    # 1. Identify valid targets & sources
    for src_name, tgt_name in moves.items():
        src_zone = next((z for z in zones if z['name'] == src_name), None)
        tgt_zone = next((z for z in zones if z['name'] == tgt_name), None)

        if src_zone and tgt_zone:
            print(f"Merging {src_name} ({len(src_zone.get('children',[]))}) -> {tgt_name} ({len(tgt_zone.get('children',[]))})...")

            # Move children
            if 'children' not in tgt_zone:
                tgt_zone['children'] = []

            tgt_zone['children'].extend(src_zone.get('children', []))

            # Mark source for deletion (remove later)
            src_zone['_mark_delete'] = True
            modified_count += 1

    # 2. Remove marked sources
    bali['children'] = [z for z in zones if not z.get('_mark_delete')]

    return modified_count

file_path = 'src/data/locations_seed.json'
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    count = clean_bali(data)

    if count > 0:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Merged {count} Bali zones.")
    else:
        print("No Bali zones merged.")

except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
