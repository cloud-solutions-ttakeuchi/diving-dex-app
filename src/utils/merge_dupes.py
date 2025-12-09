import json
import sys

# Mapping for semantic duplicates (Old Key -> New Key to keep)
ALIASES = {
    '伊豆': '伊豆半島',
    # Add others if found different names, e.g. 'Amami' vs 'Amami Oshima'?
    # Hierarchy showed '奄美群島' twice (same name), so exact match handles it.
}

def normalize_name(name):
    return ALIASES.get(name, name)

def merge_recursively(nodes):
    # Map normalized_name -> existing_node_index
    name_to_index = {}
    merged_nodes = []

    for node in nodes:
        raw_name = node.get('name')
        if not raw_name:
            merged_nodes.append(node)
            continue

        name = normalize_name(raw_name)

        if name in name_to_index:
            # Duplicate found! Merge into existing
            existing_index = name_to_index[name]
            existing_node = merged_nodes[existing_index]

            # 1. Update simple properties (prefer non-empty from current node if existing is empty)
            # Or should we prefer the NEW node (this one) or OLD node (list order)?
            # Assuming list order: First one is kept.
            # If User appended new data, the New data is later.
            # If User wants to "update" (as they said "updated seed"), maybe we should overwrite existing with new props?
            # Let's overwrite existing properties with New properties if New are present.

            # Update attributes (except children)
            for k, v in node.items():
                if k == 'children':
                    continue
                # Overwrite
                existing_node[k] = v

            # 2. Merge children
            new_children = node.get('children', [])
            if 'children' not in existing_node:
                existing_node['children'] = []

            existing_node['children'].extend(new_children)

            print(f"Merged duplicate: {raw_name} -> {existing_node['name']}")

        else:
            # New unique name
            # Update name if aliased
            if raw_name in ALIASES:
                node['name'] = ALIASES[raw_name]
                print(f"Renamed: {raw_name} -> {node['name']}")

            merged_nodes.append(node)
            name_to_index[name] = len(merged_nodes) - 1

    # After merging siblings, recurse into children of each merged node
    for node in merged_nodes:
        if 'children' in node and node['children']:
            node['children'] = merge_recursively(node['children'])

    return merged_nodes

file_path = 'src/data/locations_seed.json'

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"Original root count: {len(data)}")

    # Check if 'Japan' has duplicates in Root?
    # Our hierarchy showed 'Japan' is unique root. Duplicates are inside.
    # But recursive function handles root list too.

    cleaned_data = merge_recursively(data)

    print(f"Final root count: {len(cleaned_data)}")

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(cleaned_data, f, indent=2, ensure_ascii=False)

    print("Merge complete.")

except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
