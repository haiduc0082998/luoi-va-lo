// Lưu / tải ván chơi vào localStorage. Trạng thái game là dữ liệu thuần (JSON) trừ vài chỗ:
// tập công nghệ (Set), các listener của bản tin (hàm, bỏ qua), getter `world.war` (tính lại),
// số Infinity/NaN (mã hoá riêng). Khi tải, dữ liệu được trộn vào một ván mới tạo để giữ getter
// và để các trường thêm ở phiên bản sau có giá trị mặc định.
import { createGame } from './game.js';

export const SAVE_VERSION = 1;
export const SLOTS = { manual: 'luoi-va-lo/save', auto: 'luoi-va-lo/autosave' };
const LOAD_FLAG = 'luoi-va-lo/load-on-start';

export function serialize(G) {
  return JSON.stringify({ v: SAVE_VERSION, at: Date.now(), day: Math.floor(G.t / 86400) + 1, G }, (k, v) => {
    if (k === 'listeners') return undefined;
    if (v instanceof Set) return { __set: [...v] };
    if (typeof v === 'number' && !Number.isFinite(v)) return { __num: String(v) };
    return v;
  });
}

const revive = (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? ('__set' in v ? new Set(v.__set) : '__num' in v ? Number(v.__num) : v) : v);
const plain = (o) => o && typeof o === 'object' && !Array.isArray(o) && !(o instanceof Set);

function merge(dst, src) {
  for (const k of Object.keys(src)) {
    if (Object.getOwnPropertyDescriptor(dst, k)?.get) continue; // getter: tự tính lại
    if (plain(dst[k]) && plain(src[k])) merge(dst[k], src[k]);
    else dst[k] = src[k];
  }
  return dst;
}

/** Dựng lại ván từ chuỗi JSON. Lỗi nếu sai định dạng hoặc khác phiên bản. */
export function deserialize(json) {
  const data = JSON.parse(json, revive);
  if (!data || data.v !== SAVE_VERSION || !data.G?.net) throw new Error('File lưu không hợp lệ hoặc thuộc phiên bản khác');
  return merge(createGame(), data.G);
}

const store = () => (typeof localStorage !== 'undefined' ? localStorage : null);

export function save(G, slot = 'manual') {
  try { store()?.setItem(SLOTS[slot], serialize(G)); return true; } catch { return false; }
}
/** Thông tin ván đã lưu (để hiện trên nút), hoặc null. */
export function info(slot) {
  try {
    const s = store()?.getItem(SLOTS[slot]);
    if (!s) return null;
    const { at, day } = JSON.parse(s.slice(0, 200).replace(/,"G".*$/, '}'));
    return { at, day };
  } catch { return null; }
}
/** Đánh dấu cần tải ván ở lần khởi động tới (rồi tải lại trang để dựng cảnh 3D từ đầu). */
export function requestLoad(slot) { sessionStorage.setItem(LOAD_FLAG, slot); }
/** Gọi khi khởi động: trả về ván đã lưu nếu có yêu cầu tải, ngược lại ván mới. */
export function boot() {
  const slot = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(LOAD_FLAG) : null;
  if (slot) {
    sessionStorage.removeItem(LOAD_FLAG);
    try { return { G: deserialize(store().getItem(SLOTS[slot])), loaded: slot }; } catch (err) { console.warn(err); }
  }
  return { G: createGame(), loaded: null };
}
