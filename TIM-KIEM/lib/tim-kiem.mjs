// Bộ tìm kiếm kết hợp: từ khóa (FTS5/BM25) + ý nghĩa (vector) + tham chiếu Kinh Thánh.
// Kết quả luôn là NGUYÊN VĂN đoạn trong file Markdown, kèm số dòng; không tạo đoạn trích bằng AI.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { nfc, boDau, coDau, tach } from './tieng-viet.mjs';
import { docThamChieuTruyVan, dinhDanh, SACH } from './kinh-thanh.mjs';
import { taoVector, MO_HINH_MAC_DINH } from './ollama.mjs';
import { thongTin, LIB_ROOT } from './csdl.mjs';
import { nhanNgayLe, bangTuCsdl } from './ngay-le.mjs';

const RRF_K = 60;
const UNG_VIEN = 400;          // số đoạn lấy từ mỗi nguồn trước khi kết hợp
const MA_TUONG_DUONG = { '95002': '5340' }; // lịch phụng vụ phát 95002 cho lễ Chúa Kitô Vua

// ---------- bộ lọc ----------
let LICH = null;
function maTheoNgay(ngay, root = LIB_ROOT) {
  if (!LICH) {
    const p = join(root, 'TRA-CUU', 'lich-ngay.json');
    LICH = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')).ngay : {};
  }
  const d = LICH[ngay];
  if (!d) throw new Error(`Không có ngày ${ngay} trong TRA-CUU/lich-ngay.json`);
  const y = +ngay.slice(0, 4);
  const out = [];
  for (const le of d.le) {
    let ma = le.celebrationCode ?? le.readingCode;
    if (!ma) continue;
    ma = MA_TUONG_DUONG[ma] ?? ma;
    out.push({ ma, nam: d.nam ?? (le.celebrationCode ? null : (y % 2 ? 'I' : 'II')), ten: le.ten });
  }
  return out;
}

/** → Set<bai_id> được phép, hoặc null nếu không lọc */
function baiDuocPhep(db, loc = {}) {
  const dk = [], ts = [];
  let maList = [].concat(loc.ma ?? []).filter(Boolean).map((m) => MA_TUONG_DUONG[m] ?? m);
  let namList = [].concat(loc.nam ?? []).filter(Boolean);
  if (loc.ngay) {
    const ls = maTheoNgay(loc.ngay);
    const parts = ls.map((l) => {
      ts.push(l.ma);
      if (!l.nam) return `id IN (SELECT bai_id FROM bai_ma WHERE ma=?)`;
      ts.push(`%"${l.nam}"%`);
      return `(id IN (SELECT bai_id FROM bai_ma WHERE ma=?) AND (nam='[]' OR nam LIKE ?))`;
    });
    dk.push(parts.length ? `(${parts.join(' OR ')})` : '0');
  }
  if (maList.length) { dk.push(`id IN (SELECT bai_id FROM bai_ma WHERE ma IN (${maList.map(() => '?').join(',')}))`); ts.push(...maList); }
  if (namList.length) { dk.push(`(${namList.map(() => 'nam LIKE ?').join(' OR ')})`); ts.push(...namList.map((n) => `%"${n}"%`)); }
  if (loc.sach) { dk.push(`id IN (SELECT bai_id FROM tham_chieu WHERE sach=?)`); ts.push(loc.sach); }
  if (!dk.length && !loc.tac_gia) return null;
  const rows = db.prepare(`SELECT id, tac_gia FROM bai ${dk.length ? 'WHERE ' + dk.join(' AND ') : ''}`).all(...ts);
  const tg = loc.tac_gia ? boDau(loc.tac_gia).replace(/\s+/g, ' ').trim() : null;
  return new Set(rows.filter((r) => !tg || boDau(r.tac_gia ?? 'vô danh').includes(tg)).map((r) => r.id));
}

// ---------- từ khóa ----------
const quote = (t) => `"${t.replace(/"/g, '""')}"`;
/** Câu gõ của người dùng → biểu thức FTS5. Mặc định tìm đúng CỤM (vì từ tiếng Việt gồm nhiều âm tiết). */
export function bieuThucFts(q) {
  const s = nfc(q).trim();
  const khongDau = !coDau(s);
  const col = khongDau ? 'khong_dau' : 'noi_dung';
  const norm = (t) => (khongDau ? boDau(t) : t);
  // Cú pháp nâng cao: "cụm a" OR "cụm b", -từ_loại_trừ
  const cum = [...s.matchAll(/(-?)"([^"]+)"|(-?)(\S+)/g)];
  const hasAdv = /"|\bOR\b|(^|\s)-\S/.test(s);
  if (!hasAdv) {
    const toks = tach(norm(s));
    if (!toks.length) return null;
    return { col, phrase: `${col}:${quote(toks.join(' '))}`, near: toks.length > 1 ? `${col}:NEAR(${toks.map(quote).join(' ')}, 8)` : null, toks: [toks], khongDau };
  }
  const pos = [], neg = [], ors = [], toksAll = [];
  let pendingOr = false;
  for (const m of cum) {
    const neg_ = m[1] || m[3];
    const txt = m[2] ?? m[4];
    if (!m[2] && txt === 'OR') { pendingOr = true; continue; }
    const toks = tach(norm(txt));
    if (!toks.length) continue;
    const e = quote(toks.join(' '));
    if (neg_) neg.push(e);
    else if (pendingOr && pos.length) { ors.push(pos.pop() + ' OR ' + e); pendingOr = false; toksAll.push(toks); }
    else { pos.push(e); toksAll.push(toks); }
  }
  const all = [...pos, ...ors.map((o) => `(${o})`)];
  if (!all.length) return null;
  let expr = `${col}:(${all.join(' AND ')})`;
  if (neg.length) expr += ` NOT ${col}:(${neg.join(' OR ')})`;
  return { col, phrase: expr, near: null, toks: toksAll, khongDau };
}

function timTuKhoa(db, bt, phep) {
  const run = (expr) => db.prepare(`SELECT rowid id, bm25(doan_fts) s FROM doan_fts WHERE doan_fts MATCH ? ORDER BY s LIMIT ?`).all(expr, 5000);
  let rows = run(bt.phrase), kieu = 'cum';
  if (rows.length < 5 && bt.near) { rows = rows.concat(run(bt.near).filter((r) => !rows.some((x) => x.id === r.id))); kieu = 'gan'; }
  if (phep) rows = rows.filter((r) => phep.has(baiCuaDoan(db, r.id)));
  return { rows: rows.map((r) => r.id), kieu };
}
const _bcd = new Map();
let _bcdStmt = null, _bcdDb = null;
function baiCuaDoan(db, id) {
  if (_bcdDb !== db) { _bcdDb = db; _bcdStmt = db.prepare('SELECT bai_id FROM doan WHERE id=?'); _bcd.clear(); }
  let b = _bcd.get(id);
  if (b === undefined) { b = _bcdStmt.get(id)?.bai_id; _bcd.set(id, b); }
  return b;
}

function timTieuDe(db, bt, phep) {
  const col = bt.khongDau ? 'khong_dau' : '{chu_de tac_gia ten_le}';
  const expr = bt.phrase.replace(new RegExp(`^${bt.col}:`), `${col}:`).replace(new RegExp(` NOT ${bt.col}:`), ` NOT ${col}:`);
  try {
    let rows = db.prepare(`SELECT rowid id FROM bai_fts WHERE bai_fts MATCH ? ORDER BY bm25(bai_fts) LIMIT 200`).all(expr);
    if (phep) rows = rows.filter((r) => phep.has(r.id));
    return rows.map((r) => r.id);
  } catch { return []; }
}

// ---------- Kinh Thánh ----------
function timKinhThanh(db, refs, phep) {
  const doan = new Map(), bai = new Map();
  for (const r of refs) {
    const rows = db.prepare(`SELECT bai_id, doan_id, tu, den, khong_chac, nguon FROM tham_chieu
      WHERE sach=? AND chuong=? AND (? IS NULL OR tu IS NULL OR (tu<=? AND den>=?))`).all(r.sach, r.chuong, r.tu, r.den ?? r.tu, r.tu);
    for (const x of rows) {
      if (phep && !phep.has(x.bai_id)) continue;
      // trùng khít khoảng câu được điểm cao hơn trùng một phần; tham chiếu không chắc xếp sau
      const khit = r.tu != null && x.tu === r.tu && x.den === (r.den ?? r.tu) ? 2 : 1;
      const d = khit - x.khong_chac * 0.5;
      if (x.nguon === 'yaml') bai.set(x.bai_id, Math.max(bai.get(x.bai_id) ?? 0, d));
      else doan.set(x.doan_id, Math.max(doan.get(x.doan_id) ?? 0, d + 0.5));
    }
  }
  return {
    doan: [...doan.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 2000),
    bai: [...bai.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 2000),
  };
}

// ---------- ý nghĩa ----------
let MA_TRAN = null; // { model, dim, ids: Int32Array, vecs: Float32Array }
export function napVector(db) {
  const model = thongTin(db, 'embed_model');
  const n = db.prepare('SELECT count(*) n FROM vector').get().n;
  if (!model || !n) return (MA_TRAN = null);
  if (MA_TRAN && MA_TRAN.n === n && MA_TRAN.model === model) return MA_TRAN;
  const dim = +thongTin(db, 'embed_dim');
  const ids = new Int32Array(n), vecs = new Float32Array(n * dim);
  let i = 0;
  for (const r of db.prepare('SELECT doan_id, vec FROM vector ORDER BY doan_id').iterate()) {
    ids[i] = r.doan_id;
    vecs.set(new Float32Array(r.vec.buffer, r.vec.byteOffset, dim), i * dim);
    i++;
  }
  return (MA_TRAN = { model, dim, n, ids, vecs });
}

async function timYNghia(db, q, phep) {
  const M = napVector(db);
  if (!M) return { rows: [], loi: 'Chưa có vector. Chạy: node TIM-KIEM/tao-vector.mjs' };
  let qv;
  try { [qv] = await taoVector([q], M.model, { timeoutMs: 60000 }); }
  catch (e) { return { rows: [], loi: `Không tạo được vector cho câu tìm: ${e.message}` }; }
  if (qv.length !== M.dim) return { rows: [], loi: 'Vector câu tìm khác số chiều với chỉ mục (đổi mô hình?).' };
  const { ids, vecs, dim, n } = M;
  const top = [];             // giữ UNG_VIEN điểm cao nhất
  let minS = -Infinity;
  for (let i = 0; i < n; i++) {
    let s = 0;
    const o = i * dim;
    for (let j = 0; j < dim; j++) s += vecs[o + j] * qv[j];
    if (top.length < UNG_VIEN || s > minS) {
      if (phep && !phep.has(baiCuaDoan(db, ids[i]))) continue;
      top.push([ids[i], s]);
      if (top.length > UNG_VIEN * 2) { top.sort((a, b) => b[1] - a[1]); top.length = UNG_VIEN; minS = top.at(-1)[1]; }
    }
  }
  top.sort((a, b) => b[1] - a[1]);
  return { rows: top.slice(0, UNG_VIEN).map((x) => x[0]), diem: new Map(top.slice(0, UNG_VIEN)) };
}

// ---------- tô sáng ----------
function khop(noiDung, toksList, khongDau, refs) {
  const src = khongDau ? boDau(noiDung) : noiDung.toLowerCase();
  const out = [];
  for (const toks of toksList ?? []) {
    const t = (khongDau ? toks : toks.map((x) => x.toLowerCase()));
    // cụm đầy đủ trước; không có thì từng âm tiết
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${t.map(esc).join('[^\\p{L}\\p{N}]+')}(?![\\p{L}\\p{N}])`, 'gu');
    let found = false;
    for (const m of src.matchAll(re)) { out.push([m.index, m.index + m[0].length]); found = true; }
    if (!found && t.length > 1) for (const w of t) {
      for (const m of src.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${esc(w)}(?![\\p{L}\\p{N}])`, 'gu'))) out.push([m.index, m.index + m[0].length]);
    }
  }
  for (const r of refs ?? []) {
    let i = -1;
    while ((i = noiDung.indexOf(r, i + 1)) >= 0) out.push([i, i + r.length]);
  }
  return out.sort((a, b) => a[0] - b[0]).filter((x, i, a) => !i || x[0] >= a[i - 1][1]);
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- kết hợp ----------
/**
 * timKiem(db, "tỉnh thức", { che_do: 'tat-ca'|'tu-khoa'|'y-nghia', loc: { ma, nam, ngay, tac_gia, sach }, gioi_han: 20, bo_qua: 0 })
 * → { tong_bai, ket_qua: [{ bai, diem, doan: [...] }], ghi_chu: [...] }
 */
export async function timKiem(db, q, { che_do = 'tat-ca', loc = {}, gioi_han = 20, bo_qua = 0, doan_moi_bai = 3 } = {}) {
  q = nfc(q).trim();
  const ghiChu = [];
  // "thứ ba tuần 32 thường niên", "CN 32 TN năm A", "22/11/2026" trong ô tìm → thành bộ lọc
  if (q && !docThamChieuTruyVan(q).length) {
    const nl = nhanNgayLe(bangTuCsdl(db), q);
    if (nl) {
      loc = { ...loc };
      if (nl.ma) loc.ma = nl.ma;
      if (nl.nam) loc.nam = nl.nam;
      if (nl.ngay) loc.ngay = nl.ngay;
      ghiChu.push(`Lọc theo ${[nl.ten && `lễ ${nl.ten} (mã ${nl.ma})`, nl.nam && `năm ${nl.nam}`, nl.ngay && `ngày ${nl.ngay}`].filter(Boolean).join(', ')}${nl.rest ? `; tìm "${nl.rest}" trong các bài đó` : ''}.`);
      q = nl.rest;
    }
  }
  const phep = baiDuocPhep(db, loc);
  const diem = new Map(), nguon = new Map();
  const cong = (id, rank, ten, w = 1) => {
    diem.set(id, (diem.get(id) ?? 0) + w / (RRF_K + rank));
    (nguon.get(id) ?? nguon.set(id, new Set()).get(id)).add(ten);
  };
  const diemBai = new Map();
  let bt = null, refs = [];

  refs = q ? docThamChieuTruyVan(q) : [];
  if (refs.length) {
    ghiChu.push(`Tìm theo Kinh Thánh: ${refs.map(dinhDanh).join('; ')} (${SACH[refs[0].sach]}).`);
    const r = timKinhThanh(db, refs, phep);
    r.doan.forEach((id, i) => cong(id, i, 'kinh-thanh', 1.5));
    r.bai.forEach((id, i) => diemBai.set(id, (diemBai.get(id) ?? 0) + 1 / (RRF_K + i)));
  } else if (q) {
    if (che_do !== 'y-nghia') {
      bt = bieuThucFts(q);
      if (bt) {
        try {
          const r = timTuKhoa(db, bt, phep);
          r.rows.forEach((id, i) => cong(id, i, 'tu-khoa'));
          if (r.kieu === 'gan') ghiChu.push('Ít kết quả đúng cụm từ; có thêm các đoạn chứa các từ gần nhau.');
          if (bt.khongDau) ghiChu.push('Câu tìm không dấu: tìm trên bản bỏ dấu (gõ có dấu để tìm chính xác hơn).');
          timTieuDe(db, bt, phep).forEach((id, i) => diemBai.set(id, (diemBai.get(id) ?? 0) + 1 / (RRF_K + i)));
        } catch (e) { ghiChu.push(`Câu tìm từ khóa không hợp lệ: ${e.message}`); }
      }
    }
    if (che_do !== 'tu-khoa') {
      const r = await timYNghia(db, q, phep);
      if (r.loi) ghiChu.push(r.loi);
      r.rows.forEach((id, i) => cong(id, i, 'y-nghia'));
    }
  } else if (phep) {
    // không gõ gì, chỉ lọc (vd theo ngày): liệt kê bài
    [...phep].forEach((id, i) => diemBai.set(id, 1 / (RRF_K + i)));
  }

  // gom theo bài
  const theoBai = new Map();
  const getDoan = db.prepare('SELECT id, bai_id, thu_tu, dong_dau, dong_cuoi, noi_dung FROM doan WHERE id=?');
  for (const [id, s] of diem) {
    const b = baiCuaDoan(db, id);
    const g = theoBai.get(b) ?? theoBai.set(b, { diem: 0, doan: [] }).get(b);
    g.doan.push({ id, s });
  }
  for (const [b, s] of diemBai) {
    const g = theoBai.get(b) ?? theoBai.set(b, { diem: 0, doan: [] }).get(b);
    g.cong = s;
  }
  for (const g of theoBai.values()) {
    g.doan.sort((a, b) => b.s - a.s);
    // điểm bài = đoạn tốt nhất + một phần đoạn thứ hai, thứ ba + điểm tiêu đề/tin_mung
    g.diem = (g.doan[0]?.s ?? 0) + 0.3 * (g.doan[1]?.s ?? 0) + 0.15 * (g.doan[2]?.s ?? 0) + (g.cong ?? 0) * 0.8;
  }
  const xep = [...theoBai.entries()].sort((a, b) => b[1].diem - a[1].diem);
  const getBai = db.prepare('SELECT * FROM bai WHERE id=?');
  const dau = db.prepare('SELECT id FROM doan WHERE bai_id=? ORDER BY thu_tu LIMIT 1');
  const tcDoan = db.prepare('SELECT raw FROM tham_chieu WHERE doan_id=? AND sach=? AND chuong=?');
  const ket_qua = xep.slice(bo_qua, bo_qua + gioi_han).map(([bid, g]) => {
    const b = getBai.get(bid);
    let ds = g.doan.slice(0, doan_moi_bai);
    if (!ds.length) { const d = dau.get(bid); if (d) ds = [{ id: d.id, s: 0 }]; }
    return {
      diem: +g.diem.toFixed(5),
      bai: {
        duong_dan: b.duong_dan, chu_de: b.chu_de, tac_gia: b.tac_gia, ten_le: b.ten_le,
        ma_le: JSON.parse(b.ma_le), nam: JSON.parse(b.nam), tin_mung: JSON.parse(b.tin_mung), so_doan: b.so_doan,
        khop_tieu_de_hoac_tin_mung: !!g.cong,
      },
      doan: ds.map(({ id }) => {
        const d = getDoan.get(id);
        const rawRefs = refs.flatMap((r) => tcDoan.all(id, r.sach, r.chuong).map((x) => x.raw));
        return { id, thu_tu: d.thu_tu, dong_dau: d.dong_dau, dong_cuoi: d.dong_cuoi, noi_dung: d.noi_dung,
          nguon: [...(nguon.get(id) ?? [])], khop: khop(d.noi_dung, bt?.toks, bt?.khongDau, rawRefs) };
      }),
    };
  });
  return { cau_tim: q, che_do, tong_bai: theoBai.size, ket_qua, ghi_chu: ghiChu };
}

/** Đọc cả bài (nguyên văn từ file Markdown) để mở xem */
export function docCaBai(db, duongDan, root = thongTin(db, 'thu_muc_nguon') ?? LIB_ROOT) {
  const b = db.prepare('SELECT * FROM bai WHERE duong_dan=?').get(duongDan);
  if (!b) return null;
  const text = readFileSync(join(root, duongDan), 'utf8');
  return { bai: { ...b, ma_le: JSON.parse(b.ma_le), nam: JSON.parse(b.nam), tin_mung: JSON.parse(b.tin_mung) }, noi_dung: text };
}
