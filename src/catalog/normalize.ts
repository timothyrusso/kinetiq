/**
 * The search key for an exercise name: lowercase, accents folded, whitespace collapsed.
 *
 * Search is `LIKE '%term%'` over this column, so the same function runs on both sides: on the
 * name when the catalog is written and on the term when it is queried. "Panca piána" and
 * "PANCA  piana" then find the same row, and nobody has to type an accent on a phone keyboard.
 *
 * The folded range is the combining diacritical marks block, which holds every accent English
 * and Italian use. A Unicode property escape would cover more, and is not something to assume
 * from every JS engine the app runs on.
 */
export function toSearchKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
