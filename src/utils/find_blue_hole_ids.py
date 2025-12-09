import json

def find_ids(nodes, target_name, current_path=[]):
    for node in nodes:
        name = node.get('name')
        new_path = current_path + [name]

        if name == target_name:
            print(f"Name: {name}, ID: {node.get('id')}, Path: {' > '.join(str(p) for p in new_path)}")

        if 'children' in node:
            find_ids(node['children'], target_name, new_path)

file_path = 'src/data/locations_seed.json'
with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    find_ids(data, "ブルーホール")
