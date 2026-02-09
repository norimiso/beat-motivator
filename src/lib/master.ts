/** 曲マスター (master_songs.csv) のパーサー */

import type { TargetChart, Difficulty } from './types';

export interface MasterChart {
  versionFull: string;
  title: string;
  genre: string;
  artist: string;
  version: number;
  difficulty: string;
  level: number;
  notes: number;
  bpm: number;
  bpmMin: number;
  bpmMax: number;
  measure: number;
  duration: number;
  kaidenAverage: number;
  topScore: number;
}

// 静的インポート
const masterCsvRaw = import.meta.glob('/seed/master_songs.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * RFC 4180 CSV line parser
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) { fields.push(""); break; }
    if (line[i] === '"') {
      let value = "";
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            value += '"'; i += 2;
          } else {
            i++; break;
          }
        } else {
          value += line[i]; i++;
        }
      }
      fields.push(value);
      if (i < line.length && line[i] === ',') i++;
    } else {
      const next = line.indexOf(',', i);
      if (next === -1) { fields.push(line.slice(i)); break; }
      fields.push(line.slice(i, next));
      i = next + 1;
    }
  }
  return fields;
}

let _cache: MasterChart[] | null = null;

/** マスター全行をパースしてキャッシュ */
export function getAllMasterCharts(): MasterChart[] {
  if (_cache) return _cache;

  const key = Object.keys(masterCsvRaw)[0];
  if (!key) { _cache = []; return _cache; }

  const text = masterCsvRaw[key];
  const lines = text.split(/\r?\n/);
  const charts: MasterChart[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCsvLine(line);
    if (cols.length < 16) continue;

    charts.push({
      versionFull: cols[0],
      title: cols[1],
      genre: cols[2],
      artist: cols[3],
      version: parseInt(cols[4], 10),
      difficulty: cols[5],
      level: parseInt(cols[7], 10),
      notes: parseInt(cols[8], 10),
      bpm: parseFloat(cols[9]) || -1,
      bpmMin: parseFloat(cols[10]) || -1,
      bpmMax: parseFloat(cols[11]) || -1,
      measure: parseInt(cols[12], 10),
      duration: parseInt(cols[13], 10),
      kaidenAverage: parseInt(cols[14], 10),
      topScore: parseInt(cols[15], 10),
    });
  }

  _cache = charts;
  return _cache;
}

/** SP難易度の型ガード */
const SP_DIFFICULTIES = new Set<string>(['SPB', 'SPN', 'SPH', 'SPA', 'SPL']);
function isSpDifficulty(d: string): d is Difficulty {
  return SP_DIFFICULTIES.has(d);
}

/**
 * 全 SP 譜面を TargetChart[] として取得
 * notes > 0, level > 0 の有効な譜面のみ
 */
export function getAllSpTargetCharts(): TargetChart[] {
  return getAllMasterCharts()
    .filter(c => isSpDifficulty(c.difficulty) && c.notes > 0 && c.level > 0)
    .map(c => ({
      title: c.title,
      difficulty: c.difficulty as Difficulty,
      level: c.level,
      notes: c.notes,
      kaidenAverage: c.kaidenAverage > 0 ? c.kaidenAverage : null,
      topScore: c.topScore > 0 ? c.topScore : null,
    }));
}

/** ユニーク曲名一覧 */
export function getUniqueTitles(): string[] {
  const titles = new Set<string>();
  for (const c of getAllSpTargetCharts()) {
    titles.add(c.title);
  }
  return [...titles].sort();
}
