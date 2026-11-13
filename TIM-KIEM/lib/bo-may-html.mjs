// Bộ máy tìm kiếm chạy ngay trong trình duyệt, cho bản một-file HTML (không máy chủ, không Ollama).
// Tìm: cụm từ (có dấu / không dấu), "cụm" "cụm", OR, -loại_trừ; câu Kinh Thánh; tên ngày lễ; ngày.
// Dữ liệu D do dong-goi-html.mjs tạo ra từ chỉ mục SQLite.
import { nfc, boDau, coDau, tach } from './tieng-viet.mjs';
import { docThamChieuTruyVan, dinhDanh, SACH } from './kinh-thanh.mjs';
import { taoBangLe, nhanNgayLe } from './ngay-le.mjs';

/** Bỏ dấu + viết thường cả kho thật nhanh, giữ nguyên độ dài (chuỗi 1 byte/ký tự cho đỡ tốn bộ nhớ). */
function boDauNhanh(s) {
  const bang = new Uint8Array(65536);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    let f = bang[c];
    if (!f) {
      const b = boDau(String.fromCharCode(c)).charCodeAt(0);
      f = bang[c] = b < 128 ? (b || 32) : 63;   // ký tự ngoài Latin → '?'
    }
    out[i] = f;
  }
  return new TextDecoder('latin1').decode(out);   // mọi byte < 128 nên giữ nguyên độ dài
}

const W = '[a-z0-9]';
const reCum = (toks) => new RegExp(`(?<!${W})${toks.map((t) => t.replace(/[^a-z0-9]/g, '')).join('[^a-z0-9]+')}(?!${W})`, 'g');

export function taoBoMay(D) {
  const N = D.doan.length;
  const batDau = new Int32Array(N + 1);
  let tong = 0;
  for (let i = 0; i < N; i++) { batDau[i] = tong; tong += D.doan[i].length + 1; }
  batDau[N] = tong;
  const goc = D.doan.join('\n');
  const gap = boDauNhanh(goc);
  const tieuDeGoc = D.bai.map((b) => `${b[1] ?? ''} ${b[2] ?? ''} ${b[3] ?? ''}`.toLowerCase());
  const tieuDe = tieuDeGoc.map(boDau);
  const doanCuaBai = D.bai.map(() => []);
  D.doan_bai.forEach((b, i) => doanCuaBai[b].push(i));
  const bangLe = taoBangLe(D.le.map(([ma, ten, n]) => ({ ma, ten, n })));
  const sachIdx = D.sach;

  const doanTaiViTri = (p) => { let lo = 0, hi = N - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (batDau[m] <= p) lo = m; else hi = m - 1; } return lo; };

  /** cụm → Map(doan → số lần). Có dấu thì kiểm lại đúng dấu trên nguyên văn. */
  function timCum(cum, cho) {
    const toksGoc = tach(cum).map((t) => t.toLowerCase());
    const toks = toksGoc.map(boDau);
    const out = new Map();
    if (!toks.length || toks.some((t) => !/^[a-z0-9]+$/.test(t))) return out;
    const dungDau = coDau(cum);
    const re = reCum(toks);
    let m;
    while ((m = re.exec(gap))) {
      if (dungDau) {
        const t = tach(goc.substr(m.index, m[0].length)).map((x) => x.toLowerCase());
        if (t.length !== toksGoc.length || t.some((x, i) => x !== toksGoc[i])) continue;
      }
      const d = doanTaiViTri(m.index);
      if (cho && !cho[D.doan_bai[d]]) continue;
      out.set(d, (out.get(d) ?? 0) + 1);
    }
    return out;
  }

  function phanTich(q) {
    if (!/"|\bOR\b|(^|\s)-\S/.test(q)) return { va: [[q]], khong: [], don: true };
    const va = [], khong = [];
    let hoi = false;
    for (const m of q.matchAll(/(-?)"([^"]+)"|(-?)(\S+)/g)) {
      const am = m[1] || m[3], t = m[2] ?? m[4];
      if (!m[2] && t === 'OR') { hoi = true; continue; }
      if (!tach(t).length) continue;
      if (am) khong.push(t);
      else if (hoi && va.length) { va.at(-1).push(t); hoi = false; }
      else va.push([t]);
    }
    return { va, khong, don: false };
  }

  function choPhep(loc) {
    const dk = [];
    const ma = loc.ma ? [].concat(loc.ma).map((m) => (m === '95002' ? '5340' : m)) : null;
    if (ma) dk.push((b) => b[4].some((x) => ma.includes(x)));
    if (loc.nam) dk.push((b) => b[5].includes(loc.nam));
    if (loc.tac_gia) { const t = boDau(loc.tac_gia).trim(); dk.push((b) => boDau(b[2] ?? 'vô danh').includes(t)); }
    if (loc.ngay) {
      const ls = D.lich[loc.ngay];
      if (!ls) throw new Error(`Không có ngày ${loc.ngay} trong lịch (chỉ có 2025–2040)`);
      dk.push((b) => ls.some(([m, n]) => b[4].includes(m) && (!n || !b[5].length || b[5].includes(n))));
    }
    if (loc.sach) {
      const s = sachIdx.indexOf(loc.sach), co = new Uint8Array(D.bai.length);
      for (let i = 0; i < D.tc.length; i += 6) if (D.tc[i + 1] === s) co[D.doan_bai[D.tc[i]]] = 1;
      for (let i = 0; i < D.tc_bai.length; i += 6) if (D.tc_bai[i + 1] === s) co[D.tc_bai[i]] = 1;
      dk.push((b, i) => co[i]);
    }
    if (!dk.length) return null;
    const cho = new Uint8Array(D.bai.length);
    D.bai.forEach((b, i) => { if (dk.every((f) => f(b, i))) cho[i] = 1; });
    return cho;
  }

  function khop(txt, cums, raws) {
    const src = boDau(txt), out = [];
    for (const c of cums) {
      const toks = tach(c).map(boDau);
      if (!toks.length) continue;
      const re = reCum(toks);
      let m, co = false;
      while ((m = re.exec(src))) { out.push([m.index, m.index + m[0].length]); co = true; }
      if (!co && toks.length > 1) for (const t of toks) { const r = reCum([t]); while ((m = r.exec(src))) out.push([m.index, m.index + m[0].length]); }
    }
    for (const r of raws) { let i = -1; while ((i = txt.indexOf(r, i + 1)) >= 0) out.push([i, i + r.length]); }
    return out.sort((a, b) => a[0] - b[0]).filter((x, i, a) => !i || x[0] >= a[i - 1][1]);
  }

  /** → { tong_bai, ket_qua: [{ i, bai, diem, doan: [{ i, noi_dung, khop }] }], ghi_chu } */
  function tim(q, { loc = {}, trang = 0, moiTrang = 20 } = {}) {
    q = nfc(q).trim();
    const ghiChu = [];
    let refs = q ? docThamChieuTruyVan(q) : [];
    if (q && !refs.length) {
      const nl = nhanNgayLe(bangLe, q);
      if (nl) {
        loc = { ...loc, ...(nl.ma && { ma: nl.ma }), ...(nl.nam && { nam: nl.nam }), ...(nl.ngay && { ngay: nl.ngay }) };
        ghiChu.push(`Lọc theo ${[nl.ten && `lễ ${nl.ten} (mã ${nl.ma})`, nl.nam && `năm ${nl.nam}`, nl.ngay && `ngày ${nl.ngay}`].filter(Boolean).join(', ')}${nl.rest ? `; tìm "${nl.rest}" trong các bài đó` : ''}.`);
        q = nl.rest;
      }
    }
    const cho = choPhep(loc);
    const diemDoan = new Map(), cong = new Map();
    let cums = [], raws = [];
    if (refs.length) {
      ghiChu.push(`Tìm theo Kinh Thánh: ${refs.map(dinhDanh).join('; ')} (${SACH[refs[0].sach]}).`);
      const hop = (arr, kieu) => {
        for (let i = 0; i < arr.length; i += 6) {
          const [x, s, ch, tu, den, kc] = arr.slice(i, i + 6);
          for (const r of refs) {
            if (sachIdx[s] !== r.sach || ch !== r.chuong) continue;
            if (r.tu != null && tu >= 0 && !(tu <= (r.den ?? r.tu) && den >= r.tu)) continue;
            const d = (r.tu != null && tu === r.tu && den === (r.den ?? r.tu) ? 2 : 1) - kc * 0.5;
            if (kieu === 'doan') { if (cho && !cho[D.doan_bai[x]]) continue; diemDoan.set(x, Math.max(diemDoan.get(x) ?? 0, d + 0.5)); }
            else { if (cho && !cho[x]) continue; cong.set(x, Math.max(cong.get(x) ?? 0, d * 0.5)); }
          }
        }
      };
      hop(D.tc, 'doan'); hop(D.tc_bai, 'bai');
      raws = [...new Set(refs.map((r) => r.raw))];
    } else if (q) {
      const { va, khong, don } = phanTich(q);
      cums = va.flat();
      if (!coDau(q)) ghiChu.push('Câu tìm không dấu: tìm trên bản bỏ dấu (gõ có dấu để tìm chính xác hơn).');
      let tap = null;
      for (const nhom of va) {
        const m = new Map();
        for (const c of nhom) for (const [d, n] of timCum(c, cho)) m.set(d, (m.get(d) ?? 0) + n);
        tap = tap ? new Map([...tap].filter(([d]) => m.has(d)).map(([d, n]) => [d, n + m.get(d)])) : m;
      }
      for (const c of khong) for (const d of timCum(c, cho).keys()) tap?.delete(d);
      if (don && tap.size < 5 && tach(q).length > 1) {
        // ít kết quả đúng cụm: lấy thêm các đoạn có đủ mọi từ
        let gan = null;
        for (const t of tach(q)) { const m = timCum(t, cho); gan = gan ? new Map([...gan].filter(([d]) => m.has(d)).map(([d, n]) => [d, n + m.get(d)])) : m; }
        let them = 0;
        for (const [d, n] of gan) if (!tap.has(d)) { tap.set(d, n * 0.3); them++; }
        if (them) { ghiChu.push('Ít kết quả đúng cụm từ; có thêm các đoạn chứa đủ các từ.'); cums.push(...tach(q)); }
      }
      for (const [d, n] of tap ?? []) diemDoan.set(d, Math.log1p(n) / (1 + D.doan[d].length / 3000));
      // tiêu đề / tác giả / tên lễ có đủ các cụm (có dấu thì so đúng dấu)
      const tdRe = cums.map((c) => {
        const tk = tach(c).map((t) => t.toLowerCase());
        return coDau(c)
          ? { goc: true, re: new RegExp(`(?<![\\p{L}\\p{N}])${tk.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^\\p{L}\\p{N}]+')}(?![\\p{L}\\p{N}])`, 'u') }
          : { goc: false, re: reCum(tk.map(boDau)) };
      });
      tieuDe.forEach((t, i) => {
        if ((cho && !cho[i]) || !tdRe.length) return;
        if (tdRe.every(({ goc, re }) => { re.lastIndex = 0; return re.test(goc ? tieuDeGoc[i] : t); })) cong.set(i, (cong.get(i) ?? 0) + 1);
      });
    } else if (cho) {
      cho.forEach((v, i) => v && cong.set(i, 0.001));
    }
    // gom theo bài
    const theoBai = new Map();
    for (const [d, s] of diemDoan) { const b = D.doan_bai[d]; (theoBai.get(b) ?? theoBai.set(b, []).get(b)).push([d, s]); }
    for (const b of cong.keys()) if (!theoBai.has(b)) theoBai.set(b, []);
    const xep = [...theoBai].map(([b, ds]) => {
      ds.sort((x, y) => y[1] - x[1]);
      return [b, ds, (ds[0]?.[1] ?? 0) + 0.3 * (ds[1]?.[1] ?? 0) + 0.15 * (ds[2]?.[1] ?? 0) + (cong.get(b) ?? 0)];
    }).sort((x, y) => y[2] - x[2] || x[0] - y[0]);
    const ket_qua = xep.slice(trang * moiTrang, (trang + 1) * moiTrang).map(([b, ds, s]) => {
      const ch = ds.length ? ds.slice(0, 3).map((x) => x[0]) : [doanCuaBai[b][0]].filter((x) => x != null);
      return { i: b, bai: thongTinBai(b), diem: s, doan: ch.map((d) => ({ i: d, noi_dung: D.doan[d], khop: khop(D.doan[d], cums, raws) })) };
    });
    // loc_dung: bộ lọc thực sự đã áp (kể cả mã lễ / năm / ngày nhận ra từ câu tìm) — giao diện dùng để hiện gợi ý bài giảng
    return { tong_bai: xep.length, ket_qua, ghi_chu: ghiChu, loc_dung: loc };
  }

  function thongTinBai(b) {
    const [duong_dan, chu_de, tac_gia, ten_le, ma_le, nam, tin_mung] = D.bai[b];
    return { duong_dan, chu_de, tac_gia, ten_le, ma_le, nam, tin_mung };
  }
  /** cả bài: danh sách đoạn theo thứ tự */
  const docBai = (b) => ({ bai: thongTinBai(b), doan: doanCuaBai[b].map((d) => ({ i: d, noi_dung: D.doan[d] })) });

  return { tim, docBai, so_bai: D.bai.length, so_doan: N, bang_le: D.le, sach: sachIdx, tac_gia: D.tac_gia };
}
