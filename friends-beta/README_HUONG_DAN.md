# EXAMLAB FRIENDS & THI ĐUA — BETA V2

Phiên bản này **độc lập với ExamLab chính**. Không sửa `index.html`, `admin.html`, dữ liệu đề chính hoặc giao diện của các trang khác.

## Các tính năng

1. **Kết bạn bằng Gmail** (V1): Tìm chính xác email đã tham gia Beta và tự bật quyền tìm kiếm. Gửi, nhận, chấp nhận, từ chối hoặc hủy lời mời, hủy kết bạn.
2. **Thi đua 10 câu/ngày** (V1): 10 phút, 100 điểm/câu đúng; máy chủ Supabase chấm điểm và chỉ cho một lượt/ngày.
3. **Thách đấu 1–1 (mới)**: Bấm **⚔ Thách đấu** ở danh sách bạn bè. Người nhận có thể chấp nhận hoặc từ chối. Hai người **dùng điểm thi đua hằng ngày đã có**, nên không phát sinh lượt thi mới. Người điểm cao hơn thắng; nếu bằng điểm, thời gian ngắn hơn thắng; bằng cả hai là hòa.
4. **Giới hạn chống làm phiền (mới)**: Chỉ thách đấu với bạn bè đã kết nối; tối đa 3 lời thách đấu gửi mỗi tài khoản/ngày, một lời mời đang hiệu lực cho cùng cặp trong ngày. Lời thách đấu chưa được chấp nhận sẽ hết hạn sau ngày hôm đó (theo giờ Việt Nam).
5. **Bảng xếp hạng tuần + tháng (mới)**: Chỉ gồm bạn và bạn bè đã kết nối.
6. **Thành tích (mới)**: Tổng điểm, chuỗi ngày thi, số ngày dự thi, tỉ lệ trả lời đúng, điểm cao nhất, điểm tháng, 5 huy hiệu đạt được theo điều kiện thực tế, lịch sử 14 bài gần nhất.
7. **Thông báo trong trang (mới)**: Số lời thách đấu đang chờ và số lời mời kết bạn. Chỉ cập nhật khi vào trang, chuyển lại tab hoặc bấm cập nhật; không gửi email, SMS hay push.

## Cài đặt vào repository ExamLabbeta

1. Sao lưu thư mục `friends-beta` cũ nếu đã chỉnh sửa riêng.
2. Giải nén ZIP. Upload **toàn bộ thư mục `friends-beta/`** vào **thư mục gốc** repo GitHub hiện tại `ExamLabbeta`.
3. Mở Supabase Dashboard → dự án **cũ** của ExamLab → **SQL Editor**.
4. Nếu đã chạy `sql/SETUP_BETA.sql` từ V1, **chỉ chạy** `sql/UPGRADE_BETA_V2.sql`.
   - Nếu chưa từng cài Beta V1, hãy chạy `sql/SETUP_BETA.sql` **trước**, rồi mới chạy `sql/UPGRADE_BETA_V2.sql`.
   - Có thể chạy lại tệp nâng cấp V2; tệp dùng `IF NOT EXISTS` và `CREATE OR REPLACE`.
5. Mở `https://minh20090701.github.io/ExamLabbeta/friends-beta/?v=2`, bấm `Ctrl+Shift+R` trên máy tính hoặc mở tab ẩn danh để tránh cache phiên bản cũ.
6. Đăng nhập bằng tài khoản ExamLab đã xác nhận email. Nếu chưa tạo hồ sơ Beta, nhập tên và bấm Lưu hồ sơ Beta.

**Không cần sửa `supabase-config.js`** nếu Beta V1 và ExamLab đã kết nối cùng một Supabase.

## Kiểm thử thách đấu bằng hai tài khoản

1. Đăng nhập bằng tài khoản A, bật cho phép tìm kiếm qua email, lưu hồ sơ.
2. Tài khoản B cũng đăng nhập Beta, bật tìm kiếm; A tìm B bằng địa chỉ Gmail chính xác.
3. A gửi lời mời kết bạn, B chấp nhận.
4. A bấm **⚔ Thách đấu** bên cạnh B; B mở Beta và bấm **Chấp nhận** ở mục Thách đấu 1–1.
5. A và B mỗi người làm một lượt 10 câu hằng ngày của Beta. Bấm cập nhật bảng thách đấu: người điểm cao hơn thắng; hòa điểm so thời gian làm.
6. Dùng nút **Tuần này / Tháng này** để xem bảng xếp hạng, kéo xuống dưới để xem huy hiệu và lịch sử điểm.

## Quyền riêng tư và chống gian lận

- Email chỉ dùng để tìm chính xác tài khoản tự bật tìm kiếm; không liệt kê hàng loạt và không hiển thị email người khác.
- Beta sử dụng các hàm RPC `SECURITY DEFINER` kiểm tra `auth.uid()`. Các bảng nhạy cảm bật RLS và không cho client truy vấn trực tiếp.
- Thời gian thử thách, đáp án đúng và số điểm được xử lý trên Supabase của Beta V1. V2 chỉ đọc điểm đã chấm trên máy chủ để đối chiếu thách đấu.
- Thách đấu 1–1 được tính **trong ngày theo giờ Việt Nam**, không kéo dài sang ngày hôm sau. Nếu hai bên không hoàn thành, trạng thái hiển thị hết hạn hoặc thiếu kết quả.
- Điểm và dữ liệu của ExamLab chính **không bị thay đổi**.

## Khi có lỗi

- **Không thấy nội dung V2:** Kiểm tra `friends-beta/js/beta-v2.js`, làm mới trang và mở Console (F12).
- **Chưa cài SQL V2:** Chạy đúng `sql/UPGRADE_BETA_V2.sql` trong dự án Supabase mà ExamLab đang kết nối.
- **Không thấy tên bạn bè:** Cả hai tài khoản phải lưu hồ sơ Beta; để tìm Gmail, người được tìm phải bật cho phép tìm kiếm.
- **Không thấy kết quả 1–1:** Hai bên phải chấp nhận thách đấu và hoàn thành lượt thi hằng ngày cùng ngày.
- **Bị giới hạn lời mời:** Chỉ có 3 lượt gửi thách đấu mỗi ngày để tránh spam.

## Giới hạn kiểm thử

- Đã kiểm tra cú pháp JavaScript, giao diện và luồng thao tác bằng dữ liệu Supabase mô phỏng trên màn hình 360, 393 và 1280px.
- Chưa chạy SQL hoặc thử nghiệm end-to-end với **dự án Supabase thật** của bạn. Hãy test bằng 2 tài khoản trước khi sử dụng rộng rãi.
