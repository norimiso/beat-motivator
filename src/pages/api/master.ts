import type { APIRoute } from 'astro';
import { getAllSpTargetCharts } from '../../lib/master';

export const GET: APIRoute = async () => {
  const charts = getAllSpTargetCharts();

  // レベル別のカウントサマリー
  const levelCounts: Record<number, number> = {};
  for (const c of charts) {
    levelCounts[c.level] = (levelCounts[c.level] ?? 0) + 1;
  }

  return new Response(JSON.stringify({
    totalCharts: charts.length,
    levelCounts,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
