
(function(){
  'use strict';
  const account = document.getElementById('accountLabel');
  const badge = document.querySelector('.profile-top-link .account-mark');
  const link = document.querySelector('.profile-top-link');
  const auth=window.ExamLabAuth;
  const db=window.ExamLabSupabase;
  if(!account || (!auth && !db)) return;
  let ticket=0;
  async function refresh(){
    const token=++ticket;
    try{
      let user;
      if(auth){
        user=await auth.getSession();
      }else{
        const {data,error}=await db.auth.getUser();
        if(error)throw error;
        const raw=data?.user;
        user=raw?{name:String(raw.user_metadata?.display_name||raw.email?.split('@')[0]||'Sĩ tử'),email:raw.email}:null;
      }
      if(token!==ticket)return;
      const display=String(user?.name || user?.email?.split('@')[0] || 'Đăng nhập').trim();
      account.textContent=display || 'Đăng nhập';
      if(badge)badge.textContent=user ? (display[0]||'H').toLocaleUpperCase('vi-VN') : '✦';
      if(link){link.title=user ? 'Mở hồ sơ: '+display : 'Đăng nhập hoặc đăng ký';link.href=user?.kind==='supabase-account'?'profile.html':'login.html';}
    }catch(err){
      if(token!==ticket)return;
      account.textContent='Tài khoản';
      if(link)link.title='Mở trang tài khoản';
    }
  }
  refresh();
  if(typeof auth?.onAuthStateChange==='function'){
    auth.onAuthStateChange(refresh);
  }else if(typeof db?.auth?.onAuthStateChange==='function'){
    db.auth.onAuthStateChange(()=>setTimeout(refresh,0));
  }
})();
