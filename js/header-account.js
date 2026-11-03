
(function(){
'use strict';
const label=document.getElementById('accountLabel');
const badge=document.querySelector('.account-mark');
if(!label||!window.ExamLabAuth)return;
const refresh=async()=>{const s=await window.ExamLabAuth.getSession();label.textContent=s?.name||'Đăng nhập';if(badge)badge.textContent=s?(String(s.name||'H').charAt(0).toLocaleUpperCase('vi-VN')):'✦';const link=document.querySelector('.profile-top-link');if(link)link.href=s?.kind==='supabase-account'?'profile.html':'login.html'};
refresh();window.ExamLabAuth.onAuthStateChange(refresh);
})();

