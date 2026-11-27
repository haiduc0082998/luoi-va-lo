// Cửa sổ trượt cạnh bản đồ: mỗi lúc mở một cửa sổ, bấm lại nút trên thanh bên để đóng.
// Nút sẽ chấm đỏ khi bảng của nó có tin cần chú ý mà người chơi chưa mở xem.
const $ = (id) => document.getElementById(id);

export function createDrawers(G) {
  const rail = $('rail');
  const buttons = [...rail.querySelectorAll('[data-open]')];
  let cur = null;
  const onOpen = new Set();

  function open(id) {
    cur = id;
    for (const d of document.querySelectorAll('.drawer')) {
      const on = d.id === `dr-${id}`;
      d.hidden = false; // giữ trong DOM để trượt mượt; ẩn bằng inert + lớp CSS
      d.classList.toggle('open', on);
      d.inert = !on;
    }
    for (const b of buttons) {
      const on = b.dataset.open === id;
      b.setAttribute('aria-pressed', String(on));
      if (on) b.classList.remove('alert');
    }
    document.body.dataset.drawer = id ?? '';
    for (const f of onOpen) f(id);
  }
  const toggle = (id) => open(cur === id ? null : id);

  rail.addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (b) toggle(b.dataset.open); });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) open(null); });

  // Tin xấu: chấm đỏ lên nút Quốc gia (bản tin) nếu bảng đó đang đóng
  let last = null;
  G.listeners.add((items) => {
    const n = items[0];
    if (!n || n === last) return; last = n;
    if ((n.level === 'bad' || n.level === 'warn') && cur !== 'nation') rail.querySelector('[data-open=nation]').classList.add('alert');
  });

  // Vuốt sang phải trên cửa sổ để đóng (điện thoại)
  let sx = null, sy = 0;
  document.addEventListener('touchstart', (e) => {
    const d = e.target.closest('.drawer.open');
    // bỏ qua vùng tự cuộn ngang (bảng, dải nút, thanh trượt) để không đóng nhầm
    if (!d || e.touches.length !== 1 || e.target.closest('.scroll, .seg, .s5tabs, input, .wmap')) { sx = null; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (sx === null) return;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    if (dx > 80 && dx > dy * 1.5) open(null);
    sx = null;
  }, { passive: true });

  open(null);
  return { open, toggle, close: () => open(null), get current() { return cur; }, onOpen };
}
