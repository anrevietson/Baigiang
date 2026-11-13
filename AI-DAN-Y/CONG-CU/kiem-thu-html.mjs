#!/usr/bin/env node
// Kiểm thử giao diện baigiang-goi-y.html trong Chrome/Edge thật (headless), Ở CHẾ ĐỘ OFFLINE.
// Không cần gói npm: điều khiển trình duyệt qua Chrome DevTools Protocol (WebSocket có sẵn trong Node ≥ 22).
//
//   node AI-DAN-Y/CONG-CU/kiem-thu-html.mjs [đường/dẫn/file.html] [--khong-goi-y]
//   CHROME=/duong/dan/chrome.exe để chọn trình duyệt.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { LIB_ROOT } from './chung.mjs';

const args = process.argv.slice(2);
const file = resolve(args.find((a) => !a.startsWith('--')) ?? join(LIB_ROOT, 'baigiang-goi-y.html'));
const khongGoiY = args.includes('--khong-goi-y');
const CHROME = process.env.CHROME ?? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!CHROME || !existsSync(file)) { console.error('Thiếu trình duyệt hoặc file', CHROME, file); process.exit(2); }

const prof = mkdtempSync(join(tmpdir(), 'bg-test-'));
const port = 9300 + Math.floor(Math.random() * 500);
const br = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run', '--disable-gpu', '--window-size=1200,900', 'about:blank'], { stdio: 'ignore' });
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0;
const cho = new Map();
const goi = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; cho.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => {
  const r = await goi('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
async function doi(expr, ms = 120000, buoc = 250) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await ev(expr).catch(() => false)) return true; await ngu(buoc); }
  throw new Error('Hết giờ chờ: ' + expr);
}
const kq = [];
const dat = (ten, ok, chiTiet = '') => { kq.push({ ten, ok: !!ok, chiTiet }); console.log(`${ok ? '✓' : '✗'} ${ten}${chiTiet ? ' — ' + chiTiet : ''}`); };

try {
  let tabs;
  for (let i = 0; i < 60; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.length) break; } catch {} await ngu(250); }
  const tab = tabs.find((t) => t.type === 'page');
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && cho.has(d.id)) { const c = cho.get(d.id); cho.delete(d.id); d.error ? c.rej(new Error(d.error.message)) : c.res(d.result); } });
  await goi('Runtime.enable'); await goi('Network.enable');
  // NGẮT MẠNG: chứng minh trang chạy offline
  await goi('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  const yeuCauMang = [], loiJs = [];
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.method === 'Runtime.exceptionThrown') loiJs.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text); });
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.method === 'Network.requestWillBeSent' && !/^(file|data|blob):/.test(d.params.request.url)) yeuCauMang.push(d.params.request.url); });
  await goi('Page.navigate', { url: pathToFileURL(file).href });
  const t0 = Date.now();
  await doi(`!document.getElementById('mo') && typeof M !== 'undefined'`, 180000, 500);
  dat('Mở trang offline, dựng chỉ mục xong', true, `${((Date.now() - t0) / 1000).toFixed(1)} giây`);

  // ---- tìm kiếm cũ ----
  const timQ = async (q) => { await ev(`(()=>{document.querySelector('#q').value=${JSON.stringify(q)};document.querySelector('#f').requestSubmit();return 1})()`); await ngu(300); };
  await timQ('tỉnh thức');
  dat('Tìm từ khóa "tỉnh thức" (chức năng cũ)', await ev(`document.querySelectorAll('#kq .bai').length >= 10`), await ev(`document.querySelector('#tt').innerText.split('\\n')[0]`));
  await timQ('Mt 25,1-13');
  dat('Tìm Kinh Thánh "Mt 25,1-13" (chức năng cũ)', await ev(`document.querySelectorAll('#kq .bai').length > 0`), await ev(`document.querySelector('#tt').innerText.split('\\n')[0]`));
  // tham chiếu vắt chương: bài ghi "Mt 9, 35 – 10, 1. 6-8" phải ra khi tìm "Mt 10,8" (trước khi sửa bộ đọc: 44 bài)
  await timQ('Mt 10,8');
  const soMt108 = +(await ev(`(document.querySelector('#tt').innerText.match(/(\\d+) bài có kết quả/)||[])[1]||0`));
  dat('Tìm "Mt 10,8" ra cả bài ghi tham chiếu vắt chương (≥ 100 bài)', soMt108 >= 100, soMt108 + ' bài');
  await timQ('tinh thuc');
  dat('Tìm không dấu "tinh thuc" (chức năng cũ)', await ev(`document.querySelectorAll('#kq .bai').length > 0`));
  await ev(`(()=>{document.querySelector('#q').value='';document.querySelector('#tac_gia').value='Noël Quesson';document.querySelector('#tac_gia').dispatchEvent(new Event('change'));return 1})()`); await ngu(300);
  dat('Lọc theo tác giả (chức năng cũ)', await ev(`[...document.querySelectorAll('#kq .bai .meta')].length>0 && [...document.querySelectorAll('#kq .bai .meta')].every(m=>m.innerText.includes('Quesson'))`));
  await ev(`document.querySelector('#xoa').click()`);

  if (khongGoiY) {
    dat('Bản không kèm gợi ý: khối gợi ý ẩn', await ev(`document.querySelector('#goi-y').classList.contains('an') && !document.querySelector('.gy')`));
  } else {
    dat('Trang đầu liệt kê các lễ đã có gợi ý', await ev(`document.querySelectorAll('#goi-y [data-gy-le]').length === GY.bo.length && GY.bo.length > 0`));
    // ---- chọn ngày 30/11/2025: CN I Mùa Vọng năm A ----
    const chonNgay = async (d) => { await ev(`(()=>{const n=document.querySelector('#ngay');n.value=${JSON.stringify(d)};n.dispatchEvent(new Event('change'));return 1})()`); await ngu(400); };
    await chonNgay('2025-11-30');
    const g1010 = await ev(`[...document.querySelectorAll('#goi-y details.gy')].map(d=>d.dataset.gy).join(',')`);
    dat('Ngày 30/11/2025 → 5 gợi ý của 1010-A', g1010 === '1010-A/01,1010-A/02,1010-A/03,1010-A/04,1010-A/05', g1010);
    dat('…và vẫn hiện "Bài giảng đã có" bên dưới', await ev(`!document.querySelector('#nhom-bai').classList.contains('an') && document.querySelectorAll('#kq .bai').length > 0`), await ev(`document.querySelector('#tt').innerText.split('\\n')[0]`));
    dat('Gợi ý 01 ghi rõ theo Phụ lục I Kim Chỉ Nam', await ev(`document.querySelector('details[data-gy="1010-A/01"] .gy-loai').innerText.includes('Phụ lục I')`));
    dat('Không còn nhãn "Bản nháp AI"', await ev(`!document.querySelector('#goi-y').innerText.includes('Bản nháp')`));
    // mở gợi ý, chọn checkbox
    await ev(`(()=>{document.querySelector('details[data-gy="1010-A/01"]').open=true;document.querySelector('details[data-gy="1010-A/03"]').open=true;return 1})()`);
    await ev(`document.querySelector('[data-chon="1010-A/01#2"]').click()`);
    await ev(`document.querySelector('[data-chon="1010-A/03#4"]').click()`);
    await ngu(150);
    if (args.includes('--anh')) {   // chụp ảnh màn hình để xem bố cục (máy tính + điện thoại)
      const { writeFileSync } = await import('node:fs');
      const thuMucAnh = args[args.indexOf('--anh') + 1];
      for (const [ten, w, h, mobile] of [['may-tinh', 1200, 900, false], ['dien-thoai', 390, 844, true]]) {
        await goi('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
        await ev(`document.querySelector('details[data-gy="1010-A/01"]').scrollIntoView({block:'start'})`); await ngu(300);
        const { data } = await goi('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(thuMucAnh, `goi-y-${ten}.png`), Buffer.from(data, 'base64'));
      }
      await goi('Emulation.clearDeviceMetricsOverride');
    }
    dat('Chọn 2 luận điểm từ 2 gợi ý → khay hiện "2"', await ev(`!document.querySelector('#khay').classList.contains('an') && document.querySelector('#khay-so').innerText==='2'`));
    dat('Lựa chọn được lưu trong localStorage', await ev(`JSON.parse(localStorage.getItem('baigiang-goi-y-chon')).length===2`));
    // mở nguồn bài giảng
    await ev(`(()=>{document.querySelector('details[data-gy="1010-A/02"]').open=true;document.querySelector('details[data-gy="1010-A/02"] .ng a[data-mo]').click();return 1})()`);
    await ngu(300);
    const xem = await ev(`({an:document.querySelector('#xem').classList.contains('an'), dau:document.querySelector('#xem-dau').innerText, chon:!!document.querySelector('#xem-than .chon'), chu:document.querySelector('#xem-than .chon')?.innerText})`);
    dat('Bấm nguồn → mở bài gốc đúng file, tô đúng đoạn', !xem.an && xem.dau.includes('1010-A/093.md') && xem.chon && xem.chu.includes('vô luân'), xem.dau.split('\n').pop());
    await ev(`document.querySelector('#dong').click()`);
    // sao chép
    await ev(`document.querySelector('#khay-xem').click()`); await ngu(150);
    const van = await ev(`document.querySelector('#chon-van').value`);
    dat('Khung "đã chọn" gom đúng 2 luận điểm, có nguồn', van.includes('Núi Nhà Chúa: Hội Thánh') && van.includes('tập luyện nghề binh đao') && van.includes('Kim Chỉ Nam Giảng Lễ §82') && van.includes('1010-A/101.md'), van.split('\n').length + ' dòng');
    await goi('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
    await goi('Page.bringToFront').catch(() => {});
    await ev(`document.querySelector('#chon-chep').click()`); await ngu(400);
    const tt = await ev(`document.querySelector('#chon-tt').innerText`);
    const clip = await ev(`navigator.clipboard.readText().catch(e=>'(không đọc được: '+e.message+')')`);
    const khop = String(clip).replace(/\r\n/g, '\n') === van;   // clipboard Windows đổi \n thành \r\n
    dat('Sao chép: clipboard nhận đúng nội dung', tt === 'Đã sao chép.' && khop, tt + ' · ' + (khop ? 'clipboard khớp' : String(clip).slice(0, 60)));
    await ev(`document.querySelector('#chon-dong').click()`);
    // tải lại trang: lựa chọn còn
    await goi('Page.reload'); await doi(`!document.getElementById('mo') && typeof GY!=='undefined' && GY`, 180000, 500);
    dat('Tải lại trang (offline): lựa chọn vẫn còn', await ev(`document.querySelector('#khay-so').innerText==='2'`));
    // ---- năm B: có gợi ý theo mã 1010-B ----
    await chonNgay('2026-11-29');
    dat('Ngày 29/11/2026 (CN I MV năm B) → hiện gợi ý và bài giảng', await ev(`document.querySelectorAll('#goi-y details.gy').length === 3 && document.querySelectorAll('#kq .bai').length>0`));
    // ---- 5321 năm I ----
    await chonNgay('2027-11-08');
    const g5321 = await ev(`[...document.querySelectorAll('#goi-y details.gy')].map(d=>d.dataset.gy).join(',')`);
    dat('Ngày 08/11/2027 (Thứ Hai tuần 32 TN, năm I) → 01-04, không có gợi ý năm II', g5321 === '5321-I-II/01,5321-I-II/02,5321-I-II/03,5321-I-II/04', g5321);
    // ---- 82612 ----
    await chonNgay('2025-12-26');
    const g82612 = await ev(`[...document.querySelectorAll('#goi-y details.gy')].map(d=>d.dataset.gy).join(',')`);
    dat('Ngày 26/12/2025 (Thánh Stêphanô) → 5 gợi ý', g82612.split(',').length === 5 && g82612.startsWith('82612/01'), g82612);
    // ---- các mã soạn lại: 1015, 1016, 1010-C ----
    const dsGy = () => ev(`[...document.querySelectorAll('#goi-y details.gy')].map(d=>d.dataset.gy).join(',')`);
    // xét từng nút chữ (textContent của cả khối dính liền các phần tử, gây báo nhầm "không?Nguồn")
    const chuHong = () => ev(`(()=>{const w=document.createTreeWalker(document.querySelector('#goi-y'),NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))if(/\\p{L}\\?\\p{L}|\\uFFFD/u.test(n.data))return true;return false})()`);
    await chonNgay('2025-12-05');
    const g1015 = await dsGy();
    dat('Ngày 05/12/2025 (Thứ Sáu tuần I MV) → 3 gợi ý 1015, không chữ hỏng', g1015 === '1015/01,1015/02,1015/03' && !(await chuHong()), g1015);
    await chonNgay('2025-12-06');
    const g1016 = await dsGy();
    dat('Ngày 06/12/2025 (Thứ Bảy tuần I MV) → 3 gợi ý 1016, không chữ hỏng', g1016 === '1016/01,1016/02,1016/03' && !(await chuHong()), g1016);
    await chonNgay('2027-11-28');
    const g1010C = await dsGy();
    dat('Ngày 28/11/2027 (CN I MV năm C) → 4 gợi ý 1010-C, gợi ý 01 theo Phụ lục I', g1010C === '1010-C/01,1010-C/02,1010-C/03,1010-C/04'
      && await ev(`document.querySelector('details[data-gy="1010-C/01"] .gy-loai').innerText.includes('Phụ lục I')`), g1010C);
    // ---- gõ tên lễ ----
    await ev(`document.querySelector('#ngay').value=''`);
    await timQ('chúa nhật 1 mùa vọng năm A');
    dat('Gõ "chúa nhật 1 mùa vọng năm A" → hiện gợi ý 1010-A', await ev(`document.querySelectorAll('#goi-y details.gy').length===5`), await ev(`document.querySelector('#tt').innerText.split('\\n').slice(-1)[0]`));
    // ---- chip chọn nhanh ----
    await ev(`(()=>{document.querySelector('#q').value='';document.querySelector('#xoa').click();return 1})()`); await ngu(200);
    await ev(`document.querySelector('[data-gy-le="5321-I-II"]').click()`); await ngu(400);
    dat('Chip "Thứ Hai Tuần XXXII" (không chọn năm) → đủ 5 gợi ý, có nhãn "chỉ dùng năm I/II"', await ev(`document.querySelectorAll('#goi-y details.gy').length===5 && document.querySelector('#goi-y').innerText.includes('chỉ dùng năm II')`));
    // bỏ chọn
    await ev(`document.querySelector('#khay-xem').click()`); await ev(`document.querySelector('#chon-xoa').click()`); await ev(`document.querySelector('#chon-dong').click()`);
    dat('Bỏ chọn tất cả → khay ẩn', await ev(`document.querySelector('#khay').classList.contains('an')`));
  }
  dat('Không có yêu cầu mạng nào (chạy offline hoàn toàn)', yeuCauMang.length === 0, yeuCauMang.slice(0, 3).join(' '));
  dat('Không có lỗi JavaScript', !loiJs.length, loiJs.join('; '));
} catch (e) {
  dat('Lỗi khi chạy kiểm thử', false, e.message);
} finally {
  try { ws?.close(); } catch {}
  br.kill();
  await ngu(500);
  try { rmSync(prof, { recursive: true, force: true }); } catch {}
}
const hong = kq.filter((x) => !x.ok).length;
console.log(`\n${kq.length - hong}/${kq.length} đạt.`);
process.exit(hong ? 1 : 0);
