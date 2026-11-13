# AI-DAN-Y — ngân hàng gợi ý bài giảng (local)

Gợi ý bài giảng có cấu trúc (1–5 cho mỗi mã lễ). Mỗi gợi ý được soạn từ bộ Lời Chúa của `catholic-cal-vn`, kho bài giảng Markdown và *Kim Chỉ Nam Giảng Lễ*. Đây là phần tổng hợp: mọi luận điểm đều có nguồn kiểm tra được (bài giảng + số dòng, Lời Chúa, Kim Chỉ Nam). Trạng thái `draft` nghĩa là người phụ trách chưa duyệt; trang không hiện nhãn cho trạng thái này.

**Ghi file bằng UTF-8** (công cụ Write/Node). Không ghi JSON tiếng Việt qua PowerShell `Set-Content`/`>`: bản 1016 trước đây hỏng hết dấu ("Th? B?y") vì vậy. `ghi-goi-y.mjs` nay từ chối nội dung không dấu, lỗi mã hoá, câu đệm và giải thích lặp.

| Thư mục | Nội dung | Git |
|---|---|---|
| `CONG-CU/` | Công cụ Node (không cần npm) | theo dõi |
| `HUONG-DAN/` | Quy tắc biên soạn; bảng tham chiếu Kim Chỉ Nam và Phụ lục I | theo dõi |
| `SCHEMA/` | Cấu trúc `goi-y.json` | theo dõi |
| `OUTPUT/<tm>/` | `goi-y.json` (gợi ý) | theo dõi |
| `OUTPUT/<tm>/` | `loi-chua.json` (nguyên văn bài đọc, tạo lại bằng `doi-chieu-loi-chua.mjs`) | **bỏ qua** |
| `REPORTS/` | Bảng đối chiếu mã lễ, danh sách nguồn, trạng thái nguồn, báo cáo | **bỏ qua** |
| `LAM-VIEC/<tm>/` | Gói đọc, ghi chú trích ý, bản nháp | **bỏ qua** |
| `NGUON/` | Bản Kim Chỉ Nam tải từ vatican.va | **bỏ qua** |

## Quy trình cho một mã lễ

**Làm nhiều phiên / nhiều agent nối tiếp: xem [BAN-GIAO.md](BAN-GIAO.md)** và chạy `node AI-DAN-Y/CONG-CU/tiep-theo.mjs` (mã làm dở, mã đang có người giữ, mã kế tiếp theo lịch).

**Xem [DA-LAM.md](DA-LAM.md)**: mã nào đã ✅ Xong thì không làm lại. Danh sách này tự cập nhật sau mỗi lần `ghi-goi-y.mjs` / `nap-csdl.mjs`; cũng có thể chạy `node AI-DAN-Y/CONG-CU/tien-do.mjs`. `chuan-bi.mjs` tự bỏ qua mã đã xong (trừ khi thêm `--lam-lai`).

```bash
node TIM-KIEM/lap-chi-muc.mjs                          # chỉ mục bài giảng (nếu chưa có / có bài mới)
node AI-DAN-Y/CONG-CU/doi-chieu-loi-chua.mjs 1010-A    # mã lễ → bộ Lời Chúa; ghi OUTPUT/1010-A/loi-chua.json
node AI-DAN-Y/CONG-CU/chuan-bi.mjs 1010-A              # thu thập mọi bài, gom bài trùng, xuất gói đọc
#   … đọc hết các gói, ghi LAM-VIEC/1010-A/trich-y.md, soạn LAM-VIEC/1010-A/goi-y.nhap.json
node AI-DAN-Y/CONG-CU/ghi-goi-y.mjs 1010-A --thu       # chỉ kiểm tra
node AI-DAN-Y/CONG-CU/ghi-goi-y.mjs 1010-A             # kiểm tra + ghi OUTPUT (không ghi đè gợi ý đã duyệt)
node AI-DAN-Y/CONG-CU/nap-csdl.mjs                     # nạp SQLite + FTS5, gắn cờ nguồn đã đổi
node TIM-KIEM/dong-goi-html.mjs --goi-y --ra baigiang.html   # trang chính kèm gợi ý
node AI-DAN-Y/CONG-CU/kiem-thu-html.mjs baigiang.html  # kiểm thử trang chính (offline)
```

## Kiểm thử

```bash
node AI-DAN-Y/CONG-CU/kiem-thu-goi-y.mjs               # ánh xạ, trùng lặp, chống trích dẫn bịa, duyệt, SQLite
node AI-DAN-Y/CONG-CU/kiem-thu-html.mjs                # mở baigiang-goi-y.html trong Chrome/Edge headless, OFFLINE
node AI-DAN-Y/CONG-CU/kiem-thu-html.mjs TIM-KIEM/xuat/Tim-kiem-bai-giang.html --khong-goi-y   # bản cũ không hỏng
```

## Duyệt
Người phụ trách sửa `duyet.trang_thai` trong `OUTPUT/<tm>/goi-y.json` (`draft` → `da-duyet` / `can-sua` / `tu-choi`) rồi chạy `nap-csdl.mjs` và đóng gói lại. Khi ghi lại bản nháp, công cụ giữ nguyên các gợi ý không còn ở trạng thái `draft`.
