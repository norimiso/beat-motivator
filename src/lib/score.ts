import type { DjLevel } from './types';

/**
 * スコアレートを計算
 * @returns 0.0 ~ 1.0
 */
export function calculateScoreRate(exScore: number, totalNotes: number): number {
  if (totalNotes <= 0) return 0;
  const maxScore = totalNotes * 2;
  const rate = exScore / maxScore;
  return Math.max(0, Math.min(1, rate));
}

/**
 * MAX- (理論値との差分)
 */
export function calculateMaxMinus(exScore: number, totalNotes: number): number {
  return totalNotes * 2 - exScore;
}

/**
 * DJ LEVELを判定
 * AAA: 8/9, AA: 7/9, A: 6/9, B: 5/9, C: 4/9, D: 3/9, E: 2/9, F: <2/9
 */
export function calculateDjLevel(scoreRate: number): DjLevel {
  if (scoreRate >= 8 / 9) return 'AAA';
  if (scoreRate >= 7 / 9) return 'AA';
  if (scoreRate >= 6 / 9) return 'A';
  if (scoreRate >= 5 / 9) return 'B';
  if (scoreRate >= 4 / 9) return 'C';
  if (scoreRate >= 3 / 9) return 'D';
  if (scoreRate >= 2 / 9) return 'E';
  return 'F';
}

/**
 * スコアレートを%文字列にフォーマット (小数点2桁)
 */
export function formatScoreRate(rate: number): string {
  return (rate * 100).toFixed(2) + '%';
}

/**
 * BPIを小数点2桁にフォーマット
 */
export function formatBpi(bpi: number | null): string {
  if (bpi === null) return '-';
  return bpi.toFixed(2);
}
