# Test Scenarios v3.0.1 - Mobile Cross-Linking Proposals

## 1. Discovery Report (Creature -> Point)
- **Scenario**: A user reports a sighting of a creature at a new point.
- **Steps**:
    1. Navigate to a Creature Detail page.
    2. Scroll to "Spotted at" section.
    3. Tap "発見報告" (Discovery Report).
    4. Search for a Point in the modal.
    5. Select a Point.
    6. Select Rarity (e.g., Rare).
    7. Confirm submission.
- **Expected Results**:
    - Alert shows success (Pending status for regular users).
    - The point appears in the "Spotted at" list with a "提案中" (Pending) badge immediately.
    - Firestore `point_creatures` has a new document with `status: 'pending'`.

## 2. Add Species (Point -> Creature)
- **Scenario**: A user adds a confirmed species to a diving point.
- **Steps**:
    1. Navigate to a Spot Detail page.
    2. Scroll to "Confirmed Species" section.
    3. Tap "生物を追加" (Add Species).
    4. Search for a Creature in the modal.
    5. Select a Creature.
    6. Select Rarity (e.g., Common).
    7. Confirm submission.
- **Expected Results**:
    - Alert shows success.
    - The creature appears in the "Confirmed Species" grid with a "提案中" (Pending) badge.
    - Firestore `point_creatures` has a new document with `status: 'pending'`.

## 3. Feature Flag Verification
- **Scenario**: Disable the proposal feature via Feature Flag.
- **Steps**:
    1. Change `ENABLE_CROSS_LINKING_PROPOSALS` to `false` in `src/constants/index.ts`.
    2. Navigate to Spot/Creature Detail pages.
- **Expected Results**:
    - The "発見報告" and "生物を追加" buttons are hidden.
    - Existing "提案中" items are still visible if already in the database.

## 4. Wikipedia Image Search Stabilization
- **Scenario**: Search for a creature and verify image preview in Edit/Add screens.
- **Steps**:
    1. Go to "図鑑への貢献" in MyPage.
    2. Tap "生物の登録".
    3. Enter a creature name (e.g., "カクレクマノミ").
    4. Tap the search icon next to the image keyword field.
- **Expected Results**:
    - Image preview appears correctly.
    - "Wikipedia" credit and license info are auto-filled.
