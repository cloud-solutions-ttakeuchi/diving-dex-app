# Changelog

プロジェクトの変更履歴を記録します。

## [v1.4.0] - 2025-12-15

### Added (追加)
- **Point & Creature Data Optimization**:
    - **Granular Generation**: ロケーション生成プロセスを `Zone` -> `Area` -> `Point` の3段階に分割し、Levenshtein距離チェックによる厳密な重複排除を実現。
    - **Family-Based Generation**: 生物データ生成を「科目（Family）」単位に再構築し、学名（Scientific Name）をキーとすることでデータの網羅性と正確性を向上。
    - **Local Rarity Logic**: ポイントごとの生物出現レアリティ（Local Rarity）を、その生物が生息するエリア数に基づいて自動計算するロジック（Common >= 12, Rare >= 5, Epic >= 2, Legendary < 2）を実装。
    - **Robust API Handling**: データ生成スクリプトに、レート制限（429 Error）を回避するためのインテリジェントな待機・ローテーションロジック（Flash/Liteモデルの使い分け）を導入。

### Changed (変更)
- **Rarity UI/UX Refinement**:
    - **Separation of Concerns**: 「その生物自体のレア度（Global Rarity）」と「ポイントでの出現レアリティ（Local Rarity）」の管理を分離。Global Rarityはシステム管理値とし、ユーザーによる編集を制限。
    - **Edit Restriction**: 生物提案時のレアリティ選択を廃止し、生物編集時のレアリティ変更を管理者（Admin）に限定。
    - **Data Correction**: 既存の全生物データに対し、エリア数に基づいた正しいGlobal Rarityを一括適用して整合性を確保。

- **Data Integrity**: 過去のデータ生成プロセスで一部欠損していた生物データ（`season` 等）のスプリット・マージによる完全復旧を実施。

## [Unreleased]

### Added (追加)
- **(2025-12-08) Admin Area Cleansing Page (`/admin/cleansing`)**:
    - エリア、ゾーン、リージョンのデータを一覧表示し、階層構造の欠落や重複を確認できる管理画面を追加。
    - **Merge Tool**: 複数の重複したエリアやゾーンを1つに統合し、関連するダイビングログやポイントデータを自動的に移行する機能を追加。
    - **Orphan Recovery**: 親情報（ZoneやRegion）が欠落しているデータを検出し、新規マスターデータとして登録または既存データへ統合する機能を追加。
- **(2025-12-11) Garmin Detailed Import (V1)**:
    - Garminデバイスからエクスポートした **ZIPファイル** を直接インポート可能になりました。
    - **詳細データの取得**: JSONデータを解析し、ダイブ本数、バディ名、タンク酸素濃度(O2%)、水域タイプ（海水/淡水）、エントリータイプ等の詳細情報を自動入力します。
    - **Map Display**: ログに詳細な緯度経度が含まれる場合、詳細画面にGoogleマップを表示するセクションを追加。
    - **Detailed UI**: ログ詳細画面に「コンディション」「器材・タンク」の詳細表示を拡張。
- **(2025-12-13) Legal Compliance Flow (Issue #12)**:
    - **Note**: This feature is released as part of **v1.3.0**.
    - **Terms & Privacy Pages**: 静的な利用規約 (`/terms`) およびプライバシーポリシー (`/privacy`) ページを追加。
    - **Mandatory Agreement**:
        - **New Users**: 会員登録時に規約への同意を必須化。拒否した場合は登録を中止（ログアウト）。
        - **Existing Users**: 規約更新時に再同意を要求。拒否した場合は即時退会（データ全削除）。
        - **Deletion Policy**: 利用規約およびプライバシーポリシーへの同意撤回（退会）時に、ユーザーに関連する全てのデータ（ログ、プロフィール、お気に入り等）を物理削除する仕様を明記・実装。
            - **Security Specification (auth/requires-recent-login)**:
                - **Client Side (App)**: ユーザー本人によるアカウント削除操作は重大なリスクを伴うため、Firebase Authenticationの仕様により「直近での再認証」が厳密に要求されます。セッションが古い場合はエラーとなり、再ログインを促すフローを実装しています。（Google規定：本人の意思確認のため、危険な操作には再度のパスワード入力等を要求する）
                - **Admin Side**: 管理者による操作は、既に強固な認証を経ているシステム管理者権限として信頼されるため、この制限の対象外となります。
    - **Versioning**: 規約のバージョン管理 (`v1.0.0`) を導入し、将来の改定時にのみ再同意を求める仕組みを実装。
    - **User Status**: 会員ステータス管理機能を追加。
        - `provisional` (仮会員): 新規登録直後、規約未同意の状態。
        - `active` (正規会員): 規約に同意し、サービスを利用可能な状態。
        - `suspended` (一時停止): 規約違反等により利用が制限された状態。
        - `withdrawn` (退会): 退会処理済み（現在は即時削除のためデータ上には残らないが、将来的な論理削除のために定義）。

### Fixed (修正)
- **(2025-12-09) Data Persistence (データの巻き戻り修正)**:
    - アプリ起動・ログイン時に、編集済みのFirestoreデータが初期JSONデータで上書きされてしまう問題（自動Seederの誤動作）を修正しました。
- **Duplicate Area Handling**:
    - 同名のエリアが存在する場合に、編集や削除が正しく行えない（意図しないエリアが対象になる）問題を修正。内部IDによる厳密な識別処理を導入。
- **Merge Modal Filtering**:
    - エリア統合画面において、統合先（Target）の候補リストに「異なるゾーンのエリア」が表示されないよう、親ゾーンが一致するもののみを表示するフィルターを追加。
- **Build Errors**:
    - 未使用変数 (`label`, `pData`) によるTypeScriptのコンパイルエラーを解消。

### Changed (変更)
- **(2025-12-10) Rendering Logic**:
    - 管理画面のリスト表示において、集計キーを「名前(Name)」から「ユニークキー(ID/Key)」に変更し、同名データの表示崩れを解消。

### Security (セキュリティ対応)
- **(2025-12-13) Dependency Update (React)**:
    - React Server Components に関する脆弱性 (CVE-2025-55182) への対応として、React関連パッケージのバージョンを更新しました。
    - **Changes**: `v19.2.0` -> `v19.2.3`
    - **Packages**: `react`, `react-dom`

---

## v1.0.0 - Initial Release
- Basic Log Recording
- Creature Dex
- Map View
