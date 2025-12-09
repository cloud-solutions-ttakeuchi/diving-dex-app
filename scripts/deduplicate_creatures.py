import json

SOURCE_FILE = 'src/data/creatures_real.json'

def main():
    try:
        with open(SOURCE_FILE, 'r') as f:
            data = json.load(f)

        seen_ids = set()
        cleaned_data = []
        removed_count = 0

        print("Scanning for duplicates...")
        for item in data:
            cid = item.get('id')
            if not cid:
                # Should not happen but good to handle
                cleaned_data.append(item)
                continue

            if cid in seen_ids:
                print(f"Removing duplicate: {item.get('name')} (ID: {cid})")
                removed_count += 1
            else:
                seen_ids.add(cid)
                cleaned_data.append(item)

        if removed_count > 0:
            with open(SOURCE_FILE, 'w') as f:
                json.dump(cleaned_data, f, indent=2, ensure_ascii=False)
            print(f"Success: Removed {removed_count} duplicates. Saved to {SOURCE_FILE}")
        else:
            print("No duplicates found.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    main()
