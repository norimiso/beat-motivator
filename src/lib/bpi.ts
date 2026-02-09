/**
 * BPI (Beat Power Indicator) 計算モジュール
 *
 * 参考: http://norimiso.web.fc2.com/aboutBPI.html
 */

/** PGF: Pika-Great-Function */
export function pgf(scoreRate: number, totalNotes: number): number {
  if (scoreRate >= 1.0) {
    return totalNotes * 2;
  }
  return 1 + (scoreRate - 0.5) / (1 - scoreRate);
}

export interface BpiParams {
  exScore: number;
  kaidenAverage: number;
  topScore: number;
  totalNotes: number;
  coefficient?: number;
}

/**
 * 単曲BPIを計算
 * @returns BPI値。計算不能の場合は null
 */
export function calculateBpi(params: BpiParams): number | null {
  const { exScore, kaidenAverage, topScore, totalNotes, coefficient = 1.1 } = params;

  if (totalNotes <= 0) return null;
  if (kaidenAverage <= 0) return null;
  if (topScore <= 0) return null;
  if (topScore <= kaidenAverage) return null;
  if (exScore <= 0) return null;

  const maxScore = totalNotes * 2;

  const sRate = exScore / maxScore;
  const kRate = kaidenAverage / maxScore;
  const zRate = topScore / maxScore;

  const S = pgf(sRate, totalNotes);
  const K = pgf(kRate, totalNotes);
  const Z = pgf(zRate, totalNotes);

  if (K <= 0 || Z <= 0) return null;

  const sPrime = S / K;
  const zPrime = Z / K;

  if (zPrime <= 1) return null;

  const lnZ = Math.log(zPrime);
  if (lnZ <= 0) return null;

  const p = coefficient;

  let result: number;
  if (exScore >= kaidenAverage) {
    const lnS = Math.log(sPrime);
    result = 100 * Math.pow(lnS, p) / Math.pow(lnZ, p);
  } else {
    const lnS = -Math.log(sPrime);
    result = -100 * Math.pow(lnS, p) / Math.pow(lnZ, p);
  }

  if (!Number.isFinite(result)) return null;
  return result;
}

/**
 * 総合BPI (複数の単曲BPIから算出)
 */
export function calculateOverallBpi(bpiValues: number[], minBpi: number = -15): number | null {
  const clamped = bpiValues.map(b => Math.max(b, minBpi));
  const n = clamped.length;
  if (n === 0) return null;

  const k = Math.log2(n);
  if (k <= 0) return clamped[0];

  let sum = 0;
  for (const bpi of clamped) {
    if (bpi >= 0) {
      sum += Math.pow(bpi, k);
    } else {
      sum -= Math.pow(-bpi, k);
    }
  }

  const avg = sum / n;
  let result: number;
  if (avg >= 0) {
    result = Math.pow(avg, 1 / k);
  } else {
    result = -Math.pow(-avg, 1 / k);
  }

  if (!Number.isFinite(result)) return null;
  return result;
}
