# Test Scenarios v2.2.10

## 1. AI Data Cleansing Pipeline (Rarity Normalization)
- [ ] **Scenario**: Run `scripts/cleansing_pipeline.py`.
- [ ] **Expectation**: Even if the AI output for `rarity` is descriptive (e.g., "Rare due to..."), the script should store only "Rare" in Firestore.
- [ ] **Verification**: Check Firestore `point_creatures` collection for any new entries and verify `localRarity` is one of `Common`, `Rare`, `Epic`, `Legendary`.

## 2. Maintenance Script (Rarity Fixer)
- [ ] **Scenario**: Run `scripts/maintenance/fix_rarities.py`.
- [ ] **Expectation**: Documents with `localRarity` longer than 15 characters are identified and normalized.
- [ ] **Verification**: Confirm no `point_creatures` documents have `localRarity` values that are long descriptive sentences.

## 3. Point Detail Page (Inhabitants Filtering)
- [ ] **Scenario**: Open a point detail page (e.g., `/point/p123`).
- [ ] **Expectation**: Creatures with `status: 'rejected'` are NOT displayed in the inhabitants list.
- [ ] **Verification**: Verify that only `approved`, `pending`, and `deletion_requested` creatures are visible.

## 4. Admin Review Engine (Bulk Actions & Filters)
- [ ] **Scenario**: Open `/admin/cleansing`.
- [ ] **Expectation**:
    - [ ] "却下・削除済み" checkbox shows items with `status: 'rejected'` or `'deletion_requested'`.
    - [ ] "Check Group" button selects all items in the group.
    - [ ] Clicking "Uncheck Group" (when all are selected) deselects all items in the group.
    - [ ] "全解除" button at the top clears all selections across groups.
- [ ] **Verification**: Confirm manual selection/deselection and bulk actions function correctly.
