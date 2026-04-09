# beat-motivator

## これはなに？

URL: https://beat-motivator.norimiso.workers.dev/

BPI を作った人間が BPI にいじめられはじめたので IIDX のモチベを維持するための新しい何かを作ろうとしているものです。

BPI のように自分の武器を測るのではなく、日々の成長を記録するためのものにしたいなと思ったりはしてます。

## どういう機能がほしいの

- 100%, 99.5%, 99%, 98.5%... を達成した曲をレベル別とかに集計したい
- 2 桁落ち、1 桁落ち、MAX-、AAA (AA,A) の達成も管理したい
- まぁやっぱり BPI も見れるようにはしたい
- 毎日の成長をあとから見れるようにしたい
- ゆくゆくは BPI manager さんのようにローカルにデータ持っておきたい

## ローカル開発手順
1. Dockerが入っていなければインストールする https://www.docker.com/get-started
2. コマンドからプロジェクトディレクトリ(docker-compose.ymlがあるディレクトリ)に移動する
3. ```docker-compose up -d```を実行
4. http://localhost:8080/ にアクセス
5. 画面が表示されたらOK

## マスター更新 / CSV検証

- 公式CSVを使った照合チェック
  - `npm run check:csv`
  - unresolved を許容しないチェック: `npm run check:csv:strict`
- 30ASA Reborn 側から master を取り込む
  - 取り込みのみ: `npm run master:pull`
  - textage から最新取得してから取り込み: `npm run master:sync`
- 全自動（textage更新→取り込み→CSV厳密チェック→build）
  - `npm run master:auto`
  - そのままデプロイまで: `npm run master:auto:deploy`
- `check:csv` で unresolved が残る場合は、textage 未反映の新曲を疑い、BemaniWiki 等で譜面情報を確認して master 更新対象にする

## TODO: AI Advisor (beat-advisor)

Cloudflare Agent SDK + Workers AI を使った練習アドバイザー機能。
設計詳細は `docs/AI_ADVISOR_DESIGN.md` を参照。

### Phase 1: MVP
- [ ] `beat-advisor` Worker プロジェクトの雛形作成 (Agent SDK starter ベース)
- [ ] AIChatAgent 実装 (IIDX ドメイン知識のシステムプロンプト)
- [ ] AdvisorContext 型定義 & ビルダー (集計結果 → AI 入力)
- [ ] Rank 推定ロジック (レベル別クリアランプ分布からルールベース推定)
- [ ] beat-motivator から beat-advisor へのデータ受け渡し (postMessage)
- [ ] beat-motivator の CSV 入力欄下に iframe 埋め込み
- [ ] 初回自動レポート + チャットで深掘り (ハイブリッド方式)

### Phase 2: 分析強化
- [ ] Server-side tools: analyzeScore / suggestPractice / lookupChart
- [ ] `seed/chart_tags.json` 初期セット作成 (皿/CN/ソフラン/ジャリ/ズレハネ)
- [ ] BPM 分布分析 & ソフラン曲特定 (bpm_min != bpm_max)
- [ ] 分析チェックリストの調整 (高難度チャレンジ度、FC 埋め、スコア詰め、BPM 偏り、属性バランス)
- [ ] システムプロンプト改善

### Phase 3: セキュリティ & 運用
- [ ] API キー認証
- [ ] AI Gateway 統合 (レート制限、認証 cf-aig-authorization、キャッシュ)
- [ ] コスト監視
- [ ] モデル切替 (Gemma 4 / Kimi K2.5 / GLM 4.7 Flash)

### Phase 4: 拡張 (将来)
- [ ] 譜面タグ付け補助ツール (ローカル CLI / Web UI)
- [ ] 成長曲線 × AI アドバイスの連携 (時系列分析)
- [ ] DP 対応

---

## これまで

2.1.0 サンプルCSV表示、履歴 export/import、共有文面コピー、モバイル向け compact 表示列切替を追加しました
2.0.1 CSV とマスターの曲名表記ゆれを吸収する正規化マッチを追加し、SPL 含む譜面照合の漏れを改善しました
0.2.0 Prettier を村松さんに追加していただいたりしました(ありがとうございます)
0.1.0 CSV を読み込んで、各レベルの統計情報、スコアレート順のプレー済みの曲を表示する機能を追加しました
0.0.1 AA (SPA) の点数が分かるようになりました
