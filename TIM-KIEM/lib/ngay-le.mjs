// Nhận tên ngày lễ gõ trong ô tìm: "thứ ba tuần 32 thường niên", "CN XXXII TN năm A", "lễ các thánh",
// "chúa nhật 2 phục sinh", "22/11/2026"… → lọc theo mã lễ / năm / ngày; phần còn lại là câu tìm.
// Danh sách tên lễ lấy từ chính ten_le trong các bài (không có bảng viết tay).
import { boDau } from './tieng-viet.mjs';

const ROMAN = { i: 1, v: 5, x: 10, l: 50 };
function laMa(t) {
  if (!/^[ivxl]+$/.test(t)) return null;
  let n = 0;
  for (let i = 0; i < t.length; i++) { const a = ROMAN[t[i]], b = ROMAN[t[i + 1]] ?? 0; n += a < b ? -a : a; }
  return n >= 1 && n <= 40 ? String(n) : null;
}
const THU = { '2': 'hai', '3': 'ba', '4': 'tu', '5': 'nam', '6': 'sau', '7': 'bay' };
const VIET_TAT = { cn: ['chua', 'nhat'], tn: ['thuong', 'nien'], mv: ['vong'], mc: ['chay'], ps: ['phuc', 'sinh'], gs: ['giang', 'sinh'] };
const BO = new Set(['mua', 'tuan']);   // "Chúa Nhật II Mùa Phục Sinh" = "chúa nhật 2 phục sinh"

/** câu → [{ k: từ chuẩn hóa, i: vị trí từ trong câu gốc }] */
function chuanHoa(s) {
  const goc = s.match(/[\p{L}\p{N}]+/gu) ?? [];
  const out = [];
  goc.forEach((w, i) => {
    let k = boDau(w);
    if (k === 'chu' && boDau(goc[i + 1] ?? '') === 'nhat') k = 'chua';      // "chủ nhật"
    if (VIET_TAT[k]) { for (const x of VIET_TAT[k]) out.push({ k: x, i }); return; }
    if (BO.has(k)) return;
    if (THU[k] && out.at(-1)?.k === 'thu') k = THU[k];                       // "thứ 3" → "thứ ba"
    const r = laMa(k);
    if (r && !(k === 'i' && i === 0)) k = r;
    out.push({ k, i });
  });
  return { goc, toks: out };
}

/** rows: [{ ma, ten, n }] (mã lễ, ten_le, số bài) → bảng tên lễ đã chuẩn hóa, dài trước */
export function taoBangLe(rows) {
  const byKey = new Map();
  for (const r of rows) {
    const ten = r.ten.replace(/\s*[—–-]\s*\(.*$/, '').replace(/\s*[—–]\s.*$/, '');   // bỏ phần chú thích sau "—"
    const toks = chuanHoa(ten).toks.map((t) => t.k);
    if (toks.length < 2) continue;
    const key = toks.join(' ');
    const cu = byKey.get(key);
    if (!cu || r.n > cu.n) byKey.set(key, { toks, ma: r.ma, ten: r.ten, n: r.n });
  }
  // Tên suy từ cấu trúc mã (cho các lễ có ten_le không ghi số tuần, vd 5340 "Chúa Nhật Cuối Cùng Mùa
  // Thường Niên ĐỨC GIÊSU KITÔ VUA…"): 5340 → "chúa nhật 34 thường niên", 1011 → "thứ hai 1 vọng"…
  const tenMa = new Map();
  for (const r of rows) if (!tenMa.has(r.ma) || r.n > tenMa.get(r.ma).n) tenMa.set(r.ma, r);
  const THU_D = ['', 'hai', 'ba', 'tu', 'nam', 'sau', 'bay'];
  const MUA = { '10': ['vong'], '30': ['chay'], '40': ['phuc', 'sinh'] };
  const them = (toks, r) => { const k = toks.join(' '); if (!byKey.has(k)) byKey.set(k, { toks, ma: r.ma, ten: r.ten, n: r.n }); };
  for (const [ma, r] of tenMa) {
    let m = ma.match(/^(10|30|40)(\d)(\d)$/), w, d, mua;
    if (m) { w = +m[2]; d = +m[3]; mua = MUA[m[1]]; }
    else if ((m = ma.match(/^50(\d)(\d)$/))) { w = +m[1]; d = +m[2]; mua = ['thuong', 'nien']; }
    else if ((m = ma.match(/^5([1-3]\d)(\d)$/))) { w = +m[1]; d = +m[2]; mua = ['thuong', 'nien']; }
    if (!mua || !w || d > 6) continue;
    them([...(d ? ['thu', THU_D[d]] : ['chua', 'nhat']), String(w), ...mua], r);
  }
  // Tên gọi quen của lễ Chúa Kitô Vua
  if (tenMa.has('5340')) for (const t of [['chua', 'kito', 'vua'], ['kito', 'vua', 'vu', 'tru']]) them(t, tenMa.get('5340'));
  return [...byKey.values()].sort((a, b) => b.toks.length - a.toks.length);
}

const _bang = new WeakMap();
/** Bảng tên lễ lấy từ chỉ mục SQLite */
export function bangTuCsdl(db) {
  if (!_bang.has(db)) _bang.set(db, taoBangLe(db.prepare(`SELECT m.ma, b.ten_le ten, count(*) n FROM bai_ma m JOIN bai b ON b.id=m.bai_id
    WHERE b.ten_le IS NOT NULL AND b.ten_le<>'' GROUP BY m.ma, b.ten_le`).all()));
  return _bang.get(db);
}

/** bang: kết quả taoBangLe → { ma, ten, nam, ngay, rest } hoặc null */
export function nhanNgayLe(bang, q) {
  let ngay = null, nam = null, s = q;
  const d = s.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (d) {
    ngay = d[4] ? `${d[4]}-${d[5]}-${d[6]}` : `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`;
    s = s.replace(d[0], ' ');
  }
  const y = s.match(/(?<![\p{L}])năm\s+(A|B|C|I{1,2}|lẻ|chẵn|le|chan)(?![\p{L}])/iu);
  if (y) { const v = y[1].toUpperCase(); nam = { 'LẺ': 'I', 'LE': 'I', 'CHẴN': 'II', 'CHAN': 'II' }[v] ?? v; s = s.replace(y[0], ' '); }
  const { goc, toks } = chuanHoa(s);
  const ks = toks.map((t) => t.k);
  let hit = null;
  for (const l of bang) {
    for (let p = 0; p + l.toks.length <= ks.length; p++) {
      if (l.toks.every((t, j) => ks[p + j] === t)) { hit = { l, a: toks[p].i, b: toks[p + l.toks.length - 1].i }; break; }
    }
    if (hit) break;
  }
  if (!hit && !ngay && !nam) return null;
  if (!hit && !ngay) return null;  // chỉ có "năm A" mà không có tên lễ: để nguyên câu tìm
  if (hit && hit.a > 0 && ['le', 'mung'].includes(boDau(goc[hit.a - 1]))) hit.a--;   // "lễ Chúa Kitô Vua"
  const rest = goc.filter((_, i) => !hit || i < hit.a || i > hit.b).join(' ').trim();
  return { ma: hit?.l.ma ?? null, ten: hit?.l.ten ?? null, nam, ngay, rest: hit || ngay ? rest : q };
}
