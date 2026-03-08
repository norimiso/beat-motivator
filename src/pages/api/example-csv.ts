import type { APIRoute } from 'astro';

const bundledRootCsvFiles = import.meta.glob('/*.csv', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function pickExampleCsv(): { filename: string; csv: string } | null {
  const candidates = Object.entries(bundledRootCsvFiles)
    .filter(([path]) => /_sp_score(?:[^/]*)\.csv$/i.test(path))
    .sort(([a], [b]) => a.localeCompare(b));

  const selected = candidates.at(-1);
  if (!selected) return null;

  const [filePath, csv] = selected;
  return {
    filename: filePath.replace(/^\//, ''),
    csv,
  };
}

export const GET: APIRoute = async () => {
  const sample = pickExampleCsv();
  if (!sample) {
    return new Response(JSON.stringify({ error: 'サンプルCSV用の _sp_score.csv が見つかりません' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  return new Response(JSON.stringify(sample), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
