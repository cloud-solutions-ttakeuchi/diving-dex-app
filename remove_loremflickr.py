
import json
import os

FILES_TO_CLEAN = [
    "src/data/locations_seed.json",
    "src/data/creatures_seed.json",
    "src/data/creatures_real.json"
]

def clean_obj(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "image" or k == "imageUrl":
                if isinstance(v, str) and "loremflickr.com" in v:
                    obj[k] = ""
                    # print(f"Cleaned {k} in object")
            if isinstance(v, (dict, list)):
                clean_obj(v)
    elif isinstance(obj, list):
        for item in obj:
            clean_obj(item)

def main():
    cleaned_count = 0
    for file_path in FILES_TO_CLEAN:
        if not os.path.exists(file_path):
            print(f"Skipping {file_path} (not found)")
            continue

        print(f"Processing {file_path}...")
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            clean_obj(data)

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            print(f"cleaned {file_path}")
        except Exception as e:
            print(f"Error processing {file_path}: {e}")

if __name__ == "__main__":
    main()
