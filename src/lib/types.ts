/** 譜面の難易度種別 */
export type Difficulty = 'SPB' | 'SPN' | 'SPH' | 'SPA' | 'SPL';

/** DJ LEVEL */
export type DjLevel = 'AAA' | 'AA' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/** クリアタイプ */
export type ClearType =
  | 'NO PLAY'
  | 'FAILED'
  | 'ASSIST CLEAR'
  | 'EASY CLEAR'
  | 'CLEAR'
  | 'HARD CLEAR'
  | 'EX HARD CLEAR'
  | 'FULLCOMBO CLEAR';

/** マスター CSV の1譜面 */
export interface TargetChart {
  title: string;
  difficulty: Difficulty;
  level: number;
  notes: number;
  kaidenAverage: number | null;
  topScore: number | null;
}

/** e-amusement CSV から抽出した1譜面のスコア */
export interface ParsedScore {
  title: string;
  difficulty: Difficulty;
  exScore: number;
  pgreat: number;
  great: number;
  missCount: number | null;
  clearType: ClearType;
  djLevel: DjLevel | null;
}

/** 集計結果の1行 */
export interface ScoreResult {
  title: string;
  difficulty: Difficulty;
  level: number;
  notes: number;
  exScore: number;
  maxScore: number;
  scoreRate: number;
  djLevel: DjLevel;
  clearType: ClearType;
  maxMinus: number;
  pgreat: number;
  great: number;
  missCount: number | null;
  bpi: number | null;
  kaidenAverage: number | null;
  topScore: number | null;
  kaidenDiff: number | null;
  topDiff: number | null;
}

/** レベル別統計 */
export interface LevelStats {
  level: number;
  total: number;
  played: number;
  averageRate: number;
  maxMinus1keta: number;
  maxMinus2keta: number;
  pct99: number;
  pct98: number;
  pct97: number;
  pct96: number;
  pct95: number;
  maxMinus: number;   // score rate >= MAX- (17/18)
  aaa: number;
  aa: number;
  a: number;
}

/** 集計サマリー */
export interface ScoreSummary {
  totalCharts: number;
  playedCharts: number;
  averageScoreRate: number;
  averageBpi: number | null;
  totalExScore: number;
  totalMaxScore: number;
  levelStats: LevelStats[];
}

/** localStorage 履歴の1曲分スコア */
export interface ChartScore {
  exScore: number;
  scoreRate: number;
  bpi: number | null;
  clearType: ClearType;
  djLevel: DjLevel;
  maxMinus: number;
  missCount: number | null;
}

/** localStorage 履歴エントリ */
export interface HistoryEntry {
  id: string;
  date: string;
  submittedAt: string;
  summary: ScoreSummary;
  scores: Record<string, ChartScore>;
}
