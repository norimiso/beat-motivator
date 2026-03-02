#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MASTER_PATH = 'seed/master_songs.csv';
const DEFAULT_CSV_PATH = '8981-4679_sp_score (1).csv';

const DIFFICULTY_OFFSETS = [
  { difficulty: 'SPB', offset: 5 },
  { difficulty: 'SPN', offset: 12 },
  { difficulty: 'SPH', offset: 19 },
  { difficulty: 'SPA', offset: 26 },
  { difficulty: 'SPL', offset: 33 },
];

const TITLE_ALIAS_MAP = new Map([
  ["L'amour et la liberte", "L'amour et la liberté"],
  ['共犯ヘヴンズコード', '共犯へヴンズコード'],
  ['ACT0', 'ACTØ'],
  ['Flamingo', 'Flämingo'],
  ['Uaigh Gealai', 'Uaigh Gealaí'],
  ['uen', 'uәn'],
  ['FiZZλ_POT!0N', 'FiZZλ_PØT!OИ'],
  ['PERFECT GREAT!!', 'PERFECT☆GREAT'],
]);

function parseCsvLine(line) {
  const fields = [];
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
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  fields.push(current);
  return fields;
}

function normalizeTitleForMatch(title) {
  const aliased = TITLE_ALIAS_MAP.get(title) ?? title;

  return aliased
    .toLowerCase()
    .normalize('NFKC')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[♥♡❤❤️💕]/g, '')
    .replace(/[☆★♪♫♠♣♦]/g, '')
    .replace(/→/g, '')
    .replace(/[²³¹⁰]/g, (c) => ({ '²': '2', '³': '3', '¹': '1', '⁰': '0' }[c] ?? c))
    .replace(/…/g, '...')
    .replace(/・/g, '')
    .replace(/[æ]/g, 'ae')
    .replace(/[ø]/g, 'o')
    .replace(/[χ]/g, 'x')
    .replace(/[и]/g, 'n')
    .replace(/[әə]/g, 'e')
    .replace(/[φ]/g, 'o')
    .replace(/ꓘ/g, 'k')
    .replace(/§/g, 'ss')
    .replace(/[～〜]/g, '~')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/ヘ/g, 'へ')
    .replace(/["“”「」『』〝〞]/g, '')
    .replace(/['’]/g, '')
    .replace(/&hearts;/g, '')
    .replace(/&[a-z]+;/gi, '')
    .replace(/&#x?[0-9a-f]+;/gi, '')
    .replace(/[\s　]+/g, '')
    .replace(/[^\w\u3000-\u9fff\uff00-\uffef\u30a0-\u30ff\u3040-\u309f]/g, '')
    .trim();
}

function parseNumber(value) {
  const n = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(n) ? n : 0;
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const json = args.includes('--json');
  const csvArg = args.find((a) => !a.startsWith('--'));
  const csvPath = resolve(csvArg ?? DEFAULT_CSV_PATH);
  const masterPath = resolve(MASTER_PATH);

  if (!existsSync(masterPath)) {
    console.error(`master CSV not found: ${masterPath}`);
    process.exit(1);
  }
  if (!existsSync(csvPath)) {
    console.error(`input CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const masterLines = readFileSync(masterPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const csvLines = readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);

  if (csvLines.length === 0) {
    console.error('input CSV is empty');
    process.exit(1);
  }

  const csvHeader = parseCsvLine(csvLines[0]);
  if (csvHeader[0] !== 'バージョン') {
    console.error('input CSV does not look like e-amusement export (missing バージョン header)');
    process.exit(1);
  }

  const masterTitles = new Set();
  const normalizedIndex = new Map();

  for (let i = 1; i < masterLines.length; i++) {
    const cols = parseCsvLine(masterLines[i]);
    const difficulty = cols[5];
    if (!['SPB', 'SPN', 'SPH', 'SPA', 'SPL'].includes(difficulty)) continue;

    const title = cols[1];
    if (!title) continue;

    masterTitles.add(title);
    const key = normalizeTitleForMatch(title);

    if (!normalizedIndex.has(key)) {
      normalizedIndex.set(key, new Set([title]));
    } else {
      normalizedIndex.get(key).add(title);
    }
  }

  let chartLevelPositive = 0;
  let chartScorePositive = 0;
  let splLevelPositive = 0;
  let splScorePositive = 0;

  let exactMissCount = 0;
  let normalizedRecoverableCount = 0;
  const unresolved = [];

  for (let i = 1; i < csvLines.length; i++) {
    const cols = parseCsvLine(csvLines[i]);
    if (cols.length === 0) continue;

    const version = cols[0] ?? '';
    const title = cols[1] ?? '';

    for (const { difficulty, offset } of DIFFICULTY_OFFSETS) {
      const level = parseNumber(cols[offset]);
      const score = parseNumber(cols[offset + 1]);

      if (level > 0) chartLevelPositive++;
      if (score > 0) chartScorePositive++;

      if (difficulty === 'SPL') {
        if (level > 0) splLevelPositive++;
        if (score > 0) splScorePositive++;
      }
    }

    if (!title || masterTitles.has(title)) continue;

    exactMissCount++;
    const key = normalizeTitleForMatch(title);
    const candidates = normalizedIndex.get(key);

    if (candidates && candidates.size === 1) {
      normalizedRecoverableCount++;
      continue;
    }

    unresolved.push({
      version,
      title,
      candidates: candidates ? [...candidates].slice(0, 3) : [],
      candidateCount: candidates ? candidates.size : 0,
    });
  }

  const report = {
    masterPath,
    csvPath,
    rows: csvLines.length - 1,
    chartLevelPositive,
    chartScorePositive,
    splLevelPositive,
    splScorePositive,
    exactMissCount,
    normalizedRecoverableCount,
    unresolvedCount: unresolved.length,
    unresolved,
  };

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('=== CSV Coverage Check ===');
    console.log(`CSV: ${csvPath}`);
    console.log(`Master: ${masterPath}`);
    console.log('');
    console.log(`Rows: ${report.rows}`);
    console.log(`Chart slots with level>0: ${report.chartLevelPositive}`);
    console.log(`Chart slots with score>0: ${report.chartScorePositive}`);
    console.log(`SPL slots with level>0: ${report.splLevelPositive}`);
    console.log(`SPL slots with score>0: ${report.splScorePositive}`);
    console.log('');
    console.log(`Exact title misses: ${report.exactMissCount}`);
    console.log(`Recoverable by normalization: ${report.normalizedRecoverableCount}`);
    console.log(`Still unresolved: ${report.unresolvedCount}`);

    if (report.unresolvedCount > 0) {
      console.log('');
      console.log('Unresolved titles:');
      for (const item of report.unresolved) {
        const candidates = item.candidates.length > 0
          ? ` (candidates: ${item.candidates.join(' | ')})`
          : '';
        console.log(`- [${item.version}] ${item.title}${candidates}`);
      }
    }
  }

  if (strict && unresolved.length > 0) {
    process.exit(2);
  }
}

main();
