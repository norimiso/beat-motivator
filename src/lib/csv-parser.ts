import type { Difficulty, ClearType, DjLevel, ParsedScore } from './types';

/**
 * e-amusement CSV パーサー
 *
 * 全曲版: targetTitles を受け取らず、全行をパースする
 */

/** 各難易度のカラムオフセット */
const DIFFICULTY_OFFSETS: Record<Difficulty, number> = {
  SPB: 5,
  SPN: 12,
  SPH: 19,
  SPA: 26,
  SPL: 33,
};

const FIELD_OFFSET = {
  LEVEL: 0,
  SCORE: 1,
  PGREAT: 2,
  GREAT: 3,
  MISS_COUNT: 4,
  CLEAR_TYPE: 5,
  DJ_LEVEL: 6,
};

/**
 * RFC4180 準拠の簡易CSVパーサー
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function parseClearType(value: string): ClearType {
  const map: Record<string, ClearType> = {
    'NO PLAY': 'NO PLAY',
    'FAILED': 'FAILED',
    'ASSIST CLEAR': 'ASSIST CLEAR',
    'EASY CLEAR': 'EASY CLEAR',
    'CLEAR': 'CLEAR',
    'HARD CLEAR': 'HARD CLEAR',
    'EX HARD CLEAR': 'EX HARD CLEAR',
    'FULLCOMBO CLEAR': 'FULLCOMBO CLEAR',
  };
  return map[value] ?? 'NO PLAY';
}

function parseDjLevel(value: string): DjLevel | null {
  if (value === '---' || !value) return null;
  return value as DjLevel;
}

/**
 * e-amusement CSVテキストから全曲のスコアを抽出する
 *
 * @param csvText CSVテキスト全文
 * @returns タイトルをキーとした、各難易度のスコアのMap
 */
export function parseEamusementCsv(
  csvText: string
): Map<string, ParsedScore[]> {
  const result = new Map<string, ParsedScore[]>();
  const cleaned = csvText.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/);

  if (lines.length === 0) {
    throw new Error('CSVが空です');
  }

  const headerFields = parseCsvLine(lines[0]);
  if (headerFields[0] !== 'バージョン') {
    throw new Error('e-amusement形式のCSVではありません (ヘッダーが "バージョン" で始まっていません)');
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCsvLine(line);
    const title = cols[1];
    if (!title) continue;

    const scores: ParsedScore[] = [];

    for (const [diff, offset] of Object.entries(DIFFICULTY_OFFSETS) as [Difficulty, number][]) {
      const level = parseInt(cols[offset + FIELD_OFFSET.LEVEL] ?? '0', 10);
      const exScore = parseInt(cols[offset + FIELD_OFFSET.SCORE] ?? '0', 10);
      const clearType = parseClearType(cols[offset + FIELD_OFFSET.CLEAR_TYPE] ?? '');

      if (level === 0 && exScore === 0 && clearType === 'NO PLAY') {
        scores.push({
          title,
          difficulty: diff,
          exScore: 0,
          pgreat: 0,
          great: 0,
          missCount: null,
          clearType: 'NO PLAY',
          djLevel: null,
        });
        continue;
      }

      const pgreat = parseInt(cols[offset + FIELD_OFFSET.PGREAT] ?? '0', 10);
      const great = parseInt(cols[offset + FIELD_OFFSET.GREAT] ?? '0', 10);
      const missRaw = cols[offset + FIELD_OFFSET.MISS_COUNT] ?? '---';
      const missCount = missRaw === '---' ? null : parseInt(missRaw, 10);
      const djLevel = parseDjLevel(cols[offset + FIELD_OFFSET.DJ_LEVEL] ?? '');

      scores.push({
        title,
        difficulty: diff,
        exScore,
        pgreat,
        great,
        missCount,
        clearType,
        djLevel,
      });
    }

    result.set(title, scores);
  }

  return result;
}
