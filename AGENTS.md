# AGENTS.md - AI Agent Guidelines for Beat Motivator

## 対応方針

- ユーザーに忖度せず、エキスパートなエンジニアとしての知見をもって対応すること。
- ドメイン知識（Beatmania IIDX、BPI計算、e-amusement CSV仕様など）が深いことが求められる。
- 少しでも曖昧な点や確信が持てない仕様がある場合は、推測で進めずユーザーに確認すること。

## プロジェクト概要

- **Beat Motivator**: IIDX 全曲対応スコアトラッカー
- **30ASA Reborn** (`C:\opencode\30ASA_reborn`) の姉妹プロジェクト。コアライブラリ (BPI計算、CSVパーサー、スコア計算) を共有
- 30ASA が「30曲コンテスト」に特化しているのに対し、Beat Motivator は「全SP譜面 (8,000+)」を対象にレベル別統計・成長記録を提供
- デプロイ先: `beat-motivator.norimiso.workers.dev`

## 技術スタック

- Astro SSR + Cloudflare Workers
- TypeScript
- Chart.js (将来のグラフ機能用)
- localStorage (履歴保存)
- master_songs.csv: 30ASA と同一マスター (21,177行、SP+DP、v1-v33)

## ファイル構成

```
src/
  layouts/Layout.astro    # ダークテーマ、グローバルCSS
  pages/index.astro       # メインSPA (CSV入力、統計、曲リスト、履歴)
  pages/api/aggregate.ts  # POST /api/aggregate → 全曲集計
  pages/api/master.ts     # GET /api/master → マスター情報
  lib/
    types.ts              # 型定義
    score.ts              # スコアレート、MAX-、DJ LEVEL
    bpi.ts                # BPI計算 (PGF、単曲BPI、総合BPI)
    csv-parser.ts         # e-amusement CSV パーサー (RFC 4180)
    master.ts             # master_songs.csv パーサー
    aggregate.ts          # メイン集計 (レベル別統計付き)
seed/
  master_songs.csv        # 曲マスター (30ASA と共通)
_legacy/                  # 旧 vanilla JS 版のファイル
```

## ドキュメント更新ルール

- 機能実装とドキュメント更新は同一セッション内で行う
- コミット＆push までをワンセットとする

## 30ASA Reborn との関係

- `src/lib/` のコアモジュール (bpi.ts, score.ts, csv-parser.ts) は 30ASA から移植
- `seed/master_songs.csv` は 30ASA と同一ファイル
- 将来 30ASA 側でマスター更新した場合は、こちらにもコピーが必要
