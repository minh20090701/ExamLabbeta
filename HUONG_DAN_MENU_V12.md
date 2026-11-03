# ExamLab V12 — Menu đầy đủ, không gạch chân

## Có gì mới
- Menu 5 trang chính hiện toàn bộ nút, không cuộn ngang và không còn gạch chân chữ như link.
- Desktop: các nút cùng một hàng riêng bên dưới logo; Mobile: tự chia hàng nút.
- Giữ điều hướng đến đúng trang; giữ kiểm tra quyền quản trị (chỉ Admin thấy Quản lý đề/Duyệt tài liệu).
- Không thay đổi Supabase, bộ đề, bài thi hoặc hồ sơ.
- Beta kết bạn vẫn giữ độc lập như yêu cầu trước.

## Cập nhật nhanh (khuyên dùng)
Tải nội dung ZIP cập nhật nhanh lên thư mục gốc của repository ExamLabbeta:
  index.html, documents.html, study.html, admin.html, admin-docs.html
  css/header-full-v12.css
Ghi đè HTML cũ và giữ nguyên các file còn lại. KHÔNG chạy SQL.

## Lưu ý
Các nút vẫn chuyển trang, không gộp thành ứng dụng SPA; mục tiêu là giao diện đầy đủ, không hiển thị như hyperlink chữ gạch chân.
