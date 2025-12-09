import json
import collections

def collect_ids(nodes, id_map, path_prefix="root"):
    for i, node in enumerate(nodes):
        current_path = f"{path_prefix}[{i}]"

        if 'id' in node:
            id_val = node['id']
            id_map[id_val].append(current_path)

        if 'children' in node:
            collect_ids(node['children'], id_map, current_path)

file_path = 'src/data/locations_structure.json'
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    id_map = collections.defaultdict(list)
    collect_ids(data, id_map)

    dup_count = 0
    for id_val, paths in id_map.items():
        if len(paths) > 1:
            print(f"Duplicate ID: {id_val}")
            for p in paths:
                print(f"  - {p}")
            dup_count += 1

    print(f"Total Duplicate IDs found: {dup_count}")

except Exception as e:
    print(f"Error: {e}")
