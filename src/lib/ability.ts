/**
 * 能力値 (Ability Score) 計算モジュール
 *
 * 現在2軸を実装:
 *   - 単発力: 精度 (PGREAT率) に基づくスコアレート上位3曲の平均
 *   - 地力: レベル別スコアレートの安定性 + ミスカウント
 *
 * 将来追加予定の軸: 皿, ガチ押し, ソフラン, ズレハネ
 */

export interface AbilityScores {
  /** 単発力 (0-100) — 精度・PGREAT能力 */
  singleNote: number;
  /** 地力 (0-100) — 難易度横断のスコア安定性 */
  jikara: number;
}

/**
 * 単発力 (Single Note Ability)
 *
 * スコアレート上位3曲の平均値から算出。
 * 2項べき乗ブレンド: x^5 で中間域、x^25 で100%付近の急峻さを表現。
 *
 * | avgScoreRate | score |
 * |-------------|------:|
 * | 50%         |   0   |
 * | 66.7% (A)   |  0.12 |
 * | 90%         |  10.1 |
 * | 95%         |  22.7 |
 * | 99%         |  69.4 |
 * | 100%        | 100   |
 */
export function singleNoteAbility(avgScoreRate: number): number {
  if (avgScoreRate <= 0.5) return 0;
  if (avgScoreRate >= 1.0) return 100;
  const x = 2 * avgScoreRate - 1; // 0..1 mapping
  return 100 * (0.3 * x ** 5 + 0.7 * x ** 25);
}

/**
 * 地力 (Raw Power / Fundamentals)
 *
 * 3つのレベルグループ (≤10, 11, 12) の平均スコアレートから
 * base score を算出し、slope penalty と miss penalty を乗算。
 *
 * base(r)         = 100 × (2r - 1)^5        (r > 0.5, else 0)
 * slopeFactor(s)  = exp(-6 × s)              (s = max(0, (r10 - r12) / 2))
 * missFactor(m)   = 0.7 + 0.3 × exp(-m/247)
 *
 * 設計制約:
 *   - 全レベル100%, 0ミス → 100点
 *   - 90/90/90 (flat) > 100/100/80 (steep) — slope penaltyの効果
 *   - ミス 0→×1.0, 100→×0.9, 1000+→×0.7 floor
 */
export function jikara(params: {
  /** ≤Lv10 の平均スコアレート (0-1), undefined = データなし */
  rLv10: number | undefined;
  /** Lv11 の平均スコアレート (0-1), undefined = データなし */
  rLv11: number | undefined;
  /** Lv12 の平均スコアレート (0-1), undefined = データなし */
  rLv12: number | undefined;
  /** 全プレイ曲の合計ミスカウント */
  totalMisses: number;
}): number {
  const { rLv10, rLv11, rLv12, totalMisses } = params;

  // 有効なレベルグループを収集
  const rates: number[] = [];
  if (rLv10 !== undefined) rates.push(rLv10);
  if (rLv11 !== undefined) rates.push(rLv11);
  if (rLv12 !== undefined) rates.push(rLv12);

  if (rates.length === 0) return 0;

  // 全体平均
  const rAvg = rates.reduce((a, b) => a + b, 0) / rates.length;

  // Base score: (2r - 1)^5
  const base = rAvg > 0.5 ? 100 * (2 * rAvg - 1) ** 5 : 0;

  // Slope penalty: 高難度でスコアが落ちるほど減衰
  // r10, r12 両方あるときのみ slope を計算
  let slopeFactor = 1.0;
  if (rLv10 !== undefined && rLv12 !== undefined) {
    const s = Math.max(0, (rLv10 - rLv12) / 2);
    slopeFactor = Math.exp(-6 * s);
  }

  // Miss penalty: 0→1.0, 100→0.9, 1000+→0.7 floor
  const missFactor = 0.7 + 0.3 * Math.exp(-totalMisses / 247);

  return Math.max(0, Math.min(100, base * slopeFactor * missFactor));
}

/**
 * 全能力値を一括計算
 *
 * @param scoreRates プレイ済み全曲の scoreRate 配列 (単発力: 上位3曲の平均)
 * @param levelStats レベル別統計 (地力: Lv10以下, 11, 12 の平均)
 * @param totalMisses 全曲合計ミスカウント
 */
export function calculateAbilityScores(params: {
  scoreRates: number[];
  levelAverages: Map<number, number>; // level → averageRate
  totalMisses: number;
}): AbilityScores {
  const { scoreRates, levelAverages, totalMisses } = params;

  // 単発力: 上位3曲の平均スコアレート
  const sorted = [...scoreRates].sort((a, b) => b - a);
  const top3 = sorted.slice(0, 3);
  const avgTop3 = top3.length > 0
    ? top3.reduce((a, b) => a + b, 0) / top3.length
    : 0;

  // 地力: Lv≤10, Lv11, Lv12 のグループ平均
  // Lv≤10 は played 数で重み付け平均すべきだが、
  // LevelStats.averageRate は各レベルの平均なので、
  // ここでは Lv1-10 の averageRate の単純平均を使う
  let rLv10: number | undefined;
  const lv10Rates: number[] = [];
  for (let lv = 1; lv <= 10; lv++) {
    const rate = levelAverages.get(lv);
    if (rate !== undefined && rate > 0) lv10Rates.push(rate);
  }
  if (lv10Rates.length > 0) {
    rLv10 = lv10Rates.reduce((a, b) => a + b, 0) / lv10Rates.length;
  }

  const rLv11 = levelAverages.get(11) || undefined;
  const rLv12 = levelAverages.get(12) || undefined;
  // averageRate=0 のレベルは「プレイなし」扱い
  const rLv11Valid = rLv11 && rLv11 > 0 ? rLv11 : undefined;
  const rLv12Valid = rLv12 && rLv12 > 0 ? rLv12 : undefined;

  return {
    singleNote: singleNoteAbility(avgTop3),
    jikara: jikara({
      rLv10,
      rLv11: rLv11Valid,
      rLv12: rLv12Valid,
      totalMisses,
    }),
  };
}
