
(function(){
 const $=id=>document.getElementById(id),db=window.ExamLabSupabase;
 if(!db){$('status').textContent=window.ExamLabSupabaseError||'Chưa kết nối Supabase';$('resetForm').hidden=true;return}
 $('resetForm').addEventListener('submit',async e=>{e.preventDefault();const p=$('password').value; if(p!==$('confirmPassword').value){$('status').textContent='Xác nhận mật khẩu không khớp.';return}try{await window.ExamLabAuth.updatePassword(p);$('status').textContent='Đã đổi mật khẩu. Bạn có thể quay lại trang đăng nhập.';$('resetForm').hidden=true}catch(err){$('status').textContent=err.message}});
})();

