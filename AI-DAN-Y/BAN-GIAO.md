# Bàn giao — làm tiếp ngân hàng gợi ý bài giảng

Dành cho mọi phiên làm việc / AI agent. Đọc hết trang này trước khi làm. Mỗi phiên thường làm được 4–5 mã lễ; phiên sau tiếp tục mà không phải dò lại từ đầu.

## Nguyên tắc
1. **Một mã chỉ XONG khi `ghi-goi-y.mjs` kiểm tra 0 lỗi và ghi `OUTPUT/<tm>/goi-y.json`.** Chưa tới bước đó thì mã vẫn "đang làm". Không có gì phải ghi nhớ thêm.
2. **Phiên bị ngắt (hết token, lỗi máy…) không làm hỏng gì.** Giữ chỗ tự hết hạn sau 6 giờ; phiên sau thấy mã làm dở và làm tiếp từ gói đọc chưa ghi trích ý.
3. **Không làm lại mã đã xong.** `tiep-theo.mjs` và `chuan-bi.mjs` tự bỏ qua mã đã xong.
4. **Không đụng mã phiên khác đang giữ.**

## Bắt đầu phiên
```bash
node AI-DAN-Y/CONG-CU/tiep-theo.mjs              # mã làm dở (làm trước), mã đang bị giữ, rồi các mã chưa làm theo lịch
node AI-DAN-Y/CONG-CU/tiep-theo.mjs --nhan <tm> --ai "<tên phiên>"   # giữ chỗ 6 giờ; chạy lại để gia hạn
node AI-DAN-Y/CONG-CU/tiep-theo.mjs --xem <tm>   # chỗ dừng và lệnh kế tiếp của mã đó
```
Chọn theo thứ tự lệnh đầu in ra: mã làm dở trước, rồi tới mã gần ngày hôm nay nhất. Nếu cần chỉ ra ngày khác, dùng `--tu YYYY-MM-DD`.

## Làm một mã (có điểm dừng an toàn)
| Bước | Lệnh / việc | Điểm dừng an toàn |
|---|---|---|
| 1 | `node AI-DAN-Y/CONG-CU/doi-chieu-loi-chua.mjs <tm>` rồi `node AI-DAN-Y/CONG-CU/chuan-bi.mjs <tm>` | có `LAM-VIEC/<tm>/goi-NN.txt` |
| 2 | Tra Phụ lục I (`NGUON/kim-chi-nam-giang-le.en.txt`, phần CYCLE A/B/C) cho Chúa nhật / lễ trọng. Có mục mà `HUONG-DAN/kim-chi-nam-tham-chieu.json` chưa có → thêm, đối chiếu từng dòng | — |
| 3 | Đọc **hết** từng gói, theo thứ tự. Đọc xong gói nào thì ghi ngay vào `LAM-VIEC/<tm>/trich-y.md` dưới tiêu đề `## goi-NN` (mỗi bài một dòng: hướng chính, số dòng gốc dùng được, ghi chú loại trừ) | mỗi tiêu đề `## goi-NN` |
| 4 | Thêm mục `## Gom hướng`: 1–5 hướng thật sự độc lập, không thêm cho đủ số | có `## Gom hướng` |
| 5 | Soạn `LAM-VIEC/<tm>/goi-y.nhap.json` theo `SCHEMA/goi-y.md` và `HUONG-DAN/quy-tac-bien-soan.md` | có bản nháp |
| 6 | `node AI-DAN-Y/CONG-CU/ghi-goi-y.mjs <tm> --thu` → sửa tới khi 0 lỗi | — |
| 7 | `node AI-DAN-Y/CONG-CU/ghi-goi-y.mjs <tm>` rồi `node AI-DAN-Y/CONG-CU/nap-csdl.mjs` | **XONG** |
| 8 | Commit ngay: `git add AI-DAN-Y/OUTPUT/<tm>/goi-y.json AI-DAN-Y/DA-LAM.json AI-DAN-Y/DA-LAM.md` (+ `kim-chi-nam-tham-chieu.json` nếu có sửa), commit vào nhánh đang làm. **Không push.** | — |

Sắp hết ngữ cảnh/token giữa chừng: đọc xong gói đang đọc, ghi trích ý của gói đó, rồi dừng. Không ghi OUTPUT khi chưa xong. Trích ý dở dang của một gói thì bỏ, phiên sau đọc lại gói đó.

Gói lớn hơn giới hạn của công cụ đọc: đọc theo đoạn (offset/limit) đến hết, không bỏ phần sau.

## Kết thúc phiên
```bash
node AI-DAN-Y/CONG-CU/kiem-thu-goi-y.mjs                           # phải đạt hết
node TIM-KIEM/dong-goi-html.mjs --goi-y --ra baigiang.html          # MỘT lần cuối phiên, không làm sau mỗi mã (file 38 MB)
node AI-DAN-Y/CONG-CU/kiem-thu-html.mjs baigiang.html               # phải đạt hết
```
Commit `baigiang.html` một lần ở cuối phiên. Trả các mã đang giữ mà chưa làm tới đâu: `tiep-theo.mjs --tra <tm>`.

## Lỗi đã gặp — đừng lặp lại
- **Ghi JSON tiếng Việt qua PowerShell** (`Set-Content`, `>`) làm hỏng dấu thành `?` (bản 1016 cũ). Chỉ ghi bằng công cụ Write hoặc Node (UTF-8).
- **Viết nội dung bằng tiếng Anh** (bản 1010-C, 1015 cũ). Mọi phần tác giả viết phải là tiếng Việt có dấu. Riêng trích Kim Chỉ Nam và trích bài giảng tiếng Anh thì giữ nguyên văn.
- **Câu đệm / giải thích lặp** ("Grounded interpretation…"). Mỗi luận điểm phải có giải thích riêng, rút từ chính các dòng được trích.
- **Trích ý chỉ chép tiêu đề bài** mà không đọc. Phải đọc nội dung.
- **Có mục Phụ lục I mà gợi ý 01 ghi "nguyên tắc chung"** (bản 1010-B cũ). Hiện `kiem.mjs` báo lỗi trường hợp này, nhưng chỉ khi mục đó đã có trong bảng tham chiếu, nên vẫn phải làm bước 2.
- **Bản hướng dẫn cử hành** (dẫn lễ, lời nguyện tín hữu, "Headings for readings") không phải bài giảng → ghi vào `khong_dung`.
- **Đoạn xếp nhầm ngày** trong một file (vd phần Thứ Bảy nằm trong bài Thứ Sáu) → `khong_dung` với `dong: [a, b]`.
- Lời Chúa trong `loi-chua.json` dùng chữ `Ð` (U+00D0). Bộ so khớp đã chuẩn hóa sẵn, nhưng câu trích phải chép từ chính `loi-chua.json`, không chép từ trí nhớ.

## Không được
Sửa file Markdown bài giảng; sửa tay `baigiang.html`; đổi `duyet.trang_thai` (chỉ người phụ trách được đổi); push lên GitHub; dùng nhãn "bản nháp AI" (gợi ý là phần tổng hợp có nguồn).
