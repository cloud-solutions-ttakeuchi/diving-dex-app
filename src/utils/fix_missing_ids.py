import json
import hashlib
import sys

def generate_id(prefix, name):
    # Create a stable ID based on name hash
    hash_obj = hashlib.md5(name.encode('utf-8'))
    hash_hex = hash_obj.hexdigest()[:10]
    return f"{prefix}_{hash_hex}"

def fix_ids(nodes, level=0):
    count = 0
    for node in nodes:
        if 'id' not in node or not node['id']:
            # Determine prefix based on level or type
            # Level 0: Region (r)
            # Level 1: Zone (z)
            # Level 2: Area (a)
            # Level 3: Point (p)

            prefix = 'u' # unknown
            if level == 0: prefix = 'r'
            elif level == 1: prefix = 'z'
            elif level == 2: prefix = 'a'
            elif level == 3: prefix = 'p'

            # Use 'type' hint if available
            if node.get('type') == 'Region': prefix = 'r'
            elif node.get('type') == 'Zone': prefix = 'z'
            elif node.get('type') == 'Area': prefix = 'a'
            elif node.get('type') == 'Point': prefix = 'p'

            new_id = generate_id(prefix, node.get('name', 'unnamed'))
            node['id'] = new_id
            count += 1
            # print(f"Generated ID for {node.get('name')}: {new_id}")

        if 'children' in node:
            count += fix_ids(node['children'], level + 1)

    return count

file_path = 'src/data/locations_seed.json'
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"Checking IDs in {file_path}...")
    fixed_count = fix_ids(data)

    if fixed_count > 0:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Successfully added IDs to {fixed_count} nodes.")
    else:
        print("No missing IDs found.")

except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
