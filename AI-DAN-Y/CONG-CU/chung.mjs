// Thư viện chung cho ngân hàng gợi ý bài giảng (AI-DAN-Y).
// Chỉ ĐỌC: kho Markdown, TRA-CUU/lich-ngay.json, D:\CalendarCoreV2\Reading\*.json.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { nfc } from '../../TIM-KIEM/lib/tieng-viet.mjs';

export const CONG_CU = dirname(fileURLToPath(import.meta.url));
export const AI_DIR = join(CONG_CU, '..');
export const LIB_ROOT = join(AI_DIR, '..');
export const CAL_ROOT = process.env.LICH_ROOT ?? 'D:/CalendarCoreV2';
export const OUTPUT = join(AI_DIR, 'OUTPUT');
export const REPORTS = join(AI_DIR, 'REPORTS');
export const LAM_VIEC = join(AI_DIR, 'LAM-VIEC');
export const NGUON = join(AI_DIR, 'NGUON');

export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const docJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
/** So khớp nguyên văn: NFC, gộp khoảng trắng, thống nhất Ð/Đ và nháy. Không bỏ dấu. */
export const chuanVanBan = (s) => nfc(String(s ?? ''))
  .replace(/\u0110/g, 'Đ').replace(/\u00D0/g, 'Đ').replace(/\u0111/g, 'đ').replace(/\u00F0/g, 'đ')
  .replace(/[“”„]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-').replace(/…/g, '...')
  .replace(/\s+/g, ' ').trim();

// ---------------- Lời Chúa (catholic-cal-vn) ----------------
const FILE_NGUON = {
  ordinary1: 'Reading/DailyOrdinary1.json', ordinary2: 'Reading/DailyOrdinary2.json',
  season: 'Reading/DailySeason.json', sunday: 'Reading/Sunday.json',
  saints: 'Reading/saintsReading.json', particular: 'Reading/particularReading.json',
  easterVigil: 'Reading/easterVigil.json',
};
const _nguon = new Map();
export function nguonLoiChua(ten) {
  if (!_nguon.has(ten)) {
    let x = docJson(join(CAL_ROOT, FILE_NGUON[ten]));
    if (Array.isArray(x) && x.length === 1) x = x[0];   // Sunday.json bọc trong mảng 1 phần tử (readingData.ts)
    _nguon.set(ten, x);
  }
  return _nguon.get(ten);
}
export function commitLich() {
  try { return execFileSync('git', ['-C', CAL_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; }
}

/** Bản sao đúng quy tắc resolveReadingSource (CalendarCoreV2/src/reading/readingPreview.ts). */
export function resolveReadingSource(code, cycle) {
  if (code === '3066') return 'easterVigil';                 // EASTER_VIGIL_CODE (easterVigil.ts)
  if (cycle === 'I') return 'ordinary1';
  if (cycle === 'II') return 'ordinary2';
  if (cycle === 'A' || cycle === 'B' || cycle === 'C') return 'sunday';
  if (code.startsWith('7') || code === '80001' || code === '80158') return 'particular';
  return nguonLoiChua('season')[code] ? 'season' : 'saints';
}

/** Bản sao getReadings (readings.ts): chặn tổ hợp nguồn/chu kỳ không hợp lệ. */
export function layBoBaiDoc(source, code, cycle) {
  if (source === 'easterVigil') return undefined;
  if ((source === 'ordinary1' && cycle !== 'I') || (source === 'ordinary2' && cycle !== 'II') ||
    (source === 'sunday' && !['A', 'B', 'C'].includes(cycle)) ||
    (!['ordinary1', 'ordinary2', 'sunday'].includes(source) && cycle !== null)) return undefined;
  const d = nguonLoiChua(source);
  return source === 'sunday' ? d[code]?.[cycle] : d[code];
}

// ---------------- lịch: celebrationCode → readingCode ----------------
let _lich = null;
export function lichNgay() { return (_lich ??= docJson(join(LIB_ROOT, 'TRA-CUU', 'lich-ngay.json'))); }
/** → Map(celebrationCode → { reading: Set, coNull: bool, ten: Set }) theo lich-ngay.json (sinh từ chính chương trình lịch) */
let _maLich = null;
export function maTrongLich() {
  if (_maLich) return _maLich;
  _maLich = new Map();
  for (const x of Object.values(lichNgay().ngay)) for (const l of x.le) {
    if (!l.celebrationCode) continue;
    const e = _maLich.get(l.celebrationCode) ?? { reading: new Set(), coNull: false, ten: new Set() };
    if (l.readingCode) e.reading.add(l.readingCode); else e.coNull = true;
    e.ten.add(l.ten);
    _maLich.set(l.celebrationCode, e);
  }
  return _maLich;
}

/** "1010-A" → { ma: '1010', chuKy: ['A'] } ; "5321-I-II" → chuKy ['I','II'] ; "82612" → [null] */
export function phanTichThuMuc(tm) {
  const m = tm.match(/^(\d+)(?:-(A|B|C|I-II))?$/);
  if (!m) return null;
  return { ma: m[1], chuKy: m[2] === 'I-II' ? ['I', 'II'] : m[2] ? [m[2]] : [null] };
}

/**
 * Đối chiếu một thư mục bài giảng với bộ Lời Chúa.
 * → { thu_muc, celebrationCode, cach, ghi_chu, bo: [{ chu_ky, readingCode, nguon, file, khoa, sha256, co_bai_doc }] }
 */
export function doiChieuThuMuc(tm) {
  const p = phanTichThuMuc(tm);
  if (!p) return { thu_muc: tm, loi: 'Tên thư mục không đúng dạng mã lễ' };
  const e = maTrongLich().get(p.ma);
  let readingCodes, cach, ghiChu = null;
  if (e && e.reading.size) {
    readingCodes = [...e.reading];
    cach = readingCodes.length === 1 && readingCodes[0] === p.ma ? 'trung-ma' : 'lich-ngay';
    if (cach === 'lich-ngay') ghiChu = `celebrationCode ${p.ma} → readingCode ${readingCodes.join(', ')} (theo TRA-CUU/lich-ngay.json)`;
  } else if (e && e.coNull) {
    readingCodes = [];
    cach = 'bai-doc-chung';
    ghiChu = 'Lịch không gán bài đọc riêng (readingCode = null): dùng bài đọc chung; không xác định được bộ cụ thể.';
  } else {
    readingCodes = [p.ma];
    cach = 'khong-co-trong-lich';
    ghiChu = 'Mã không xuất hiện trong lich-ngay.json 2025–2040; thử khóa trùng mã trong các file bài đọc.';
  }
  const bo = [];
  for (const cy of p.chuKy) for (const rc of readingCodes) {
    const nguon = resolveReadingSource(rc, cy);
    const set = layBoBaiDoc(nguon, rc, cy);
    bo.push({
      chu_ky: cy, readingCode: rc, nguon, file: FILE_NGUON[nguon],
      khoa: nguon === 'sunday' ? `${rc}.${cy}` : rc,
      co_bai_doc: !!set, sha256: set ? sha256(JSON.stringify(set)) : null,
    });
  }
  return { thu_muc: tm, celebrationCode: p.ma, chu_ky: p.chuKy, cach, ghi_chu: ghiChu, bo };
}

export const DOAN_BAI_DOC = { firstReading: 'Bài đọc I', psalms: 'Đáp ca', secondReading: 'Bài đọc II', alleluia: 'Tung hô Tin Mừng', gospel: 'Tin Mừng' };

/** Danh sách thư mục bài giảng */
export function dsThuMuc(root = LIB_ROOT) {
  return readdirSync(root).filter((d) => /^\d/.test(d) && statSync(join(root, d)).isDirectory()).sort();
}
export const coFile = (p) => existsSync(p);
