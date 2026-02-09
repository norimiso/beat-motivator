import type { APIRoute } from 'astro';
import { getAllSpTargetCharts } from '../../lib/master';
import { aggregate } from '../../lib/aggregate';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as { csv: string; levelFilter?: number };
    const { csv, levelFilter } = body;

    if (!csv || typeof csv !== 'string') {
      return new Response(JSON.stringify({ error: 'csv is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let targetCharts = getAllSpTargetCharts();

    // レベルフィルタ (optional)
    if (levelFilter && levelFilter >= 1 && levelFilter <= 12) {
      targetCharts = targetCharts.filter(c => c.level === levelFilter);
    }

    const { results, summary } = aggregate(targetCharts, csv);

    // 結果はスコアレート降順でソート (NO PLAY は末尾)
    results.sort((a, b) => {
      if (a.exScore === 0 && b.exScore === 0) return 0;
      if (a.exScore === 0) return 1;
      if (b.exScore === 0) return -1;
      return b.scoreRate - a.scoreRate;
    });

    return new Response(JSON.stringify({ results, summary }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
