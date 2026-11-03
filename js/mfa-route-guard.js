/* Điều hướng về bước TOTP nếu phiên đăng nhập có Authenticator chưa được xác minh.
   Để bảo vệ dữ liệu ở cấp API còn cần chính sách RLS tương ứng. */
(async function(){
 try{
  const c=window.ExamLabSupabase;if(!c)return;
  const {data:session}=await c.auth.getSession();if(!session?.session)return;
  const {data,error}=await c.auth.mfa.getAuthenticatorAssuranceLevel();if(error)return;
  if(data?.currentLevel==='aal1'&&data?.nextLevel==='aal2'){
   const next=location.pathname.split('/').pop()||'index.html';
   location.replace('login.html?mfa=1&next='+encodeURIComponent(next+location.search));
  }
 }catch(err){console.warn('[ExamLab] Không xác định được trạng thái MFA:',err.message)}
})();
