import type { TargetChart, ScoreResult, ScoreSummary, LevelStats } from './types';
import { calculateBpi, calculateOverallBpi } from './bpi';
import { calculateScoreRate, calculateMaxMinus, calculateDjLevel } from './score';
import { parseEamusementCsv } from './csv-parser';
import { calculateAbilityScores } from './ability';

/**
 * メイン集計関数 (全曲対応版)
 *
 * 全 SP 譜面の TargetChart[] と e-amusement CSV から
 * ScoreResult[] と ScoreSummary (レベル別統計付き) を生成
 */
export function aggregate(
  targetCharts: TargetChart[],
  eamusementCsv: string,
  bpiCoefficient: number = 1.1
): { results: ScoreResult[]; summary: ScoreSummary } {
  // e-amusement CSV パース (全曲版なので targetTitles なし)
  const parsedScores = parseEamusementCsv(eamusementCsv);

  const results: ScoreResult[] = [];
  const bpiValues: number[] = [];
  const scoreRatesAll: number[] = []; // 単発力用: 全プレイ曲の scoreRate
  let totalMisses = 0;               // 地力用: 全曲合計ミスカウント
  let playedCount = 0;
  let scoredCount = 0;
  let totalRate = 0;
  let totalExScore = 0;

  // レベル別統計を初期化 (level 1~12)
  const statsMap = new Map<number, LevelStats>();
  for (let lv = 1; lv <= 12; lv++) {
    statsMap.set(lv, {
      level: lv,
      total: 0,
      played: 0,
      averageRate: 0,
      maxMinus1keta: 0,
      maxMinus2keta: 0,
      pct99: 0,
      pct98: 0,
      pct97: 0,
      pct96: 0,
      pct95: 0,
      maxMinus: 0,
      aaa: 0,
      aa: 0,
      a: 0,
    });
  }

  // マスターからレベル別 total をカウント
  for (const chart of targetCharts) {
    const s = statsMap.get(chart.level);
    if (s) s.total++;
  }

  // レベル別の scoreRate 合計用
  const levelRateSum = new Map<number, number>();
  for (let lv = 1; lv <= 12; lv++) levelRateSum.set(lv, 0);

  for (const chart of targetCharts) {
    const songScores = parsedScores.get(chart.title);
    const score = songScores?.find(s => s.difficulty === chart.difficulty);

    const exScore = score?.exScore ?? 0;
    const maxScore = chart.notes * 2;
    const scoreRate = calculateScoreRate(exScore, chart.notes);
    const maxMinus = calculateMaxMinus(exScore, chart.notes);
    const djLevel = exScore > 0 ? calculateDjLevel(scoreRate) : 'F' as const;

    let bpi: number | null = null;
    if (chart.kaidenAverage !== null && chart.kaidenAverage > 0
      && chart.topScore !== null && chart.topScore > 0
      && exScore > 0) {
      bpi = calculateBpi({
        exScore,
        kaidenAverage: chart.kaidenAverage,
        topScore: chart.topScore,
        totalNotes: chart.notes,
        coefficient: bpiCoefficient,
      });
    }

    const hasScore = exScore > 0;
    const isPlayed = hasScore || (score?.clearType !== undefined && score.clearType !== 'NO PLAY');

    const result: ScoreResult = {
      title: chart.title,
      difficulty: chart.difficulty,
      level: chart.level,
      notes: chart.notes,
      exScore,
      maxScore,
      scoreRate,
      djLevel,
      clearType: score?.clearType ?? 'NO PLAY',
      maxMinus,
      pgreat: score?.pgreat ?? 0,
      great: score?.great ?? 0,
      missCount: score?.missCount ?? null,
      bpi,
      kaidenAverage: chart.kaidenAverage,
      topScore: chart.topScore,
      kaidenDiff: chart.kaidenAverage !== null && exScore > 0
        ? exScore - chart.kaidenAverage
        : null,
      topDiff: chart.topScore !== null && exScore > 0
        ? exScore - chart.topScore
        : null,
    };

    results.push(result);

    if (isPlayed && hasScore) {
      playedCount++;
      scoredCount++;
      totalRate += scoreRate;
      totalExScore += exScore;
      scoreRatesAll.push(scoreRate);
      if (score?.missCount !== null && score?.missCount !== undefined) {
        totalMisses += score.missCount;
      }
      if (bpi !== null) bpiValues.push(bpi);

      // レベル別統計
      const s = statsMap.get(chart.level);
      if (s) {
        s.played++;
        levelRateSum.set(chart.level, (levelRateSum.get(chart.level) ?? 0) + scoreRate);

        // 累積カウント (99% には 99%以上のものすべてが含まれる)
        if (maxMinus < 10) s.maxMinus1keta++;
        if (maxMinus < 100) s.maxMinus2keta++;
        if (scoreRate >= 0.99) s.pct99++;
        if (scoreRate >= 0.98) s.pct98++;
        if (scoreRate >= 0.97) s.pct97++;
        if (scoreRate >= 0.96) s.pct96++;
        if (scoreRate >= 0.95) s.pct95++;
        if (scoreRate >= 17 / 18) s.maxMinus++;  // MAX-ランク以上
        if (scoreRate >= 8 / 9) s.aaa++;
        if (scoreRate >= 7 / 9) s.aa++;
        if (scoreRate >= 6 / 9) s.a++;
      }
    }
  }

  // レベル別の平均レート算出
  for (const [lv, s] of statsMap) {
    if (s.played > 0) {
      s.averageRate = (levelRateSum.get(lv) ?? 0) / s.played;
    }
  }

  // 総合BPI
  let averageBpi: number | null = null;
  if (bpiValues.length > 0) {
    averageBpi = calculateOverallBpi(bpiValues);
  }

  const totalMaxScore = targetCharts.reduce((sum, c) => sum + c.notes * 2, 0);

  // レベル12→1の順
  const levelStats: LevelStats[] = [];
  for (let lv = 12; lv >= 1; lv--) {
    const s = statsMap.get(lv);
    if (s && s.total > 0) levelStats.push(s);
  }

  // 能力値計算
  const levelAverages = new Map<number, number>();
  for (const s of levelStats) {
    if (s.averageRate > 0) {
      levelAverages.set(s.level, s.averageRate);
    }
  }

  const ability = scoreRatesAll.length > 0
    ? calculateAbilityScores({ scoreRates: scoreRatesAll, levelAverages, totalMisses })
    : null;

  const summary: ScoreSummary = {
    totalCharts: targetCharts.length,
    playedCharts: playedCount,
    averageScoreRate: scoredCount > 0 ? totalRate / scoredCount : 0,
    averageBpi,
    totalExScore,
    totalMaxScore,
    levelStats,
    ability,
  };

  return { results, summary };
}
