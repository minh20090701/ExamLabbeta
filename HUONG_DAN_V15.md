# ExamLab V15 — Sửa đồng bộ lịch sử bấm giờ học

## Thứ tự cập nhật

1. Sao lưu GitHub repository và file `js/study-timer.js` đang chạy.
2. Trong Supabase → SQL Editor, chạy `docs/SETUP_STUDY_SYNC_V15.sql` (chạy lại được, không xóa lịch sử).
3. Upload 3 file vào GitHub `minh20090701/ExamLabbeta` và ghi đè đúng đường dẫn:
   - `study.html`
   - `js/study-timer.js`
   - `css/study-timer.css`
4. `Commit changes`. Mở `https://minh20090701.github.io/ExamLabbeta/study.html?v=15` và tải lại bằng Ctrl+Shift+R.
5. Đăng nhập tài khoản cũ, nhấn `Đồng bộ ngay`. Mở trang trên thiết bị khác cùng tài khoản để thử đọc lại lịch sử.

## Đã sửa

- Giữ nguyên dữ liệu V9/V14 đã lưu tại `examlab.study.history.v9:<user_id>`; một bản sao trước nhập được lưu tại `examlab.study.history.backup.v15:<user_id>`.
- Các phiên học cũ trên thiết bị thuộc tài khoản đang đăng nhập được đưa vào hàng đợi đồng bộ một lần khi nâng cấp lên V15.
- Có thể chủ động nhập lịch sử khách cũ của *trình duyệt hiện tại* bằng nút riêng nếu có dữ liệu. Không tự trộn hai tài khoản.
- Khi mất mạng, thêm/xóa dữ liệu vẫn cập nhật tại máy và được xếp hàng để gửi sau.
- Hành động xóa riêng lẻ và xóa tất cả được cập nhật lên Supabase (sau khi kết nối lại).
- Giao diện báo đang chờ, đang đồng bộ, thành công, lỗi bảng/RLS, ngoại tuyến hoặc chưa đăng nhập.
- Thống kê hôm nay, tháng này, 7 ngày qua, số phiên học, lấy từ lịch sử hợp nhất.
- Bộ đếm đang chạy vẫn nằm trên thiết bị, không đồng bộ realtime.

## Lưu ý quan trọng

- V15 không xóa dữ liệu Supabase và không cần tạo tài khoản mới.
- Nếu đang dùng cùng tài khoản trên nhiều tab, tránh xóa cùng một phiên đồng thời ở cả hai tab cho đến khi đồng bộ hoàn tất.
- Nếu GitHub Pages đang dùng phiên bản V14, giữ nguyên cấu hình `supabase-config.js`, các trang và file không có trong bản vá.
- Chỉ xác nhận `Đã đồng bộ` khi thật sự nhận được phản hồi thành công từ Supabase.
- Không tự ý xóa `localStorage` hoặc dùng nút Xóa lịch sử để sửa lỗi đồng bộ.
