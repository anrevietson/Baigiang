// Kiểm tra một bộ gợi ý bài giảng: mọi trích dẫn phải truy được về nguyên văn.
// Không gọi AI, không mạng. Dùng chung cho ghi-goi-y.mjs, kiem-tra.mjs và kiểm thử.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { timThamChieu } from '../../TIM-KIEM/lib/kinh-thanh.mjs';
import { boDau } from '../../TIM-KIEM/lib/tieng-viet.mjs';
import { AI_DIR, LIB_ROOT, OUTPUT, REPORTS, NGUON, docJson, chuanVanBan, sha256 } from './chung.mjs';

const sha1 = (s) => createHash('sha1').update(s).digest('hex');
const LOAI_NGUON = ['kim-chi-nam-phu-luc', 'kim-chi-nam-nguyen-tac', 'bai-giang'];
const TRANG_THAI = ['draft', 'da-duyet', 'can-sua', 'tu-choi'];
const DOAN = ['firstReading', 'psalms', 'secondReading', 'alleluia', 'gospel'];
/** chuẩn để so trích dẫn: như chuanVanBan + bỏ ký hiệu Markdown */
const chuanTrich = (s) => chuanVanBan(String(s ?? '').replace(/[*_#>`]/g, '')).replace(/\s*([,.;:!?])/g, '$1');

let _kcn = null, _kcnRef = null;
export function kimChiNam() {
  if (!_kcnRef) _kcnRef = docJson(join(AI_DIR, 'HUONG-DAN', 'kim-chi-nam-tham-chieu.json'));
  if (!_kcn) {
    const lines = readFileSync(join(NGUON, 'kim-chi-nam-giang-le.en.txt'), 'utf8').split('\n');
    _kcn = new Map();   // số đoạn → văn bản đoạn (đến trước đoạn số kế tiếp)
    let cur = null;
    for (const l of lines) {
      const m = l.match(/^(\d{1,3})\.\s?\S/);
      if (m && +m[1] >= 1 && +m[1] <= 160 && !_kcn.has(m[1])) { cur = m[1]; _kcn.set(cur, l); continue; }
      if (cur) _kcn.set(cur, _kcn.get(cur) + ' ' + l);
      if (/^Appendix I$/.test(l.trim())) cur = null;
    }
  }
  return { ref: _kcnRef, doan: _kcn };
}

/** văn bản có thể trích của một đoạn bài đọc */
function vanBanDoan(s) {
  if (!s) return '';
  return [s.content, s.response, ...(s.verses ?? []), s.verse, s.info].filter(Boolean).join(' ').replace(/\r/g, ' ');
}

/** ref có nằm trong excerpt không: cùng sách, cùng chương, khoảng câu chồng lên. null = không xác định được */
function trongExcerpt(ref, excerpt) {
  const r = timThamChieu(ref)[0];
  // "Cv 6, 8-10; 7,54-59": đoạn sau dấu ";" không ghi sách → kế thừa sách của đoạn trước
  const ex = [];
  let sachTruoc = null;
  for (const phan of String(excerpt ?? '').split(';')) {
    let p = timThamChieu(phan);
    if (!p.length && sachTruoc) p = timThamChieu(`${sachTruoc} ${phan.trim()}`);
    if (p.length) { ex.push(...p); sachTruoc = p[0].sach; }
  }
  if (!r) return { ok: false, ly_do: `không đọc được tham chiếu "${ref}"` };
  if (!ex.length) return { ok: null, ly_do: `không đọc được excerpt "${excerpt}"` };
  // excerpt dạng "Cv 6, 8-10; 7,54-59": phần sau có thể thiếu tên sách → kế thừa
  const sachEx = ex[0].sach;
  if (r.sach !== sachEx) return { ok: false, ly_do: `${ref} không cùng sách với ${excerpt}` };
  const hit = ex.some((e) => e.chuong === r.chuong && (r.tu == null || e.tu == null || (r.tu <= (e.den ?? e.tu) + 1 && (r.den ?? r.tu) >= e.tu)));
  return hit ? { ok: true } : { ok: false, ly_do: `${ref} nằm ngoài ${excerpt}` };
}

const _file = new Map();
function docFileBai(p) {
  if (!_file.has(p)) {
    const full = join(LIB_ROOT, p);
    if (!existsSync(full)) _file.set(p, null);
    else { const t = readFileSync(full, 'utf8'); _file.set(p, { text: t, lines: t.replace(/\r\n?/g, '\n').split('\n'), sha256: sha256(t) }); }
  }
  return _file.get(p);
}
export const dongCuaBai = (p, [a, b]) => docFileBai(p)?.lines.slice(a - 1, b).join('\n') ?? null;
export const bamDong = (p, d) => { const s = dongCuaBai(p, d); return s == null ? null : sha1(chuanVanBan(s)); };

function tuKhoa(s) {
  const STOP = new Set('cua mot nhung cac la va trong cho khi thi voi ve tu nay do duoc nguoi chung ta chua thien chua giesu kito minh khong nhu de co se da hay loi'.split(' '));
  return new Set((boDau(s).toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((w) => !STOP.has(w)));
}
const jaccard = (a, b) => { let c = 0; for (const x of a) if (b.has(x)) c++; return c / (a.size + b.size - c || 1); };

/**
 * Kiểm tra dữ liệu gợi ý của một thư mục.
 * → { loi: [], canh_bao: [], thong_ke }
 */
export function kiemTra(data) {
  const loi = [], cb = [];
  const L = (m) => loi.push(m), W = (m) => cb.push(m);
  const tm = data?.thu_muc;
  if (data?.schema !== 'goi-y/1') L('schema phải là "goi-y/1"');
  if (!tm) { L('thiếu thu_muc'); return { loi, canh_bao: cb }; }
  const lcPath = join(OUTPUT, tm, 'loi-chua.json');
  if (!existsSync(lcPath)) { L(`chưa có ${lcPath} (chạy doi-chieu-loi-chua.mjs ${tm})`); return { loi, canh_bao: cb }; }
  const lc = docJson(lcPath);
  const ngPath = join(REPORTS, tm, 'nguon-bai-giang.json');
  const ng = existsSync(ngPath) ? docJson(ngPath) : null;
  if (!ng) W(`chưa có ${ngPath} (chạy chuan-bi.mjs ${tm})`);
  const baiMap = new Map((ng?.bai ?? []).map((b) => [b.duong_dan, b]));
  // khong_dung: { duong_dan, ly_do, dong?: [a, b] } — có "dong" thì chỉ loại khoảng dòng đó
  const khongDung = (p, d) => (data.khong_dung ?? []).find((k) => k.duong_dan === p && (!k.dong || !d || (d[0] <= k.dong[1] && d[1] >= k.dong[0])));
  const { ref: kcnRef, doan: kcnDoan } = kimChiNam();
  const phuLuc = kcnRef.phu_luc_1[tm];

  if (data.celebrationCode !== lc.celebrationCode) L(`celebrationCode ${data.celebrationCode} ≠ ${lc.celebrationCode} (loi-chua.json)`);
  if (JSON.stringify(data.chu_ky) !== JSON.stringify(lc.chu_ky)) L(`chu_ky ${JSON.stringify(data.chu_ky)} ≠ ${JSON.stringify(lc.chu_ky)}`);
  const boTheoNam = (nam) => lc.bo.filter((b) => nam === undefined || b.chu_ky === (nam ?? null));

  const kiemLoiChua = (k, noi, apDung) => {
    if (!DOAN.includes(k.doan)) return L(`${noi}: doan "${k.doan}" không hợp lệ`);
    if (apDung && k.nam !== undefined && !apDung.includes(k.nam)) L(`${noi}: trích bài đọc năm ${k.nam} nhưng gợi ý áp dụng cho năm ${apDung.join("/")}`);
    const bo = boTheoNam(k.nam);
    if (!bo.length) return L(`${noi}: không có bộ bài đọc năm ${k.nam}`);
    for (const b of bo) {
      const s = b.doan?.[k.doan];
      if (!s) { L(`${noi}: bộ ${b.khoa} năm ${b.chu_ky} không có ${k.doan}`); continue; }
      if (k.trich != null && !chuanTrich(vanBanDoan(s)).includes(chuanTrich(k.trich))) L(`${noi}: trích "${k.trich.slice(0, 60)}…" không có nguyên văn trong ${k.doan} (${b.file} [${b.khoa}])`);
      if (k.ref) {
        const t = trongExcerpt(k.ref, k.doan === 'alleluia' ? s.verse : s.excerpt);
        if (t.ok === false) L(`${noi}: ${t.ly_do}`); else if (t.ok === null) W(`${noi}: ${t.ly_do}`);
      }
    }
  };

  const daThay = new Set();
  const tapTu = [];
  for (const g of data.goi_y ?? []) {
    const n = `gợi ý ${g.so}`;
    if (daThay.has(g.so)) L(`${n}: trùng số thứ tự`); daThay.add(g.so);
    if (!LOAI_NGUON.includes(g.loai_nguon)) L(`${n}: loai_nguon không hợp lệ`);
    if (g.so === 1 && !g.loai_nguon?.startsWith('kim-chi-nam')) W(`${n}: gợi ý 01 nên theo Kim Chỉ Nam`);
    if (g.loai_nguon === 'kim-chi-nam-phu-luc' && !phuLuc) L(`${n}: ghi "kim-chi-nam-phu-luc" nhưng Phụ lục I không có mục cho ${tm}`);
    if (!g.ap_dung_nam?.length || g.ap_dung_nam.some((x) => !data.chu_ky.includes(x))) L(`${n}: ap_dung_nam phải là tập con của chu_ky`);
    for (const f of ['tieu_de', 'chu_de', 'luan_de', 'lien_he_bai_doc', 'su_diep']) if (!String(g[f] ?? '').trim()) L(`${n}: thiếu ${f}`);
    if (!g.ap_dung?.length) L(`${n}: thiếu ap_dung`);
    if (!TRANG_THAI.includes(g.duyet?.trang_thai)) L(`${n}: duyet.trang_thai không hợp lệ`);
    if (!g.loi_chua_nen) L(`${n}: thiếu loi_chua_nen`);
    else kiemLoiChua({ ...g.loi_chua_nen, nam: g.loi_chua_nen.nam ?? (g.ap_dung_nam.length === 1 ? g.ap_dung_nam[0] : undefined) }, `${n} · Lời Chúa nền tảng`, g.ap_dung_nam);
    const ld = g.luan_diem ?? [];
    if (ld.length < 3 || ld.length > 5) L(`${n}: cần 3–5 luận điểm (có ${ld.length})`);
    let coBaiGiang = false;
    for (const d of ld) {
      const nd = `${n} · luận điểm ${d.so}`;
      if (!String(d.tieu_de ?? '').trim() || !String(d.giai_thich ?? '').trim()) L(`${nd}: thiếu tiêu đề hoặc giải thích`);
      if (!d.nguon?.length) L(`${nd}: KHÔNG CÓ NGUỒN`);
      for (const k of d.kinh_thanh ?? []) {
        if (k.doan) kiemLoiChua({ ...k, nam: k.nam ?? (g.ap_dung_nam.length === 1 ? g.ap_dung_nam[0] : undefined) }, `${nd} · ${k.ref}`, g.ap_dung_nam);
        else if (k.qua) {
          const s = dongCuaBai(k.qua.duong_dan, k.qua.dong);
          if (s == null) L(`${nd} · ${k.ref}: không đọc được ${k.qua.duong_dan}`);
          else {
            const r = timThamChieu(k.ref)[0];
            const co = r && timThamChieu(s).some((x) => x.sach === r.sach && x.chuong === r.chuong);
            if (!co) L(`${nd} · ${k.ref}: các dòng ${k.qua.dong.join('-')} của ${k.qua.duong_dan} không nêu tham chiếu này`);
            if (k.trich) L(`${nd} · ${k.ref}: câu Kinh Thánh ngoài bộ bài đọc không được chép nguyên văn (chưa đối chiếu)`);
          }
        } else L(`${nd} · ${k.ref}: cần "doan" (trong bộ bài đọc) hoặc "qua" (bài giảng nêu)`);
      }
      for (const s of d.nguon ?? []) {
        const ns = `${nd} · nguồn`;
        if (s.loai === 'bai-giang') {
          coBaiGiang = true;
          const f = docFileBai(s.duong_dan);
          if (!f) { L(`${ns}: không có file ${s.duong_dan}`); continue; }
          const kd = khongDung(s.duong_dan, s.dong);
          if (kd) L(`${ns}: ${s.duong_dan}${kd.dong ? ' dòng ' + kd.dong.join('-') : ''} nằm trong danh sách không dùng (${kd.ly_do})`);
          const b = baiMap.get(s.duong_dan);
          if (ng && !b) W(`${ns}: ${s.duong_dan} không thuộc tập bài của ${tm}`);
          if (b?.trung_voi) L(`${ns}: ${s.duong_dan} là bản trùng của ${b.trung_voi.duong_dan} — hãy trích bản chính`);
          const [a, z] = s.dong ?? [];
          if (!(a >= 1 && z >= a && z <= f.lines.length)) { L(`${ns}: dòng ${s.dong} ngoài file ${s.duong_dan}`); continue; }
          if (!s.trich) L(`${ns}: thiếu trích nguyên văn`);
          else if (!chuanTrich(dongCuaBai(s.duong_dan, s.dong)).includes(chuanTrich(s.trich))) L(`${ns}: trích "${s.trich.slice(0, 60)}…" không có trong ${s.duong_dan} dòng ${a}-${z}`);
        } else if (s.loai === 'kim-chi-nam') {
          if (!kcnRef.doan_da_doi_chieu[s.so]) L(`${ns}: đoạn Kim Chỉ Nam ${s.so} chưa nằm trong danh sách đã đối chiếu`);
          const t = kcnDoan.get(String(s.so));
          if (!t) L(`${ns}: không tìm thấy đoạn ${s.so} trong bản văn Kim Chỉ Nam`);
          else if (s.trich && !chuanTrich(t).includes(chuanTrich(s.trich))) L(`${ns}: trích "${s.trich.slice(0, 60)}…" không có trong đoạn ${s.so}`);
        } else if (s.loai === 'glhtcg') {
          if (!phuLuc) L(`${ns}: GLHTCG ${s.so} — ${tm} không có mục Phụ lục I nên không được ghi số GLHTCG`);
          else if (!phuLuc.chu_de.some((c) => c.so === s.so)) L(`${ns}: GLHTCG "${s.so}" không có trong Phụ lục I cho ${tm}`);
          if (s.trich) L(`${ns}: không trích nguyên văn GLHTCG khi chưa xác minh`);
        } else if (s.loai === 'loi-chua') {
          kiemLoiChua({ doan: s.doan, nam: s.nam ?? (g.ap_dung_nam.length === 1 ? g.ap_dung_nam[0] : undefined), trich: s.trich }, ns, g.ap_dung_nam);
        } else L(`${ns}: loai "${s.loai}" không hợp lệ`);
      }
    }
    if (g.loai_nguon === 'bai-giang' && !coBaiGiang) L(`${n}: ghi nguồn bài giảng nhưng không trích bài nào`);
    tapTu.push([g.so, tuKhoa([g.chu_de, g.luan_de, ...ld.map((d) => d.tieu_de)].join(' ')), new Set(ld.map((d) => chuanVanBan(d.tieu_de).toLowerCase()))]);
  }
  // các gợi ý phải thực sự khác nhau
  const doGiong = [];
  for (let i = 0; i < tapTu.length; i++) for (let j = i + 1; j < tapTu.length; j++) {
    const s = jaccard(tapTu[i][1], tapTu[j][1]);
    doGiong.push([tapTu[i][0], tapTu[j][0], +s.toFixed(2)]);
    if (s > 0.35) W(`gợi ý ${tapTu[i][0]} và ${tapTu[j][0]} giống nhau nhiều (Jaccard từ khóa ${s.toFixed(2)})`);
    for (const t of tapTu[i][2]) if (tapTu[j][2].has(t)) L(`gợi ý ${tapTu[i][0]} và ${tapTu[j][0]} có luận điểm trùng tiêu đề "${t}"`);
  }
  if (!(data.goi_y?.length >= 1 && data.goi_y.length <= 5)) L('cần 1–5 gợi ý');
  return { loi, canh_bao: cb, thong_ke: { so_goi_y: data.goi_y?.length ?? 0, so_luan_diem: (data.goi_y ?? []).reduce((s, g) => s + (g.luan_diem?.length ?? 0), 0), do_giong: doGiong } };
}

/** Gắn hash nguồn (bài giảng, Lời Chúa, Kim Chỉ Nam) */
export function ganVanTay(data) {
  const lc = docJson(join(OUTPUT, data.thu_muc, 'loi-chua.json'));
  const ngPath = join(REPORTS, data.thu_muc, 'nguon-bai-giang.json');
  const ng = existsSync(ngPath) ? docJson(ngPath) : null;
  const parts = [`loi-chua:${lc.sha256}`, `kcn:${kimChiNam().ref.sha256_html}`];
  for (const g of data.goi_y) for (const d of g.luan_diem) for (const s of d.nguon) if (s.loai === 'bai-giang') {
    s.sha256 = docFileBai(s.duong_dan).sha256;
    s.bam_dong = bamDong(s.duong_dan, s.dong);
    parts.push(`${s.duong_dan}:${s.dong.join('-')}:${s.bam_dong}`);
  }
  data.loi_chua = { file: `AI-DAN-Y/OUTPUT/${data.thu_muc}/loi-chua.json`, sha256: lc.sha256, lich_commit: lc.lich.commit };
  if (ng) data.nguon_bai_giang = { so_bai: ng.so_bai, so_doc_lap: ng.so_bai_doc_lap, van_tay: ng.van_tay };
  data.van_tay_nguon = sha256([...new Set(parts)].sort().join('\n'));
  return data;
}

/** So sánh nguồn hiện tại với hash đã lưu → [{ goi_y, luan_diem, duong_dan, ly_do }] */
export function nguonDaDoi(data) {
  const out = [];
  const lcPath = join(OUTPUT, data.thu_muc, 'loi-chua.json');
  const lc = existsSync(lcPath) ? docJson(lcPath) : null;
  if (!lc || lc.sha256 !== data.loi_chua?.sha256) out.push({ goi_y: null, ly_do: 'Bộ Lời Chúa đã đổi' });
  for (const g of data.goi_y) for (const d of g.luan_diem) for (const s of d.nguon) if (s.loai === 'bai-giang') {
    _file.delete(s.duong_dan);
    const f = docFileBai(s.duong_dan);
    if (!f) out.push({ goi_y: g.so, luan_diem: d.so, duong_dan: s.duong_dan, ly_do: 'file đã mất' });
    else if (f.sha256 !== s.sha256 && bamDong(s.duong_dan, s.dong) !== s.bam_dong) out.push({ goi_y: g.so, luan_diem: d.so, duong_dan: s.duong_dan, ly_do: 'các dòng được trích đã đổi' });
  }
  return out;
}
