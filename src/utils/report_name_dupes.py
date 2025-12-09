import json
import collections

def collect_names(nodes, name_map, path_prefix=""):
    for node in nodes:
        name = node.get('name')
        if name:
            current_path = f"{path_prefix} > {name}" if path_prefix else name
            name_map[name].append(current_path)

        if 'children' in node:
            collect_names(node['children'], name_map, current_path)

file_path = 'src/data/locations_seed.json'
with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

name_map = collections.defaultdict(list)
collect_names(data, name_map)

print("--- Duplicate Names Report ---")
count = 0
for name, paths in name_map.items():
    if len(paths) > 1:
        # Filter for interesting ones (e.g. > 1 occurrence)
        # We might want to group by Region to see if they are in the same region
        print(f"Name: {name} ({len(paths)})")
        for p in paths:
            print(f"  - {p}")
        count += 1
        print("-" * 20)

print(f"Total Names repeated: {count}")
