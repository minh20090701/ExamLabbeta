# EXAMLAB V14 — BANNER, THÔNG BÁO & MFA

## Thay đổi
- Banner trang chủ: "Ôn luyện mỗi ngày. / Tự tin bước vào kỳ thi."
- Các lời nhắc `confirm()` và `alert()` trong mã ứng dụng đã đổi sang hộp thoại có giao diện ExamLab dùng chung (`js/examlab-dialogs-v14.js`, `css/examlab-dialogs-v14.css`). Bao gồm cả Friends Beta.
- Tắt Authenticator cần nhập mã mới từ ứng dụng, xác minh lại qua Supabase Auth MFA rồi mới cho `unenroll`. Hủy hoặc nhập sai sẽ không tắt 2FA. Mã không lưu vào localStorage hoặc log.
- Toast hiện hữu được đồng bộ tông nâu/đỏ.

## Cập nhật GitHub
1. Sao lưu repository đang dùng.
2. Giải nén ZIP và upload TOÀN BỘ nội dung trong ZIP vào thư mục gốc repository, ghi đè các file đã có. Đừng upload ZIP như một file web.
3. Đảm bảo hai file mới trong thư mục `css/`, `js/` cũng được upload.
4. Đợi GitHub Pages triển khai, tải lại trang bằng Ctrl + Shift + R hoặc tab ẩn danh.
5. Kiểm tra xóa tài liệu/đề và bật/tắt MFA bằng tài khoản thử nghiệm.

Không cần chạy SQL mới. Dữ liệu đề, tài khoản và quyền Supabase gốc được giữ nguyên.
Lưu ý: Hộp thoại do chính trình duyệt hiển thị khi đóng tab có sửa đổi chưa lưu (`beforeunload`) không thể tùy biến giao diện.
