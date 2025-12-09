import json

file_path = 'src/data/locations_seed.json'
with open(file_path, 'r', encoding='utf-8') as f:
    rawLocations = json.load(f)

print("--- Regions in Seed ---")
for r in rawLocations:
    print(f"Name: {r.get('name')}, ID: {r.get('id')}")

print("\n--- Zones Check ---")
for r in rawLocations:
    for z in r.get('children', []):
         if z.get('name') in ['沖縄本島', 'パラオ', 'タヒチ島']: # Palau is a region or zone?
             print(f"Zone: {z.get('name')}, ID: {z.get('id')}, Parent: {r.get('name')}")

print("\n--- Palau Check ---")
# Check if Palau is region or zone
palau = next((r for r in rawLocations if r.get('name') == 'パラオ'), None)
if palau:
    print(f"Palau is Region. ID: {palau.get('id')}")
else:
    print("Palau not found as Region.")

print("\n--- French Polynesia Check ---")
fp = next((r for r in rawLocations if r.get('name') == 'フレンチポリネシア'), None)
if fp:
    print(f"French Polynesia is Region. ID: {fp.get('id')}")
else:
    print("French Polynesia not found as Region.")
