import json

def print_hierarchy(nodes, level=0):
    indent = "  " * level
    for node in nodes:
        name = node.get('name', 'NO_NAME')
        type_ = node.get('type', 'Unknown')
        print(f"{indent}- {name} ({type_})")
        if 'children' in node:
            print_hierarchy(node['children'], level + 1)

file_path = 'src/data/locations_seed.json'
with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    print_hierarchy(data)
