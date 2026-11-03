
/* ExamLab 2026 - Server-verified admin visibility; never trust localStorage as role. */
(function(){
  'use strict';
  const links=[...document.querySelectorAll('[data-admin-only]')];
  const gate=document.querySelector('[data-admin-guard]');
  const screen=document.getElementById('adminPermissionScreen');
  let serial=0;
  let confirmed=false;
  const root=document.documentElement;
  root.dataset.examlabAdmin='no';
  const role={isAdmin:()=>confirmed,refresh};
  window.ExamLabRole=role;
  function message(title,desc,canSignIn){
    if(!screen)return;
    screen.replaceChildren();
    const h=document.createElement('h2');h.textContent=title;
    const p=document.createElement('p');p.textContent=desc;
    screen.append(h,p);
    if(canSignIn){const a=document.createElement('a');a.href='login.html';a.textContent='Đến trang đăng nhập';a.className='btn btn-primary';screen.append(a)}
  }
  async function refresh(){
    const request=++serial;
    // Fail closed while checking or after logout.
    confirmed=false;
    root.dataset.examlabAdmin='no';
    for(const el of links)el.hidden=true;
    if(gate)gate.hidden=true;
    if(screen){screen.hidden=false;message('Đang xác minh quyền quản trị','Vui lòng kiểm tra kết nối mạng.',false)}
    try{
      if(!window.ExamLabAdminAccess?.getAccess)throw Error('Không tải được phần kiểm tra quyền Admin.');
      const access=await window.ExamLabAdminAccess.getAccess();
      if(request!==serial)return;
      confirmed=access.allowed===true;
      // Two conditions must agree: server-checked role and element.hidden.
      for(const el of links)el.hidden=!confirmed;
      root.dataset.examlabAdmin=confirmed?'yes':'no';
      if(gate)gate.hidden=!confirmed;
      if(screen){screen.hidden=confirmed;if(!confirmed)message('Bạn chưa có quyền quản trị',access.message||'Tài khoản không được cấp quyền Admin.',true)}
      document.dispatchEvent(new CustomEvent('examlab-role-change',{detail:{admin:confirmed}}));
    }catch(error){
      if(request!==serial)return;
      confirmed=false;
      root.dataset.examlabAdmin='no';
      for(const el of links)el.hidden=true;
      if(gate)gate.hidden=true;
      if(screen)message('Không xác minh được quyền Admin',String(error?.message||error),true);
      document.dispatchEvent(new CustomEvent('examlab-role-change',{detail:{admin:false}}));
    }
  }
  // Auth events can fire synchronously during token refresh; defer any Supabase query.
  if(window.ExamLabSupabase?.auth?.onAuthStateChange){
    window.ExamLabSupabase.auth.onAuthStateChange(()=>setTimeout(refresh,0));
  }
  refresh();
})();

