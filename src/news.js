// Bản tin: lưu 8 tin gần nhất và báo cho giao diện.
export function news(G, text, level = '') {
  G.news.unshift({ t: G.t, text, level });
  G.news.length = Math.min(G.news.length, 8);
  G.listeners.forEach((fn) => fn(G.news));
}
