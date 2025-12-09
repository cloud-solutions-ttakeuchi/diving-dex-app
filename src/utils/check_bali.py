import json

def check_bali(data):
    bali = next((r for r in data if r['name'] == 'バリ'), None)
    if not bali: return

    for z in bali.get('children', []):
        print(f"Zone: {z['name']}, Type: {z.get('type')}, Children: {len(z.get('children', []))}")

file_path = 'src/data/locations_seed.json'
with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    check_bali(data)
