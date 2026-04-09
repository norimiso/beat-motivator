# AI Advisor (beat-advisor) 設計ドキュメント

## 概要

Beat Motivator に「AI練習アドバイザー」機能を追加する。
プレイヤーの e-amusement CSV データを分析し、現在の実力を推定したうえで、次に何を練習すべきかを提案する。

**デモ目的**:
- Cloudflare **Agent SDK** (Durable Object ベースのステートフル AI エージェント)
- Cloudflare **Workers AI** の新世代モデル (Gemma 4, Kimi K2.5 等)
- Cloudflare **AI Gateway** (レート制限、認証、コスト管理)

---

## アーキテクチャ

```
+---------------------------+        +-----------------------------+
|   beat-motivator          |        |   beat-advisor              |
|   (Astro SSR on Workers)  |        |   (Agent SDK on Workers)    |
|                           |        |                             |
|  index.astro              |  HTTP/ |  AIChatAgent                |
|    CSV input              | -----> |    (Durable Object)         |
|    Aggregate results      |  WS    |                             |
|    Advisor chat UI        | <----- |  Workers AI                 |
|    (Vanilla JS)           |        |    Gemma 4 / Kimi K2.5     |
|                           |        |                             |
|  /api/aggregate           |        |  Server-side tools          |
|  /api/master              |        |    analyzeScore()           |
+---------------------------+        |    checkPracticeBalance()   |
                                     |    suggestNextSteps()       |
                                     |                             |
                                     |  AI Gateway                 |
                                     |    Rate limiting            |
                                     |    Authentication           |
                                     +-----------------------------+
```

### 2つの Worker に分離する理由

1. **beat-motivator** は Astro SSR (Vanilla JS)。React を使わない
2. **Agent SDK** は Durable Object ベースで、公式クライアントは React hooks (`useAgentChat`)
3. 分離することで、beat-advisor 側は Agent SDK + React のスターターをそのまま活用できる
4. beat-motivator は既存の Vanilla JS アーキテクチャを壊さずにすむ
5. デプロイ・スケーリング・コスト管理が独立して行える

### 統合方式

beat-motivator から beat-advisor への接続方式:
- **iframe 埋め込み**: beat-advisor 側に独自のチャット UI ページを用意し、beat-motivator の結果画面に iframe で埋め込む
- **データ受け渡し**: beat-motivator が集計結果を `postMessage` またはURLパラメータ経由で beat-advisor に渡す
- チャット UI は beat-advisor 側の React で実装 (Agent SDK の `useAgentChat` をそのまま利用)

---

## 使用モデル

| モデル | ID | Context | 特徴 | 価格 (per M tokens) |
|--------|-----|---------|------|---------------------|
| **Gemma 4 26B A4B** | `@cf/google/gemma-4-26b-a4b-it` | 256K | MoE、Function Calling、Reasoning、Vision | $0.10 in / $0.30 out |
| **Kimi K2.5** | `@cf/moonshotai/kimi-k2.5` | 256K | Frontier-scale、Multi-turn Tool Calling | $0.60 in / $3.00 out |
| **GLM 4.7 Flash** | `@cf/zai-org/glm-4.7-flash` | 131K | 高速、低コスト、Tool Calling | (低コスト枠) |

**推奨**: 初期開発は Gemma 4 (安価、十分な性能)。デモ時はモデル切替で Kimi K2.5 との比較も見せられる。

---

## 実力推定: Rank システム

### Rank 定義

プレイヤーの実力を 0-15+ の数値 (Rank) で表現する。
主にレベル別のクリアランプ分布から機械的に推定し、AI がさらに文脈を加味して解釈する。

| Rank | 目安 | 主な判定基準 |
|------|------|-------------|
| 0 | 級位 | ☆1-3 をプレイ中 |
| 1 | 初段 | ☆4-5 がクリアできる |
| 2-5 | 二段-五段 | ☆6-8 のクリア率が段階的に上昇 |
| 6 | 六段 | ☆9 がある程度クリアできる |
| 7 | 七段 | ☆9 の大半クリア、☆10 にクリアが出始める |
| 8 | 八段 | ☆10 のクリアが安定してくる |
| 9 | 九段 | ☆11 にクリアが出始める |
| 10 | 十段 | ☆12 に Easy 以上がちらほらある |
| 11 | 中伝 | ☆12 の半分くらいが Hard クリア |
| 12 | 皆伝(受かりたて) | ☆12 の 7 割くらいが Hard クリア |
| 13 | 上位皆伝 | ☆12 の 95% 以上が Hard クリア |
| 14 | 最上位皆伝 | ☆12 の 95%+ が EXH クリア |
| 15 | トッププレイヤー | ☆12 の 95%+ が EXH + AAA |

**補足**:
- Rank は連続値として扱ってもよい (例: Rank 11.5 = 中伝上位)
- クリアランプ割合だけでなく、スコアレートや BPI も補助的に参照
- 人間 (管理者) が基準値テーブルを調整できる構造にする
- AI には Rank の数値とその意味を system prompt で渡し、自然言語で解釈させる

### Rank 推定ロジック (ルールベース → AI 解釈)

```
入力: レベル別 LevelStats (played, cleared, hard, exh, fc, averageRate)
      ↓
  ルールベース推定: クリアランプ割合テーブルから Rank 算出
      ↓
  AI に渡すコンテキスト: Rank値 + 根拠データ + Ability スコア
      ↓
  AI が自然言語で「あなたは十段上位〜中伝入口くらいの実力です」と説明
```

---

## 譜面タグシステム

### 概要

master_songs.csv にはない譜面属性 (皿曲、CN、ソフラン等) を管理するための補助データ。
`seed/chart_tags.json` として管理し、システムプロンプトの一部として AI に渡す。

### タグカテゴリ

| タグ | 説明 | 判定方法 |
|------|------|---------|
| `scratch` | 皿が多い/連皿がある譜面 | 手動タグ付け |
| `charge_note` | CN (チャージノート) がある譜面 | 手動タグ付け |
| `soflan` | BPM 変化がある譜面 | **半自動**: `bpm_min != bpm_max` で候補抽出 + 手動確認 |
| `jari` | ジャリ押し (同時押しの密度が高い) | 手動タグ付け |
| `zure_hane` | ズレ/ハネリズム (3連符、変拍子) | 手動タグ付け |
| `high_speed` | 高速 (BPM 170-199) | **半自動**: BPM から候補抽出。倍取り等の例外は手動修正 |
| `very_high_speed` | 超高速 (BPM 200+) | **半自動**: BPM から候補抽出 |
| `low_speed` | 低速ガチ押し (BPM ~139 以下、密度が高い) | **半自動**: BPM から候補抽出 + 手動確認 |

### JSON スキーマ

```json
{
  "$schema": "chart_tags_schema",
  "version": "1.0",
  "bpm_thresholds": {
    "low_speed": { "max": 139 },
    "mid_speed": { "min": 140, "max": 169 },
    "high_speed": { "min": 170, "max": 199 },
    "very_high_speed": { "min": 200 }
  },
  "tags": {
    "scratch": [
      { "title": "灼熱Beach Side Bunny", "difficulty": "SPA", "note": "連皿" },
      { "title": "Scripted Connection⇒ A mix", "difficulty": "SPA", "note": "皿複合" }
    ],
    "charge_note": [
      { "title": "Chrono Diver -PENDULUMs-", "difficulty": "SPA", "note": "CN拘束" }
    ],
    "soflan": [
      { "title": "MENDES", "difficulty": "SPA", "note": "中盤停止→加速" }
    ],
    "jari": [],
    "zure_hane": [],
    "override_speed": [
      { "title": "Timepiece phase II", "difficulty": "SPA", "actual_speed": "high_speed", "note": "表記BPMは中速だが実質高速" },
      { "title": "3y3s", "difficulty": "SPA", "actual_speed": "very_high_speed", "note": "3連符主体で実質超高速" }
    ]
  }
}
```

**設計ポイント**:
- BPM ベースの速度分類は `bpm_thresholds` + `master_songs.csv` の BPM カラムで機械的に生成
- `override_speed` で BPM だけでは判定できない例外を手動指定
- 初期リリース時は代表曲のみ。段階的にタグを拡充する
- **タグ付け補助ツール** (ローカル CLI / Web UI) を将来的に作成

---

## AI に渡すデータ設計

### System Prompt に含める静的知識

1. **IIDX ドメイン知識**:
   - スコア体系 (EX SCORE, スコアレート, MAX-, DJ LEVEL 閾値)
   - クリアランプの序列と意味
   - BPI の概念 (皆伝平均=0, 全国トップ=100)
   - 段位認定の概要 (級位 → 初段 → ... → 皆伝)
   - Rank システムの定義と判定基準
   - 譜面属性の説明 (皿、CN、ソフラン、ジャリ、ズレハネ)

2. **練習アドバイスのフレームワーク**:
   - 高難易度チャレンジ vs 地力安定 のバランス
   - フルコン埋め (FC 狙い) の重要性
   - スコア詰め (AAA 埋め、MAX- 1桁狙い) の段階
   - 苦手属性の克服 (皿、CN、ソフラン)
   - BPM 帯の偏りを避ける

3. **代表曲リスト** (chart_tags.json のデータ):
   - 各タグカテゴリの代表曲名 → AI がユーザーのスコアデータと照合

### ユーザーごとに渡す動的データ

CSV 集計結果から以下を構造化して渡す:

```typescript
interface AdvisorContext {
  // 全体サマリー
  summary: {
    totalCharts: number;
    playedCharts: number;
    averageScoreRate: number;
    averageBpi: number | null;
    estimatedRank: number;        // ルールベース推定 Rank
    ability: AbilityScores | null;
  };

  // レベル別統計 (☆1-12)
  levelStats: Array<{
    level: number;
    total: number;
    played: number;
    playRate: number;
    averageScoreRate: number;
    clearLampDistribution: {
      fc: number;
      exh: number;
      hard: number;
      clear: number;
      easy: number;
      assist: number;
      failed: number;
      noplay: number;
    };
    djLevelDistribution: {
      aaa: number;
      aa: number;
      a: number;
      other: number;
    };
    scoreRateDistribution: {
      pct100: number;   // 100%
      pct99: number;    // 99%+
      pct98: number;    // 98%+
      pct97: number;    // 97%+
      pct96: number;    // 96%+
      pct95: number;    // 95%+
    };
    maxMinus1keta: number;  // MAX-1桁
    maxMinus2keta: number;  // MAX-2桁
  }>;

  // BPM分布 (プレイ済み曲のBPM帯ごとの曲数・平均スコアレート)
  bpmDistribution: Array<{
    range: string;           // "~139", "140-169", "170-199", "200+"
    playedCount: number;
    averageScoreRate: number;
  }>;

  // ソフラン曲の成績 (bpm_min != bpm_max)
  soflanStats: {
    totalSoflan: number;
    playedSoflan: number;
    averageScoreRate: number;
  };

  // タグ付き曲の成績 (chart_tags.json と照合)
  taggedChartStats: Record<string, {
    tagged: number;
    played: number;
    averageScoreRate: number;
  }>;

  // 注目すべき曲 (AI が深掘りする材料)
  highlights: {
    bestScores: ScoreResult[];     // スコアレート上位5曲 (各レベル)
    worstScores: ScoreResult[];    // スコアレート下位5曲 (プレイ済み)
    recentlyCleared: ScoreResult[]; // 高難度の初クリア候補 (EASYやCLEAR)
    almostAAA: ScoreResult[];      // AAA まであと少し (AA上位)
    almostFC: ScoreResult[];       // FC まであと少し (ミス少)
  };
}
```

### データサイズの見積もり

- LevelStats (12レベル): ~2KB
- BPM/ソフラン/タグ統計: ~1KB
- highlights (各5曲、5カテゴリ): ~5KB
- System Prompt (ドメイン知識 + チャート例): ~8KB
- **合計: ~16KB** → Gemma 4 / Kimi K2.5 の 256K コンテキストに対して全く問題なし

---

## AI の分析チェックリスト

Agent がユーザーのデータを受け取った際に、以下の観点で分析する。
(これらはシステムプロンプト内でフレームワークとして指示する)

### 1. 実力推定と現状把握
- [ ] Rank 推定値とその根拠を提示
- [ ] 各レベルのクリアランプ分布から強み・弱みを特定
- [ ] 全体的なスコアレートの傾向 (精度派? クリア重視?)

### 2. 高難度チャレンジ度
- [ ] 現在の Rank に対して、適切に高い難易度に挑戦しているか
- [ ] ☆12 (または適切なレベル) の FAILED が適度にあるか (挑戦している証拠)
- [ ] 「安全圏でばかり遊んでいないか」のチェック

### 3. フルコン埋め
- [ ] 各レベルの FC 率を確認
- [ ] 低〜中難度のフルコン埋めが進んでいるか
- [ ] FC に近い曲 (ミス 1-3) を特定して提案

### 4. スコア詰め
- [ ] 低難度で 100% に近いスコアを出す努力をしているか
- [ ] AAA を出せる下限レベルの特定と、その付近の AAA 埋め状況
- [ ] MAX-1桁、MAX-2桁の達成状況

### 5. BPM 帯の偏り
- [ ] プレイ済み曲の BPM 分布に偏りがないか
- [ ] 得意な BPM 帯ばかりやっていないか
- [ ] 苦手な BPM 帯の特定と練習提案

### 6. 譜面属性バランス
- [ ] 皿曲: タグ付き皿曲のプレイ状況・スコア
- [ ] CN: チャージノート譜面の練習状況
- [ ] ソフラン: BPM 変化曲への対応力
- [ ] ジャリ/ズレハネ: 特殊リズムへの対応

### 7. クリアランプとスコアの整合性
- [ ] クリアランプは高いがスコアが低い → ゲージ耐えだけでスコア力が足りない
- [ ] スコアは高いがクリアランプが低い → 瞬間的な崩れがある (特定セクションが苦手?)
- [ ] 「FULLCOMBO CLEAR なのに EX SCORE = 0」→ 過去バージョンの記録 (正常)

**注意**: 上記チェックリストは管理者 (norimiso) が今後調整する。AI のシステムプロンプトに組み込む際に、チェックの優先度や閾値をカスタマイズ可能にする。

---

## Server-side Tools (Agent SDK)

Agent SDK の `tool()` で定義するサーバーサイドツール:

### analyzeScore
```typescript
tool({
  description: "プレイヤーのスコアデータを分析し、統計情報を返す",
  inputSchema: z.object({
    level: z.number().optional().describe("分析対象レベル (省略時は全レベル)"),
    metric: z.enum(["clearLamp", "scoreRate", "bpi", "bpmBalance"]),
  }),
  execute: async ({ level, metric }) => {
    // AdvisorContext から該当データを抽出して返す
  },
})
```

### suggestPractice
```typescript
tool({
  description: "次に練習すべき曲や練習方針を提案する",
  inputSchema: z.object({
    focus: z.enum(["challenge", "fc", "score", "weakness", "balance"]),
    level: z.number().optional(),
  }),
  execute: async ({ focus, level }) => {
    // フォーカスに応じた練習提案を生成
  },
})
```

### lookupChart
```typescript
tool({
  description: "特定の曲/譜面の情報を検索する",
  inputSchema: z.object({
    query: z.string().describe("曲名 (部分一致)"),
    difficulty: z.enum(["SPB","SPN","SPH","SPA","SPL"]).optional(),
  }),
  execute: async ({ query, difficulty }) => {
    // master_songs.csv から検索
  },
})
```

---

## セキュリティ & レート制限

### Phase 1: シンプルなキー認証
- beat-advisor の API に `Authorization: Bearer <key>` を要求
- キーは wrangler.toml の secrets で管理
- 不正キーは 401 で弾く

### Phase 2: AI Gateway 統合
- AI Gateway を経由して Workers AI を呼び出す
- AI Gateway のレート制限: 例) 10 req/min per user
- AI Gateway の認証 (`cf-aig-authorization` ヘッダー)
- キャッシュ: 同一プロンプトの再利用でコスト削減
- Analytics: 利用状況の可視化

### Phase 3: 本格的なアクセス制御 (将来)
- ユーザー登録 + トークン発行
- 利用上限 (1日N回まで)
- 管理者ダッシュボード

---

## UI/UX 設計

### 配置

```
+------------------------------------------+
|  beat-motivator                          |
|  +----- CSV Input -----+                |
|  | [テキストエリア]      |                |
|  | [Submit]             |                |
|  +---------------------+                |
|                                          |
|  +--- AI Advisor (iframe) ---+          |  ← CSV 集計後に表示
|  | "あなたの実力は..."         |          |
|  | [初期レポート]              |          |
|  |                            |          |
|  | [チャット入力欄]            |          |
|  | "☆12のおすすめは?"        |          |
|  +----------------------------+          |
|                                          |
|  +--- Level Stats Table ---+            |
|  +--- All Songs List ------+            |
+------------------------------------------+
```

- CSV 入力欄の下、統計テーブルの上に配置
- 初回は自動レポートを表示
- その後チャットで深掘り可能 (Agent SDK のハイブリッド方式)
- iframe のサイズは固定高さ or 折りたたみ可能

---

## 技術詳細

### beat-advisor (新規 Worker)

```
beat-advisor/
  src/
    index.ts              # Worker entrypoint + Agent routing
    agent.ts              # AIChatAgent 実装
    tools/
      analyze.ts          # analyzeScore ツール
      suggest.ts          # suggestPractice ツール
      lookup.ts           # lookupChart ツール
    lib/
      system-prompt.ts    # システムプロンプト生成
      rank-estimator.ts   # Rank 推定ロジック
      context-builder.ts  # AdvisorContext 構築
    data/
      chart-tags.json     # 譜面タグデータ
      rank-thresholds.json # Rank 判定閾値
  wrangler.toml
  package.json
```

### 依存パッケージ

```json
{
  "dependencies": {
    "agents": "^0.3.0",
    "@cloudflare/ai-chat": "^0.3.0",
    "workers-ai-provider": "^3.0.0",
    "ai": "^6.0.0",
    "zod": "^3.23.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

### wrangler.toml (beat-advisor)

```toml
name = "beat-advisor"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[ai]
binding = "AI"

# AI Gateway (Phase 2)
# [ai_gateway]
# id = "beat-advisor-gateway"

[[durable_objects.bindings]]
name = "ADVISOR_AGENT"
class_name = "AdvisorAgent"

[[migrations]]
tag = "v1"
new_classes = ["AdvisorAgent"]
```

---

## 開発フェーズ

### Phase 1: MVP (最小限の動作)
- [ ] beat-advisor Worker プロジェクトの雛形作成
- [ ] AIChatAgent 実装 (システムプロンプト + Workers AI)
- [ ] AdvisorContext の型定義とビルダー
- [ ] Rank 推定ロジック (ルールベース)
- [ ] 基本的なチャット UI (Agent SDK starter ベース)
- [ ] beat-motivator から beat-advisor への集計データ受け渡し (postMessage)
- [ ] beat-motivator に iframe 埋め込み

### Phase 2: 分析強化
- [ ] Server-side tools (analyzeScore, suggestPractice, lookupChart)
- [ ] 譜面タグデータ (chart_tags.json) の初期セット作成
- [ ] BPM 分布分析の実装
- [ ] ソフラン曲特定 (bpm_min != bpm_max)
- [ ] AI のチェックリスト調整 (管理者カスタマイズ)
- [ ] システムプロンプトの改善

### Phase 3: セキュリティ & 運用
- [ ] API キー認証の実装
- [ ] AI Gateway 統合 (レート制限、認証、キャッシュ)
- [ ] コスト監視ダッシュボード
- [ ] モデル切替機能 (Gemma 4 / Kimi K2.5 / GLM 4.7 Flash)

### Phase 4: 拡張 (将来)
- [ ] 譜面タグ付け補助ツール (ローカル CLI or Web UI)
- [ ] 成長曲線と AI アドバイスの連携 (過去の履歴から変化を分析)
- [ ] 複数回の CSV 投入による時系列分析
- [ ] DP 対応

---

## 参考リンク

- Agents SDK docs: https://developers.cloudflare.com/agents/
- Workers AI Models: https://developers.cloudflare.com/workers-ai/models/
- Gemma 4 26B: https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/
- Kimi K2.5: https://developers.cloudflare.com/workers-ai/models/kimi-k2.5/
- AI Gateway: https://developers.cloudflare.com/ai-gateway/
- AI Gateway Rate Limiting: https://developers.cloudflare.com/ai-gateway/features/rate-limiting/
- AI Gateway Authentication: https://developers.cloudflare.com/ai-gateway/configuration/authentication/
- AIChatAgent API: https://developers.cloudflare.com/agents/api-reference/chat-agents/

---

## 実装メモ (2026-04-09)

### デプロイ済み
- beat-advisor: https://beat-advisor.norimiso.workers.dev (Cloudflare Workers / Durable Objects)
- beat-motivator: https://beat-motivator.norimiso.workers.dev (Astro SSR / Cloudflare Workers)

### 判明した制約
- **Gemma 4 26B は Workers AI 上で 131K トークン制限** (公称 256K)。Kimi K2.5 (256K) に切替
- **master_songs.csv をバンドルしてはいけない** -- 21K行の CSV を tool にバンドルすると 131K+ トークンになる
- **Durable Objects は `new_sqlite_classes` が必須** -- AIChatAgent は SQLite を使う。`new_classes` だと 500 エラー
- **Agent SDK のレスポンスを `new Response()` でラップしてはいけない** -- WebSocket upgrade が壊れる
- **AI SDK v6 の `sendMessage` は `{ text: string }` オブジェクトが必要** -- 文字列直接は不可

### データ送信の設計
beat-motivator 側で集計結果を要約してから beat-advisor に postMessage で渡す:
- レベル別統計 (12エントリ、コンパクト)
- カテゴリ別注目曲 (☆12得意/苦手/FAILED、AAA寸前、FC寸前、☆11得意/苦手、各最大10曲)
- 全曲の生データは送らない

### 調整ファイル
- `beat-advisor/src/lib/system-prompt.ts` -- AI への指示、ドメイン知識
- `beat-advisor/seed/rank_thresholds.json` -- Rank 判定基準
- `beat-advisor/seed/chart_tags.json` -- 譜面属性タグの代表曲
