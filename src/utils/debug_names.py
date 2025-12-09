import json

file_path = 'src/data/locations_seed.json'
with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    print("Japan Children Names:")
    japan = next((r for r in data if r['name'] == '日本'), None)
    if japan:
        for child in japan.get('children', []):
            print(repr(child.get('name')))
    else:
        print("Japan not found")
