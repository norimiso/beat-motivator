/**
 * 能力値 (Ability Score) 計算モジュール
 *
 * 単発力のみ実装 (30ASA Reborn 方式に準拠):
 *   - ブレークポイント区間補間 + t^1.2 加速
 *   - 対象: スコアレート上位10曲の平均
 *   - スケール: 0-100
 *
 * 99-100% の微差を最大限に拡大する設計。
 * PGREAT 精度の世界を可視化するための指標。
 */

export interface AbilityScores {
  /** 単発力 (0-100) -- 精度・PGREAT能力 */
  singleNote: number;
}

/** 上位N曲 */
const TOP_N = 10;

/**
 * ブレークポイントテーブル
 * [scoreRate, score] の対応。区間内は線形補間 + t^1.2 加速。
 *
 * | scoreRate | score |
 * |-----------|------:|
 * | 0%        |   0   |
 * | 90%       |   1   | (ほぼゼロ域)
 * | 95%       |   5   | (入門域)
 * | 99%       |  30   | (中級域)
 * | 100%      | 100   | (上級域: 99-100%に70点を配分)
 */
const SINGLE_NOTE_CURVE: [number, number][] = [
  [0.0, 0],
  [0.90, 1],
  [0.95, 5],
  [0.99, 30],
  [1.0, 100],
];

/** 加速指数: 区間内の進行を t^ACCEL_POWER で加速 */
const ACCEL_POWER = 1.2;

/**
 * 単発力 (Single Note Ability)
 *
 * ブレークポイント区間補間方式。
 * avgScoreRate に対応する区間を見つけ、線形位置 t を t^1.2 で加速してスコア算出。
 */
export function singleNoteAbility(avgScoreRate: number): number {
  if (avgScoreRate <= 0) return 0;
  if (avgScoreRate >= 1.0) return 100;

  // 対応する区間を探す
  for (let i = 1; i < SINGLE_NOTE_CURVE.length; i++) {
    const [r0, s0] = SINGLE_NOTE_CURVE[i - 1];
    const [r1, s1] = SINGLE_NOTE_CURVE[i];
    if (avgScoreRate <= r1) {
      const t = (avgScoreRate - r0) / (r1 - r0);
      const tAccel = t ** ACCEL_POWER;
      return s0 + (s1 - s0) * tAccel;
    }
  }

  return 100;
}

/**
 * 全能力値を一括計算
 *
 * @param scoreRates プレイ済み全曲の scoreRate 配列 (単発力: 上位10曲の平均)
 */
export function calculateAbilityScores(params: {
  scoreRates: number[];
}): AbilityScores {
  const { scoreRates } = params;

  // 単発力: 上位10曲の平均スコアレート
  const sorted = [...scoreRates].sort((a, b) => b - a);
  const topN = sorted.slice(0, TOP_N);
  const avgTopN = topN.length > 0
    ? topN.reduce((a, b) => a + b, 0) / topN.length
    : 0;

  return {
    singleNote: singleNoteAbility(avgTopN),
  };
}
