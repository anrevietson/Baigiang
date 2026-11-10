// Nhận dạng và chuẩn hóa tham chiếu Kinh Thánh.
// "Mt 25,1-13", "Mt 25, 1-13", "Mt. 25:1-13", "Matt 25:1-13" → { sach: 'Mt', chuong: 25, tu: 1, den: 13 }
// Viết tắt theo bảng trong HUONG-DAN-THU-VIEN-THAM-KHAO.md (mục 4).
// Chỗ nào mơ hồ thì gắn khong_chac = 1, không tự khẳng định.

import { nfc } from './tieng-viet.mjs';

// mã chuẩn → tên đầy đủ
export const SACH = {
  St: 'Sáng Thế', Xh: 'Xuất Hành', Lv: 'Lêvi', Ds: 'Dân Số', Đnl: 'Đệ Nhị Luật',
  Gs: 'Giôsuê', Tl: 'Thủ Lãnh', R: 'Rút', '1Sm': '1 Samuen', '2Sm': '2 Samuen',
  '1V': '1 Các Vua', '2V': '2 Các Vua', '1Sb': '1 Sử Biên', '2Sb': '2 Sử Biên',
  Er: 'Étra', Nkm: 'Nơkhemia', Tb: 'Tôbia', Gđt: 'Giuđitha', Et: 'Étte',
  '1Mcb': '1 Macabê', '2Mcb': '2 Macabê', G: 'Gióp', Tv: 'Thánh Vịnh', Cn: 'Châm Ngôn',
  Gv: 'Giảng Viên', Dc: 'Diễm Ca', Kn: 'Khôn Ngoan', Hc: 'Huấn Ca', Is: 'Isaia',
  Gr: 'Giêrêmia', Ac: 'Ai Ca', Br: 'Barúc', Ed: 'Êdêkiên', Đn: 'Đanien', Hs: 'Hôsê',
  Ge: 'Giôen', Am: 'Amốt', Ov: 'Ôvađia', Gn: 'Giôna', Mk: 'Mikha', Nk: 'Nahum',
  Kb: 'Habacúc', Xp: 'Xôphônia', Kg: 'Khácgai', Dcr: 'Dacaria', Ml: 'Malakhi',
  Mt: 'Mátthêu', Mc: 'Máccô', Lc: 'Luca', Ga: 'Gioan', Cv: 'Công Vụ', Rm: 'Rôma',
  '1Cr': '1 Côrintô', '2Cr': '2 Côrintô', Gl: 'Galát', Ep: 'Êphêsô', Pl: 'Philípphê',
  Cl: 'Côlôxê', '1Tx': '1 Thêxalônica', '2Tx': '2 Thêxalônica', '1Tm': '1 Timôthê',
  '2Tm': '2 Timôthê', Tt: 'Titô', Plm: 'Philêmôn', Dt: 'Do Thái', Gc: 'Giacôbê',
  '1Pr': '1 Phêrô', '2Pr': '2 Phêrô', '1Ga': '1 Gioan', '2Ga': '2 Gioan', '3Ga': '3 Gioan',
  Gđ: 'Giuđa', Kh: 'Khải Huyền',
};

// cách viết gặp trong bài → mã chuẩn. Khóa viết thường, bỏ dấu chấm và khoảng trắng.
const ALIAS = {};
const add = (code, ...names) => { for (const n of names) ALIAS[key(n)] = code; };
function key(s) { return nfc(s).toLowerCase().replace(/[\s.\-]/g, ''); }
for (const c of Object.keys(SACH)) add(c, c, SACH[c]);
add('Mt', 'Mát-thêu', 'Matthêu', 'Matt', 'Mat', 'Matthew', 'Mth');
add('Mc', 'Mác-cô', 'Marcô', 'Mark', 'Mr');
add('Lc', 'Lu-ca', 'Luc', 'Luke', 'Lk');
add('Ga', 'Gio-an', 'Gio', 'Jo', 'Jn', 'John', 'Jean');
add('Cv', 'Acts', 'Act', 'Công Vụ Tông Đồ', 'Tông Đồ Công Vụ');
add('Rm', 'Rom', 'Romans', 'Rô-ma');
add('1Cr', '1Cor', '1 Côrinthô'); add('2Cr', '2Cor', '2 Côrinthô');
add('Gl', 'Gal'); add('Ep', 'Eph', 'Êphêxô'); add('Pl', 'Phil', 'Php'); add('Cl', 'Col', 'Côlôsê');
add('1Tx', '1Thes', '1Th'); add('2Tx', '2Thes', '2Th'); add('1Tm', '1Tim'); add('2Tm', '2Tim');
add('Tt', 'Tit'); add('Plm', 'Phlm'); add('Dt', 'Heb', 'Hebr', 'Hr', 'Híp-ri', 'Hípri');
add('Gc', 'Jas', 'Jac', 'Gia-cô-bê'); add('1Pr', '1Pet', '1Pt', '1Ph'); add('2Pr', '2Pet', '2Pt');
add('1Ga', '1Jn', '1Gio'); add('2Ga', '2Jn'); add('3Ga', '3Jn'); add('Gđ', 'Jude', 'Gd');
add('Kh', 'Rev', 'Apoc', 'Khải Huyền');
add('St', 'Gen', 'Gn.', 'Sáng thế ký'); add('Xh', 'Ex', 'Exod', 'Xuất hành ký'); add('Lv', 'Lev');
add('Ds', 'Num'); add('Đnl', 'Ðnl', 'Dnl', 'Deut', 'Dt.'); add('Gs', 'Josh', 'Jos');
add('Tl', 'Judg', 'Tlv'); add('R', 'Ruth', 'Rt'); add('1Sm', '1Sam', '1S'); add('2Sm', '2Sam', '2S');
add('1V', '1Kgs', '1Vua'); add('2V', '2Kgs', '2Vua'); add('1Sb', '1Chr'); add('2Sb', '2Chr');
add('Er', 'Esd', 'Ezra'); add('Nkm', 'Neh'); add('Tb', 'Tob'); add('Gđt', 'Jdt'); add('Et', 'Esth', 'Est');
add('1Mcb', '1Mac', '1Macc', '1Mcc'); add('2Mcb', '2Mac', '2Macc', '2Mcc'); add('G', 'Job', 'Gióp');
add('Tv', 'Ps', 'Psalm', 'Thánh vịnh', 'Tvn'); add('Cn', 'Prov', 'Prv'); add('Gv', 'Eccl', 'Qo');
add('Dc', 'Song', 'Cant'); add('Kn', 'Wis', 'Wisd'); add('Hc', 'Sir', 'Ecclus');
add('Is', 'Isa', 'Ês', 'I-sai-a'); add('Gr', 'Jer', 'Giê-rê-mi-a'); add('Ac', 'Lam'); add('Br', 'Bar');
add('Ed', 'Ez', 'Ezek', 'Êd', 'Ê-dê-ki-en'); add('Đn', 'Ðn', 'Dn', 'Dan'); add('Hs', 'Hos'); add('Ge', 'Joel');
add('Am', 'Amos'); add('Ov', 'Obad'); add('Gn', 'Jon', 'Jonah'); add('Mk', 'Mic', 'Mi');
add('Nk', 'Nah'); add('Kb', 'Hab'); add('Xp', 'Zeph'); add('Kg', 'Hag'); add('Dcr', 'Zech', 'Xac', 'Dcr.');
add('Ml', 'Mal');

// Viết tắt mơ hồ: [mã khi ngăn chương-câu bằng ',', mã khi bằng ':' (kiểu tiếng Anh)]
const MO_HO = { mk: ['Mk', 'Mc'], dt: ['Dt', 'Đnl'], gn: ['Gn', 'St'] };
// Một chữ cái hoặc trùng chữ thường: chỉ nhận khi có đủ "chương, câu".
const CAN_CAU = new Set(['g', 'r', 'am', 'is', 'et', 'ac', 'br', 'jo', 'ed', 'tt', 'gs', 'tl', 'ge', 'er', 'ex', 'mi', 'jon', 'lam', 'sir', 'job', 'ps', 'song', 'mark', 'john', 'jean', 'act', 'mat', 'luc', 'gio']);

// Tham chiếu chỉ có chương ("Mt 5") chỉ nhận cho các sách hay gặp, và luôn gắn khong_chac.
const CHUONG_LE = new Set(['Mt', 'Mc', 'Lc', 'Ga', 'Cv', 'Rm', 'Is', 'St', 'Xh', '1Cr', 'Kh']);

const names = Object.keys(ALIAS).sort((a, b) => b.length - a.length);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// tên sách có thể viết "1 Cr", "1Cr", "Mát-thêu", "Mt." — dựng mẫu từ dạng gốc
function pat(k) {
  // k đã bỏ khoảng/chấm/gạch: cho phép chúng xuất hiện lại giữa các ký tự
  return [...k].map(esc).join('[\\s.\\-]?');
}
const BOOK_RE = names.map(pat).join('|');
const REF_RE = new RegExp(
  `(?<![\\p{L}\\d])(${BOOK_RE})\\.?\\s*(\\d{1,3})(?:\\s*([,:])\\s*(\\d{1,3})[a-e]?(?:\\s*[-–—]\\s*(\\d{1,3})[a-e]?)?((?:\\s*[.;]\\s*\\d{1,3}[a-e]?(?:\\s*[-–—]\\s*\\d{1,3}[a-e]?)?(?![\\d,:]))*))?(?![\\p{L}\\d])`,
  'giu');

/**
 * Tìm mọi tham chiếu trong một đoạn văn.
 * Trả về [{ sach, chuong, tu, den, raw, khong_chac, vi_tri }]; tu/den = null nghĩa là cả chương.
 */
export function timThamChieu(text) {
  const s = nfc(text);
  const out = [];
  for (const m of s.matchAll(REF_RE)) {
    const k = key(m[1]);
    let code = ALIAS[k];
    if (!code) continue;
    const sep = m[3];
    let khongChac = 0;
    if (MO_HO[k]) { code = MO_HO[k][sep === ':' ? 1 : 0]; khongChac = 1; }
    if (CAN_CAU.has(k) && !sep) continue;            // "Is 5" quá dễ nhầm với chữ thường
    if (k.length <= 2 && !sep && /^[a-zđ]/.test(m[1])) continue; // viết thường không có câu: bỏ
    if (/^[a-zđ]/.test(m[1]) && k.length <= 3) continue;           // tên sách phải viết hoa
    const chuong = +m[2];
    if (!chuong || chuong > 150) continue;
    if (!sep && !CHUONG_LE.has(code)) continue;
    if (!sep) { out.push({ sach: code, chuong, tu: null, den: null, raw: m[0].trim(), khong_chac: 1, vi_tri: m.index }); continue; }
    const tu = +m[4];
    const den = m[5] ? +m[5] : tu;
    out.push({ sach: code, chuong, tu, den: Math.max(tu, den), raw: m[0].trim(), khong_chac: khongChac, vi_tri: m.index });
    // các đoạn câu thêm: "Lc 21, 25-28. 34-36"
    if (m[6]) {
      for (const seg of m[6].matchAll(/(\d{1,3})[a-e]?(?:\s*[-–—]\s*(\d{1,3}))?/g)) {
        const a = +seg[1], b = seg[2] ? +seg[2] : a;
        out.push({ sach: code, chuong, tu: a, den: Math.max(a, b), raw: m[0].trim(), khong_chac: khongChac, vi_tri: m.index });
      }
    }
  }
  return out;
}

/** Người dùng gõ "Mt 25,1-13" → danh sách tham chiếu (rỗng nếu không phải tham chiếu). */
export function docThamChieuTruyVan(q) {
  const refs = timThamChieu(q);
  if (!refs.length) return [];
  // Toàn bộ câu truy vấn phải là tham chiếu (cho phép dấu ; và khoảng trắng thừa)
  const rest = nfc(q).replace(REF_RE, '').replace(/[\s;,.]+/g, '');
  return rest ? [] : refs;
}

export const dinhDanh = (r) => r.tu == null ? `${r.sach} ${r.chuong}` : `${r.sach} ${r.chuong},${r.tu}${r.den !== r.tu ? '-' + r.den : ''}`;
