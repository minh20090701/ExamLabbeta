# ExamLab – Hội bạn & Thi đua (BETA độc lập)

## Nội dung

- `index.html`: giao diện Hội bạn Beta.
- `css/beta.css`: giao diện riêng.
- `js/beta.js`: tìm bạn, kết bạn, bảng xếp hạng, làm thử thách.
- `sql/SETUP_BETA.sql`: tạo **5 bảng và 7 hàm RPC riêng** trên Supabase hiện tại. Cài **một lần**.

## Triển khai vào repository ExamLab hiện tại

1. Sao lưu repository trước khi sửa.
2. Giải nén file ZIP.
3. Upload **cả thư mục `friends-beta`** vào thư mục gốc repository, không trộn các file trong thư mục này với file web chính.
4. Trong Supabase Dashboard → **SQL Editor** → **New query**, mở `friends-beta/sql/SETUP_BETA.sql`, sao chép toàn bộ SQL, chạy một lần. Đọc SQL trước khi thực thi.
5. Đảm bảo repository chính có `supabase-config.js` và `js/supabase-client.js` đúng như ExamLab V8. Không sửa hai file này; Beta tham chiếu chúng qua `../`.
6. Chờ GitHub Pages triển khai, sau đó mở:

   `https://minh20090701.github.io/ExamLabbeta/friends-beta/`

   Nếu tên repository của bạn khác, thay `ExamLabbeta` bằng tên thực tế.

**KHÔNG sửa** `index.html` ở thư mục gốc, `profile.html`, `login.html`, bảng `examlab_attempts` hoặc bảng `examlab_decks`. Website chính vẫn hoạt động như trước.

## Cách kiểm tra bằng 2 tài khoản

- Dùng hai tài khoản ExamLab **đã xác nhận email** ở hai trình duyệt/hồ sơ riêng.
- Cả hai truy cập `/friends-beta/`, lưu hồ sơ Beta, bật “Cho phép người khác tìm mình bằng Gmail”. Cài đặt này mặc định tắt để bảo vệ riêng tư.
- Tài khoản A tìm đúng email tài khoản B và gửi lời mời; tài khoản B chấp nhận ở mục Lời mời; kiểm tra danh sách bạn bè hai phía.
- Mỗi tài khoản bấm “Bắt đầu thi đua”, làm 10 câu và nộp trong 10 phút.
- Xem bảng xếp hạng tuần, thử tải lại để kiểm tra dữ liệu vẫn còn.
- Thử tắt cho phép tìm và tra cứu lại bằng tài khoản khác: người đã tắt không xuất hiện trong kết quả tìm.

## Quy tắc & an toàn

- Chỉ tìm bằng **email chính xác**, không liệt kê người dùng hoặc công khai email khác.
- Người được tìm phải tự vào Beta và cho phép được tìm. Tối đa 12 lượt tra cứu/giờ/tài khoản.
- Một tài khoản chỉ có **1 lượt thi hằng ngày**, thời gian 10 phút, 10 câu/ngày. Điểm = số câu đúng × 100, tối đa 1000 điểm mỗi ngày. Câu hỏi và đáp án chuẩn lưu trong Supabase; không phát đáp án chuẩn về trình duyệt.
- Điểm thi đua tổng hợp theo tuần (thứ Hai đến Chủ nhật, múi giờ Việt Nam), **chỉ hiện bạn và bạn bè đã chấp nhận**.
- Hủy kết bạn sẽ loại người đó khỏi bảng xếp hạng của bạn (dữ liệu điểm của họ không bị xóa).
- Không được cộng điểm vào bài thi ExamLab chính. Chưa hỗ trợ tin nhắn, bình luận hay đua top toàn hệ thống.
- Không dùng khóa `service_role` / secret API key trong website hoặc ZIP. Nếu web yêu cầu sửa dữ liệu SQL, thực hiện trong Supabase Dashboard, không đưa thông tin truy cập SQL lên GitHub.
- Các quyền sử dụng dữ liệu Beta được kiểm soát trên Supabase qua những RPC có xác thực người dùng, RLS được bật cho 5 bảng. Vì là beta, nên kiểm tra kỹ trước khi mở rộng cho nhiều người.

## Hạn chế bản Beta

- Câu hỏi thử thách là bộ 30 câu được biên soạn riêng để kiểm thử, chưa đồng bộ đề từ 7 bộ đề ExamLab.
- Lời mời không gửi email thông báo; người nhận mở trang Beta để xem.
- Nếu hết 10 phút mà chưa nộp, lượt thi trong ngày kết thúc và không ghi điểm. Không hoàn lại lượt.
- Nếu đang làm mà đổi thiết bị/tải lại trang, thời gian vẫn tính từ lần mở đầu, câu trả lời chưa nộp có thể bị mất.
- Để xóa toàn bộ dữ liệu Beta khi thử xong: cân nhắc sao lưu rồi xóa 5 bảng `examlab_beta_*` và các hàm `examlab_beta_*` bằng Supabase SQL Editor. **Không xóa bảng chính hoặc tài khoản Supabase.**
