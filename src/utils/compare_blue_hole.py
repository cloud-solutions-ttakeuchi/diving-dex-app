import json

def find_details(nodes, target_name):
    for node in nodes:
        name = node.get('name')
        if name == target_name:
            print(f"Name: {name}")
            print(f"Parent Context: (inferred from traversal)") # Logic simplified
            # Print keys that have values
            for k, v in node.items():
                if k != 'children':
                    print(f"  {k}: {v}")
            print("-" * 20)

        if 'children' in node:
            find_details(node['children'], target_name)

file_path = 'src/data/locations_seed.json'
with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    find_details(data, "ブルーホール")
