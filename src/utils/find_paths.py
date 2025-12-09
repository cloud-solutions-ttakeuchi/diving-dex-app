import json

def find_paths(nodes, target_name, current_path=[]):
    for node in nodes:
        name = node.get('name')
        new_path = current_path + [name]

        if name == target_name:
            print("Found:", " > ".join(str(p) for p in new_path))

        if 'children' in node:
            find_paths(node['children'], target_name, new_path)

file_path = 'src/data/locations_seed.json'
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"Searching for 'ブルーホール' in {file_path}...")
    find_paths(data, "ブルーホール")

except Exception as e:
    print(f"Error: {e}")
