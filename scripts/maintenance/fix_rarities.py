import firebase_admin
from firebase_admin import credentials, firestore
import os
import sys

# --- Configuration ---
PROJECT_ID = (
    os.environ.get("GOOGLE_CLOUD_PROJECT") or
    os.environ.get("GCLOUD_PROJECT") or
    os.environ.get("VITE_FIREBASE_PROJECT_ID")
)

if not PROJECT_ID:
    print("❌ FATAL: PROJECT_ID is not set.")
    sys.exit(1)

# Initialize Firestore
if not firebase_admin._apps:
    firebase_admin.initialize_app(options={'projectId': PROJECT_ID})
db = firestore.client()

def normalize_rarity(rarity_text):
    """Ensure rarity is a valid enum value by searching for keywords."""
    valid_rarities = ["Common", "Rare", "Epic", "Legendary"]
    if not rarity_text:
        return "Rare"

    text = str(rarity_text).lower()
    # Search for exact matches first
    for r in valid_rarities:
        if r.lower() in text:
            return r

    return "Rare"

def fix_rarities():
    print(f"🚀 Starting maintenance batch to fix point_creatures rarities in project: {PROJECT_ID}")

    collection_ref = db.collection('point_creatures')
    docs = collection_ref.stream()

    count = 0
    updated = 0

    batch = db.batch()
    batch_count = 0

    for doc in docs:
        data = doc.to_dict()
        old_rarity = data.get('localRarity')

        if not old_rarity:
            continue

        new_rarity = normalize_rarity(old_rarity)

        # Only update if it changed or was an invalid long string
        if old_rarity != new_rarity or len(str(old_rarity)) > 15:
            print(f"  Fixing {doc.id}: '{str(old_rarity)[:30]}...' -> {new_rarity}")
            batch.update(collection_ref.document(doc.id), {'localRarity': new_rarity})
            updated += 1
            batch_count += 1

        count += 1

        if batch_count >= 400:
            print("💾 Committing batch...")
            batch.commit()
            batch = db.batch()
            batch_count = 0

    if batch_count > 0:
        print("💾 Committing final batch...")
        batch.commit()

    print(f"✅ Maintenance complete. Total scanned: {count}, Total updated: {updated}")

if __name__ == "__main__":
    fix_rarities()
