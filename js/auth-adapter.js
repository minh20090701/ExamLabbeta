
/* Tài khoản email cho ExamLab Khoa Bảng. Chế độ khách chỉ hoạt động cục bộ. */
(function(){
 'use strict';
 const GUEST_KEY='examlab.guest.supabase.v1';
 const listeners=new Set();
 const client=()=>{if(!window.ExamLabSupabase)throw Error(window.ExamLabSupabaseError||'Chưa có kết nối tài khoản.');return window.ExamLabSupabase};
 const nameOf=user=>String(user.user_metadata?.display_name||user.email?.split('@')[0]||'Sĩ tử').slice(0,32);
 const shape=user=>user?{kind:'supabase-account',id:user.id,name:nameOf(user),email:user.email,createdAt:user.created_at}:null;
 function guest(){try{const s=JSON.parse(localStorage.getItem(GUEST_KEY)||'null');return s?.kind==='guest'?s:null}catch{return null}}
 function notify(session){for(const cb of listeners){try{cb(session)}catch(e){console.error(e)}}}
 function emailOk(email){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||'').trim()))throw Error('Email không hợp lệ.')}
 function passwordOk(password){if(typeof password!=='string'||password.length<8)throw Error('Mật khẩu cần ít nhất 8 ký tự.')}
 window.ExamLabAuth={
   provider:'supabase',
   async getSession(){
     const {data,error}=await client().auth.getSession();if(error)throw error;return shape(data.session?.user)||guest();
   },
   onAuthStateChange(callback){
     listeners.add(callback);
     const {data}=client().auth.onAuthStateChange((_event,session)=>{
       // Tránh gọi API Supabase ngay trong callback xác thực.
       setTimeout(()=>notify(shape(session?.user)||guest()),0);
     });
     return ()=>{listeners.delete(callback);data.subscription.unsubscribe()};
   },
   async signUp(email,password,options={}){
     emailOk(email);passwordOk(password);const name=String(options.name||'').trim();
     if(name.length<2||name.length>32)throw Error('Tên hiển thị cần 2–32 ký tự.');
     const {data,error}=await client().auth.signUp({email:email.trim(),password,options:{
       data:{display_name:name},emailRedirectTo:new URL('login.html',location.href).href
     }});
     if(error)throw error;localStorage.removeItem(GUEST_KEY);
     return {needsEmailConfirmation:!data.session,session:shape(data.session?.user)};
   },
   async signIn(email,password){
     emailOk(email);passwordOk(password);
     const {data,error}=await client().auth.signInWithPassword({email:email.trim(),password});
     if(error)throw error;localStorage.removeItem(GUEST_KEY);
     return shape(data.user);
   },
   async resetPassword(email){
     emailOk(email);
     const {error}=await client().auth.resetPasswordForEmail(email.trim(),{redirectTo:new URL('reset.html',location.href).href});
     if(error)throw error;return true;
   },
   async updatePassword(password){passwordOk(password);const {error}=await client().auth.updateUser({password});if(error)throw error;return true},
   async continueAsGuest(alias='Sĩ tử'){
     const old=guest();const s={kind:'guest',id:old?.id||crypto.randomUUID(),name:String(alias||'Sĩ tử').trim().slice(0,32)||'Sĩ tử',createdAt:old?.createdAt||new Date().toISOString()};
     // Không tạo guest nếu tài khoản thật còn đăng nhập; đăng xuất Supabase trước.
     const {error}=await client().auth.signOut();if(error)throw error;
     localStorage.setItem(GUEST_KEY,JSON.stringify(s));notify(s);return s;
   },
   async signOut(){const {error}=await client().auth.signOut();if(error)throw error;localStorage.removeItem(GUEST_KEY);notify(null);return true}
 };
 window.addEventListener('storage',e=>{if(e.key===GUEST_KEY){window.ExamLabAuth.getSession().then(notify).catch(console.error)}});
})();

