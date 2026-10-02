/** Numeric IMDb sorting over the loaded page, preserving provider order for ties. */
export function imdbScore(item) {
  const raw = item.rating ?? item.imdbRating;
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  if (typeof raw === 'string' && !raw.trim()) return null;
  const score = Number(raw);
  return Number.isFinite(score) && score >= 0 && score <= 10 ? score : null;
}

export function sortCatalogItems(items, mode = 'catalog') {
  const result = [...items];
  if (!['imdb_desc', 'imdb_asc'].includes(mode)) return result;
  return result.sort((left, right) => {
    const a = imdbScore(left);
    const b = imdbScore(right);
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return mode === 'imdb_desc' ? b - a : a - b;
  });
}
