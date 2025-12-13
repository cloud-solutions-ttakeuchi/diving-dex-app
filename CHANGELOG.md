# Changelog

プロジェクトの変更履歴を記録します。

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
