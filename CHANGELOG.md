# Changelog

プロジェクトの変更履歴を記録します。
## [2.1.4] - 2025-12-20
### Added
- **Feature Flag & Logging System Enhancement**:
    - 全プロジェクト共通のロガーユーティリティを導入し、`LOG_LEVEL` 環境変数による一括制御を可能に。
    - 環境変数による管理に移行し、ハードコードされたプロジェクトID判定を完全に排除。
- **Testing & Documentation**:
    - `tests/TEST_SCENARIOS_v2.1.4.md` シナリオテストを策定。
    - `README.md` に `LOG_LEVEL` を含む環境変数仕様を追記。
    - `.agent/rules.md` によるAgentの行動指針（憲法）を策定。

### Updated
- **Gemini 2.0 Flash Migration**:
    - 全てのAIクレンジングエンジン（Python & Node.js）を **Gemini 2.0 Flash (`gemini-2.0-flash-001`)** にアップグレード。
    - Python版パイプラインを最新の `google-genai` SDKへ移行し、安定性と保守性を向上。
    - **Google Search Grounding (Web Search)**: 旧モデルの `googleSearchRetrieval` から、Gemini 2.0 対応の最新 `googleSearch` ツールへ刷新。
- **Reliability & Performance**:
    - **Explicit JSON Schema**: AI回答に対して強固なJSONスキーマを適用。Markdownコードブロックや不要な説明文の混入を排除し、解析エラーをゼロに。
    - **Context Caching Support**: `google-genai` SDKによる Context Cache API の正式サポートを実装。
- **Safety Guards (Cost Control)**:
    - **Smart Throttling**: Cloud Functionsからの実行時、エリア・ゾーン単位のクレンジングには特定の「生物ID」の指定を必須化。不用意な全件検索によるコスト急増を防止。
    - **Refined Default Scope**: 特定生物無指定時の検索範囲を上位5種に制限。

## [2.1.3] - 2025-12-19
### Added
- **AI Data Cleansing System (Issue #49)**: 高精度な生物マッピング・管理システムの実装
    - **2段階検証エンジン**: Gemini 1.5 Flash による物理フィルタリングと Google Search Grounding による事実確認を統合。
    - **コスト最適化 (Explicit Cache)**: Python版パイプラインにおいて Vertex AI の Context Cache API を利用し、入力トークンコストを約 75% 削減。
    - **運用自動化 (Cloud Run Jobs)**: 大規模な全件クレンジング用に Docker イメージ化し、Cloud Run Jobs および GitHub Actions ワークフローへ統合。
    - **管理者用レビューUI**: ポイント・生物の両面からAIの提案を精査できる統合レビュー画面 (`/admin/cleansing`) を実装。
    - **インクリメンタル更新**: Cloud Functions により、UIから特定のポイントや生物をピンポイントで検証可能な「オンデマンド・クレンジング」に対応。

## [v2.1.2] - 2025-12-19

### Fixed (修正)
- **CORS Conflict Resolution**:
    - **Hosting Rewrites**: Firebase Hostingの `rewrites` を利用したリバースプロキシ設定を導入。`firebase.json` で `/api/*` パスを関数へマッピングし、フロントエンド（`.tsx`）では `httpsCallable` から `fetch` による同一オリジン呼び出しへ切り替えることで、ブラウザのCORSポリシーによるブロックを完全に解消。
    - **Region Unification**: 全てのAI Cloud Functionsを `asia-northeast1` (東京) に集約。
    - **Vertex AI Location Fix**: Gemini 2.0 Flashが東京リージョン未提供（404エラー）であったため、APIの呼び出し先（Location）のみを `us-central1` に固定し、機能の安定稼働を確保。
- **Deployment Security**:
    - Cloud Functionsデプロイ時の「IAM権限付与失敗（Invoker設定）」を、カスタムドメインとHostingの同一オリジン化により、認証トークンをヘッダーに付与するセキュアな構成で解決。

### Added (追加)
- **Feature Flag (Concierge)**:
    - コンシェルジュ機能の精度向上に向けたグラウンディング化（Google検索連携）の検証を開始。高コスト化に伴う有料化検討のため、現在は管理者のみがアクセス可能なFeature Flagを導入。

## [v2.1.1] - 2025-12-19

### Added (追加)
- [x] **AI Concierge (Beta)**: 対話型スポット提案機能の実装
    - **Interactive Chat**: ユーザーの質問に対し、WeDiveデータベース内の情報を検索して最適なスポットを提案する対話型AIコンシェルジュ機能をリリース。
    - **Real-time Suggestion**: 会話の中で特定のスポットが提案されると、直感的なリンクボタン（チップ）を自動生成し、詳細ページへスムーズに誘導。
    - **Google Gemini 2.0 Flash Integration**: AIモデルに最新の `gemini-2.0-flash-exp` を採用し、高速かつ自然な日本語対話を実現。
- [x] **AI Auto-fill (Spot & Creature)**: 登録時の説明文自動生成とGoogle検索グラウンディング
    - **Draft Generation**: ポイントや生物の新規登録時に、名前を入力するだけでGemini AIが説明文（Description）を自動生成する機能を追加。
    - **Google Search Grounding**: AIが自信のない情報についてはGoogle検索を実行し、最新かつ正確な情報（出典付き）を補完する「グラウンディング」機能を実装。
- [x] **Auto-Translation**: マルチランゲージ対応（日・英・韓・中）
    - **Multilingual Support**: ポイント情報の更新トリガーにより、日本語の説明文を自動的に英語・韓国語・中国語（繁体字）に翻訳して保存するバックグラウンド処理を追加。
- [x] **High-Precision Mapping (Issue #49)**: 生物・ポイント紐付けのAIクレンジングとレビュー管理
- [ ] **AI Concierge Grounding**: コンシェルジュ検索精度の向上（管理者限定検証中）

### Improved (改善)
- **UI Visibility**:
    - **High Contrast Chat**: コンシェルジュ画面のチャット吹き出し（特にユーザー側）の配色を調整し、白背景＋グレー枠の高コントラストなデザインに変更して視認性を向上。
    - **Loading States**: AI生成中のローディング表示（アニメーション）を調整し、処理中であることが明確に伝わるように改善。

### Technical (技術的変更)
- **Cloud Functions Restructuring**:
    - AI関連の処理を独立したモジュール (`src/ai/`) に分離し、保守性を向上。
    - **Verification Logic**: 画像生成やテキスト生成の結果に対し、空文字や不正な値をフィルタリングする厳密な検証ロジックを導入。

### Fixed (修正)
- **500/404 Errors**: Vertex AIのモデル名指定ミスおよびプロジェクトID設定の不備によるAPIエラーを修正。
- **Deployment**: GitHub Actions（自動デプロイ）用のサービスアカウントに必要な権限（`Cloud Functions Developer`, `Firebase Extensions Developer`）を追加し、デプロイフローを安定化。

## [v2.0.2] - 2025-12-18

### Fixed (修正)
- **生物のロック判定（発見判定）の改善**:
    - ダイビングログのメイン生物 (`creatureId`) 뿐のみならず、一緒に記録された生物 (`sightedCreatures`) も発見済みとしてカウントされるように修正。
    - マイページのダッシュボード（マスタリー率）、図鑑ページ、ポイント詳細ページにおいて、サブ生物の記録でも正しくロックが解除されるようになりました。
- **パンくずリストのナビゲーション改善**:
    - ポイント詳細ページのパンくずリスト（地域 > エリア > 詳細エリア）のリンクを強化。
    - ポイント検索ページにおいて、URLのクエリパラメータ（region, zone, area）に基づき、正しい階層まで自動的にドリルダウンして表示する機能を追加。
    - 階層を戻る際のナビゲーション状態のリセット処理を改善。

## [v2.1.0] - 2025-12-17

### Added (追加)
- **Google Maps Integration (Registration & Display)**:
    - **Add Point**: 新しい「ポイント登録」画面にGoogle Maps連携機能を実装。`Maps JavaScript API` と `Places API (New)` を活用。
        - **Map Picker**: 地図上から正確な位置（緯度経度）を選択可能に。
        - **Text Search**: 地名検索（例: "伊豆海洋公園"）機能を追加し、検索結果からピンを自動配置。
    - **Point Detail**: ポイント詳細ページに動的なGoogle Mapを表示し、正確な位置情報を視覚化。
    - **Breadcrumbs**: ポイント詳細ページに、国・地域 > エリア > ポイント の階層リンク（パンくずリスト）を追加し、検索ページへのスムーズなナビゲーションを実現。

### Changed (変更)
- **API Modernization**:
    - **New Places API**: Google Maps Platformの新しいポリシー（2025年3月以降）に準拠するため、古い `Autocomplete` ウィジェットや `PlacesService` の使用を完全に廃止し、新しい `Place.searchByText` と `fetchFields` メソッドに移行。
- **UI Improvements**:
    - **Image Fallback**: 手動登録されたポイントで画像がない場合に、美しい代替画像 (`seascape.png`) を表示するように修正。

## [v2.0.0] - 2025-12-17

### Major Changes (メジャー変更)
- **Rebranding: "WeDive"**:
    - アプリ名を「WeDive」に正式変更（旧称: DiveDex / MarineDex）。
    - ロゴデザインを刷新（"W"をモチーフにしたウェーブデザイン）。
    - PWAマニフェスト、HTMLタイトル、パッケージ名を更新。
    - **Concept**: "Connect with divers, explore the ocean." を新タグラインとして採用。



### Fixed (修正)
- **Creature Image Fallback**:
    - 生物画像のURLが無効または空の場合に、正しいプレースホルダー画像 (`no-image-creature.png`) が表示されるように修正。
- **Copyright Credit Display**:
    - 画像の著作権クレジット（出典・ライセンス）の表示ロジックを改善。
    - **Change**: `Wikipedia` または `Creative Commons (CC)` ライセンスの場合のみクレジットを表示し、個人の写真や不明なソースの場合は非表示にするよう変更。
- **TOS Modal Persistence**:
    - **Error Handling**: 利用規約への同意時に通信エラー（Quota Exceeded等）が発生した場合、同意済みと誤判定されず、適切にエラーを表示して再試行を促すよう修正。
    - **Guest Guard**: 認証初期化中の不整合な状態（Guest User）での誤った更新処理を防止。
- **Console Warnings**:
    - Rechartsグラフ描画時の「width(-1)」警告を解消（`minWidth={0}` の追加）。

### Changed (変更)
- **Admin UX Improvement**:
    - 生物の編集・削除操作時にページ全体がリロードされる挙動を廃止。Firestoreのリアルタイム更新を活用し、スムーズな操作感を実現。
- **Admin Features**:
    - 生物データ管理画面に `Image Credit` および `Image License` の編集フィールドを追加。


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
