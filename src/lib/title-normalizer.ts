/**
 * e-amusement CSV と master_songs.csv の表記ゆれを吸収するための正規化
 */
const TITLE_ALIAS_MAP = new Map<string, string>([
  ["L'amour et la liberte", "L'amour et la liberté"],
  ['共犯ヘヴンズコード', '共犯へヴンズコード'],
  ['ACT0', 'ACTØ'],
  ['Flamingo', 'Flämingo'],
  ['Uaigh Gealai', 'Uaigh Gealaí'],
  ['uen', 'uәn'],
  ['FiZZλ_POT!0N', 'FiZZλ_PØT!OИ'],
  ['PERFECT GREAT!!', 'PERFECT☆GREAT'],
]);

export function normalizeTitleForMatch(title: string): string {
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
