#!/usr/bin/env node
// Chọn mã lễ để làm tiếp — cho nhiều phiên / nhiều agent nối tiếp nhau mà không phải tìm lại từ đầu.
//
//   node AI-DAN-Y/CONG-CU/tiep-theo.mjs [--tu 2026-11-13] [--so 5]
//        1) mã ĐANG LÀM DỞ mà không ai giữ (phiên trước dừng giữa chừng) → làm tiếp trước
//        2) các mã CHƯA LÀM theo thứ tự lịch phụng vụ kể từ ngày --tu (mặc định hôm nay)
//   node AI-DAN-Y/CONG-CU/tiep-theo.mjs --nhan 1020-B [--ai "ten-phien"]   nhận mã (giữ chỗ 6 giờ)
//   node AI-DAN-Y/CONG-CU/tiep-theo.mjs --tra 1020-B                       trả mã (bỏ giữ chỗ)
//   node AI-DAN-Y/CONG-CU/tiep-theo.mjs --xem 1020-B                       chỗ dừng + bước kế tiếp của một mã
//
// Nguyên tắc: một mã chỉ được tính là XONG khi ghi-goi-y.mjs đã kiểm tra 0 lỗi và ghi OUTPUT/<tm>/goi-y.json.
// Phiên bị ngắt giữa chừng (hết token…) không để lại gì sai: mã vẫn ở trạng thái "đang làm", giữ chỗ tự hết hạn
// sau 6 giờ, phiên khác chạy lệnh này sẽ thấy và làm tiếp từ gói đọc chưa ghi trích ý.
import { existsSync, readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { LIB_ROOT, LAM_VIEC, docJson, dsThuMuc, phanTichThuMuc } from './chung.mjs';
import { trangThai } from './tien-do.mjs';
import { kiemTra } from './kiem.mjs';

const GIU_CHO_GIO = 6;
const args = process.argv.slice(2);
const lay = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const fileGiu = (tm) => join(LAM_VIEC, tm, '.nhan.json');
const homNay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** giữ chỗ còn hiệu lực → { ai, luc, het_han } | null */
export function giuCho(tm) {
  const f = fileGiu(tm);
  if (!existsSync(f)) return null;
  try { const g = docJson(f); return Date.parse(g.het_han) > Date.now() ? g : null; } catch { return null; }
}

/** chỗ dừng của một mã: đã có gì, còn thiếu gì, bước kế tiếp */
export function choDung(tm) {
  const tt = trangThai(tm);
  const lv = join(LAM_VIEC, tm);
  const files = existsSync(lv) ? readdirSync(lv) : [];
  const goi = files.filter((f) => /^goi-\d+\.txt$/.test(f)).sort();
  const trich = files.includes('trich-y.md') ? readFileSync(join(lv, 'trich-y.md'), 'utf8') : '';
  // quy ước: sau khi đọc xong mỗi gói, ghi tiêu đề "## goi-NN" trong trich-y.md
  const daGhi = goi.filter((g) => new RegExp(`^##\\s+${g.replace('.txt', '')}\\b`, 'm').test(trich));
  const conLai = goi.filter((g) => !daGhi.includes(g));
  let nhap = null;
  if (files.includes('goi-y.nhap.json')) {
    try { const r = kiemTra(docJson(join(lv, 'goi-y.nhap.json'))); nhap = { loi: r.loi.length, vi_du: r.loi.slice(0, 3) }; }
    catch (e) { nhap = { loi: 1, vi_du: ['JSON hỏng: ' + e.message] }; }
  }
  const coGom = /^##\s+Gom hướng/m.test(trich);
  let buoc;
  if (tt.trang_thai === 'xong') buoc = 'Đã xong — không làm lại.';
  else if (tt.trang_thai === 'can-kiem-tra') buoc = `Xem lại phần gắn cờ: node AI-DAN-Y/CONG-CU/tien-do.mjs ${tm}`;
  else if (!goi.length) buoc = `node AI-DAN-Y/CONG-CU/doi-chieu-loi-chua.mjs ${tm} && node AI-DAN-Y/CONG-CU/chuan-bi.mjs ${tm}`;
  else if (conLai.length) buoc = `Đọc ${conLai.join(', ')} (theo thứ tự), ghi trích ý từng gói vào LAM-VIEC/${tm}/trich-y.md dưới tiêu đề "## ${conLai[0].replace('.txt', '')}".`;
  else if (!coGom) buoc = `Đã ghi trích ý đủ ${goi.length} gói. Thêm mục "## Gom hướng" vào trich-y.md rồi soạn LAM-VIEC/${tm}/goi-y.nhap.json.`;
  else if (!nhap) buoc = `Soạn LAM-VIEC/${tm}/goi-y.nhap.json theo SCHEMA/goi-y.md.`;
  else if (nhap.loi) buoc = `Sửa ${nhap.loi} lỗi: node AI-DAN-Y/CONG-CU/ghi-goi-y.mjs ${tm} --thu`;
  else buoc = `Bản nháp đạt. Ghi: node AI-DAN-Y/CONG-CU/ghi-goi-y.mjs ${tm} && node AI-DAN-Y/CONG-CU/nap-csdl.mjs, rồi commit (xem BAN-GIAO.md).`;
  return { thu_muc: tm, trang_thai: tt.trang_thai, giu_cho: giuCho(tm), goi_doc: goi.length, da_ghi_trich_y: daGhi, con_lai: conLai, co_gom_huong: coGom, ban_nhap: nhap, buoc_ke_tiep: buoc };
}

/** ngày → các thư mục mã lễ tương ứng (lễ chính trước, lễ nhớ/tùy chọn sau) */
function thuMucTheoLich(tu, soNgay = 400) {
  const lich = docJson(join(LIB_ROOT, 'TRA-CUU', 'lich-ngay.json')).ngay;
  const tatCa = dsThuMuc().map((tm) => ({ tm, ...phanTichThuMuc(tm) })).filter((x) => x.ma);
  const theoMa = new Map();
  for (const x of tatCa) { if (!theoMa.has(x.ma)) theoMa.set(x.ma, []); theoMa.get(x.ma).push(x); }
  const out = [], da = new Set();
  const d0 = new Date(tu + 'T00:00:00Z');
  for (let i = 0; i < soNgay; i++) {
    const ngay = new Date(d0.getTime() + i * 864e5).toISOString().slice(0, 10);
    const e = lich[ngay];
    if (!e) continue;
    const le = [...e.le].sort((a, b) => (a.role === 'main' ? 0 : 1) - (b.role === 'main' ? 0 : 1));
    for (const l of le) {
      let ma = l.celebrationCode ?? l.readingCode;   // cùng quy tắc với dong-goi-html.mjs / lib/tim-kiem.mjs
      if (!ma) continue;
      if (ma === '95002') ma = '5340';   // như giao diện: Chúa Kitô Vua dùng thư mục 5340
      let nam = e.nam;
      for (const x of theoMa.get(ma) ?? []) {
        // ngày thường Mùa Thường niên: lịch không ghi I/II → theo năm dương lịch (lẻ: I, chẵn: II)
        if (x.chuKy.includes('I') && !['I', 'II'].includes(nam)) nam = +ngay.slice(0, 4) % 2 ? 'I' : 'II';
        const hop = x.chuKy[0] === null || x.chuKy.includes(nam);
        if (hop && !da.has(x.tm)) { da.add(x.tm); out.push({ tm: x.tm, ngay, ten: l.ten, vai: l.role }); }
      }
    }
  }
  return out;
}

if (import.meta.url.endsWith(process.argv[1]?.split(/[\\/]/).pop())) {
  const nhan = lay('--nhan'), tra = lay('--tra'), xem = lay('--xem');
  if (nhan) {
    const tt = trangThai(nhan);
    if (tt.trang_thai === 'xong') { console.log(`${nhan} đã XONG — không nhận.`); process.exit(1); }
    const g = giuCho(nhan);
    const ai = lay('--ai') ?? `phien-${new Date().toISOString().slice(0, 16)}`;
    if (g && g.ai !== ai) { console.log(`${nhan} đang được "${g.ai}" giữ đến ${g.het_han}. Chọn mã khác.`); process.exit(1); }
    mkdirSync(join(LAM_VIEC, nhan), { recursive: true });
    const luc = new Date();
    writeFileSync(fileGiu(nhan), JSON.stringify({ ai, luc: luc.toISOString(), het_han: new Date(luc.getTime() + GIU_CHO_GIO * 36e5).toISOString() }, null, 1));
    console.log(`Đã nhận ${nhan} cho "${ai}" (${GIU_CHO_GIO} giờ). Chạy lại --nhan để gia hạn.`);
    console.log('Bước kế tiếp:', choDung(nhan).buoc_ke_tiep);
    process.exit(0);
  }
  if (tra) {
    rmSync(fileGiu(tra), { force: true });
    const lv = join(LAM_VIEC, tra);
    if (existsSync(lv) && !readdirSync(lv).length) rmSync(lv, { recursive: true });   // chưa làm gì → về "chưa làm"
    console.log(`Đã trả ${tra}.`);
    process.exit(0);
  }
  if (xem) { console.log(JSON.stringify(choDung(xem), null, 1)); process.exit(0); }

  const tu = lay('--tu') ?? homNay(), so = +(lay('--so') ?? 5);
  const dangLam = dsThuMuc().filter((tm) => existsSync(join(LAM_VIEC, tm))).map(choDung)
    .filter((c) => c.trang_thai === 'dang-lam' || c.trang_thai === 'can-kiem-tra');
  const roi = dangLam.filter((c) => !c.giu_cho), bi = dangLam.filter((c) => c.giu_cho);
  if (roi.length) {
    console.log('== Làm dở, không ai giữ — làm tiếp các mã này trước ==');
    for (const c of roi) console.log(`  ${c.thu_muc.padEnd(10)} trích ý ${c.da_ghi_trich_y.length}/${c.goi_doc} gói → ${c.buoc_ke_tiep}`);
  }
  if (bi.length) {
    console.log('== Đang có phiên khác giữ — KHÔNG đụng ==');
    for (const c of bi) console.log(`  ${c.thu_muc.padEnd(10)} "${c.giu_cho.ai}" đến ${c.giu_cho.het_han}`);
  }
  console.log(`== Chưa làm, theo lịch từ ${tu} ==`);
  let n = 0;
  for (const x of thuMucTheoLich(tu)) {
    if (n >= so) break;
    if (trangThai(x.tm).trang_thai !== 'chua') continue;
    console.log(`  ${x.tm.padEnd(10)} ${x.ngay}  ${x.ten}${x.vai === 'main' ? '' : ' (lễ tùy chọn)'}`);
    n++;
  }
  console.log('\nNhận một mã trước khi làm: node AI-DAN-Y/CONG-CU/tiep-theo.mjs --nhan <mã>   (xem AI-DAN-Y/BAN-GIAO.md)');
}
