import firebase_admin
from firebase_admin import credentials, firestore
import os
import argparse

def cleanup_old_mappings(project_id, dry_run=True):
    """
    Deletes point_creature mappings that were NOT created by the new AI pipeline.
    Identified by the 'method' field not being 'python-batch-v1'.
    """
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {
            'projectId': project_id,
        })

    db = firestore.client()
    pc_ref = db.collection('point_creatures')

    print(f"🧹 Starting cleanup in project: {project_id}")
    if dry_run:
        print("🧪 DRY RUN MODE: No data will be deleted.")

    # Step 1: Get all document IDs (very fast, no data fields)
    print(f"📡 Scanning all records in {project_id}...")
    all_mapping_ids = {doc.id for doc in pc_ref.select([]).stream()}
    total_count = len(all_mapping_ids)

    # Step 2: Get new pipeline document IDs
    print(f"📡 Identifying new AI mappings (python-batch-v1)...")
    new_mapping_ids = {doc.id for doc in pc_ref.where('method', '==', 'python-batch-v1').select([]).stream()}
    new_count = len(new_mapping_ids)

    # Step 3: Calculate difference
    to_delete = sorted(list(all_mapping_ids - new_mapping_ids))
    old_count = len(to_delete)

    print(f"\n📊 --- Database Summary ---")
    print(f"📈 Total Mappings in DB: {total_count}")
    print(f"✅ New AI Mappings (Keep): {new_count}")
    print(f"🗑️  Old/Other Mappings (Target): {old_count}")

    if dry_run and to_delete:
        print(f"\n🧪 Sample of IDs to be deleted (First 20):")
        for doc_id in to_delete[:20]:
            print(f"  - {doc_id}")

    if not dry_run and to_delete:
        print(f"🚀 Deleting {len(to_delete)} documents...")
        batch_size = 500
        for i in range(0, len(to_delete), batch_size):
            batch = db.batch()
            chunk = to_delete[i:i + batch_size]
            for doc_id in chunk:
                batch.delete(pc_ref.document(doc_id))
            batch.commit()
            print(f"  ✅ Committed batch {i//batch_size + 1}")

    print(f"\n✨ Cleanup finished.")
    print(f"   - Old/Other mappings found: {old_count}")
    if dry_run:
        print(f"   - To actually delete, run with --execute")
    else:
        print(f"   - Successfully deleted: {len(to_delete)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cleanup old point-creature mappings")
    parser.add_argument("--project", required=True, help="Google Cloud Project ID")
    parser.add_argument("--execute", action="store_true", help="Actually perform the deletion")

    args = parser.parse_args()
    cleanup_old_mappings(args.project, dry_run=not args.execute)
