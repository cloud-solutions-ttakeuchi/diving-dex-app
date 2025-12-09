import json
import collections

def find_duplicates(nodes, path="root"):
    ids = collections.defaultdict(list)
    names = collections.defaultdict(list)

    for i, node in enumerate(nodes):
        if 'id' in node:
            ids[node['id']].append(i)
        if 'name' in node:
            names[node['name']].append(i)

    # Report duplicates
    found = False
    for id_val, indices in ids.items():
        if len(indices) > 1:
            print(f"Duplicate ID '{id_val}' at {path} (bound to indices {indices})")
            found = True

    for name_val, indices in names.items():
        if len(indices) > 1:
            print(f"Duplicate Name '{name_val}' at {path} (bound to indices {indices})")
            found = True

    # Recurse
    for i, node in enumerate(nodes):
        if 'children' in node:
            if find_duplicates(node['children'], path=f"{path}[{i}]/{node.get('name', '?')}"):
                found = True

    return found

file_path = 'src/data/locations_seed.json'
with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    print("Scanning for duplicates...")
    find_duplicates(data)
