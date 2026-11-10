// Đọc file bài giảng Markdown (YAML 6 trường) và chia thành các đoạn để tìm kiếm.
import { nfc } from './tieng-viet.mjs';

const FM_RE = /^---\n([\s\S]*?)\n---\n?/;

/** → { meta, body, bodyLine } ; bodyLine = số dòng (1-based) của dòng đầu tiên sau YAML */
export function docBai(text) {
  const s = nfc(text).replace(/\r\n?/g, '\n');
  const m = s.match(FM_RE);
  const meta = {};
  if (m) {
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':');
      if (i < 1) continue;
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      try { meta[k] = JSON.parse(v); } catch { meta[k] = v.replace(/^["']|["']$/g, ''); }
    }
  }
  const head = m ? m[0] : '';
  const bodyLine = head ? head.split('\n').length - (head.endsWith('\n') ? 1 : 0) + 1 : 1;
  return { meta, body: s.slice(head.length), bodyLine };
}

const demTu = (t) => (t.match(/[\p{L}\p{N}]+/gu) ?? []).length;
const laTieuDe = (l) => {
  const t = l.replace(/^[#*\s]+|[*\s]+$/g, '');
  return t.length > 0 && demTu(t) <= 14 && !/[.,;:!?…"”]$/.test(t);
};

/**
 * Chia thân bài thành đoạn ~100–300 từ, theo đoạn văn có sẵn; không cắt giữa đoạn văn
 * trừ khi đoạn văn dài quá 400 từ (khi đó cắt ở cuối câu).
 * Trả về [{ thu_tu, dong_dau, dong_cuoi, noi_dung, so_tu }] — dong_* là số dòng trong file gốc.
 */
export function chiaDoan(body, bodyLine, { min = 100, max = 300 } = {}) {
  const lines = body.split('\n');
  const units = []; // { dong, text, tu, tieuDe }
  lines.forEach((l, i) => {
    const t = l.trim();
    if (!t) return;
    if (i === lines.findIndex((x) => x.trim()) && t.startsWith('# ')) return; // dòng tiêu đề chính
    const dong = bodyLine + i;
    const tu = demTu(t);
    if (tu > 400) {
      // cắt đoạn văn quá dài ở cuối câu
      const cau = [];
      for (const c of t.match(/[^.!?…]+[.!?…]+["”’)]*\s*|[^.!?…]+$/g) ?? [t]) {
        // câu dài bất thường (không có dấu chấm): cắt theo số từ
        if (demTu(c) <= max) { cau.push(c); continue; }
        const ws = c.split(/(?<=\s)/);
        for (let k = 0; k < ws.length; k += max) cau.push(ws.slice(k, k + max).join(''));
      }
      let buf = '';
      for (const c of cau) {
        if (buf && demTu(buf + c) > max) { units.push({ dong, text: buf.trim(), tu: demTu(buf) }); buf = ''; }
        buf += c;
      }
      if (buf.trim()) units.push({ dong, text: buf.trim(), tu: demTu(buf) });
    } else units.push({ dong, text: t, tu, tieuDe: laTieuDe(t) });
  });
  const out = [];
  let cur = null;
  const flush = () => { if (cur) { out.push(cur); cur = null; } };
  for (const u of units) {
    if (cur && (cur.so_tu + u.tu > max || (u.tieuDe && cur.so_tu >= min * 0.6))) flush();
    if (!cur) cur = { dong_dau: u.dong, dong_cuoi: u.dong, noi_dung: u.text, so_tu: u.tu };
    else { cur.noi_dung += '\n' + u.text; cur.dong_cuoi = u.dong; cur.so_tu += u.tu; }
    if (cur.so_tu >= max) flush();
  }
  flush();
  // đoạn cuối quá ngắn thì gộp vào đoạn trước
  if (out.length > 1 && out.at(-1).so_tu < 40 && out.at(-2).so_tu + out.at(-1).so_tu <= max * 1.3) {
    const z = out.pop(), y = out.at(-1);
    y.noi_dung += '\n' + z.noi_dung; y.dong_cuoi = z.dong_cuoi; y.so_tu += z.so_tu;
  }
  return out.map((c, i) => ({ thu_tu: i, ...c }));
}
