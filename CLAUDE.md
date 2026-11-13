# PhungVu-MD

Kho bài giảng Markdown (mỗi thư mục là một mã lễ: `1010-A`, `5321-I-II`, `82612`…) và trang tìm kiếm `baigiang.html`.

## Lệnh "AI hãy soạn gợi ý trong AI-DAN-Y"
Khi người dùng nói câu này (hoặc "soạn gợi ý", "làm tiếp gợi ý bài giảng"):
1. Đọc `AI-DAN-Y/BAN-GIAO.md` — đó là toàn bộ lệnh: đọc gì, chọn mã nào, làm 8 bước nào, kiểm tra ra sao.
2. Chạy `node AI-DAN-Y/CONG-CU/tiep-theo.mjs` để biết mã làm dở / mã kế tiếp. **Không** đọc lại các mã đã xong.
3. Làm theo BAN-GIAO.md cho đến khi `ghi-goi-y.mjs` báo 0 lỗi; commit (không push); cuối phiên báo lại kết quả.

## Luôn luôn
- `baigiang.html` được tạo tự động: `node TIM-KIEM/dong-goi-html.mjs --goi-y --ra baigiang.html` (một lần cuối phiên). Không sửa tay.
- Không sửa file Markdown bài giảng. Không push khi người dùng chưa yêu cầu.
- Ghi file tiếng Việt bằng UTF-8 (công cụ Write / Node), không ghi qua PowerShell.
