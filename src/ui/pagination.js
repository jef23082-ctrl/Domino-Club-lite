// Presentation only: never truncates or changes the underlying records.
export function paginate(items, page = 0, size = 4) {
  const limit = Math.max(1, Math.floor(Number(size) || 1));
  const pages = Math.max(1, Math.ceil(items.length / limit));
  const current = Math.max(0, Math.min(pages - 1, Math.floor(Number(page) || 0)));
  const start = current * limit;
  return { items: items.slice(start, start + limit), page: current, pages, start, total: items.length };
}
