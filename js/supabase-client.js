
/* Supabase client dùng chung cho ExamLab, chỉ dùng publishable key. */
(function(){
 'use strict';
 const c=window.EXAMLAB_SUPABASE_CONFIG||{};
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(c.url||'') || !/^(sb_publishable_|eyJ)/.test(c.publishableKey||'')){
   window.ExamLabSupabase=null;
   window.ExamLabSupabaseError='Chưa thiết lập kết nối tài khoản.';
   return;
 }
 if(typeof window.supabase?.createClient!=='function'){
   window.ExamLabSupabase=null;
   window.ExamLabSupabaseError='Không tải được dịch vụ đăng nhập. Hãy kiểm tra kết nối mạng.';
   return;
 }
 window.ExamLabSupabase=window.supabase.createClient(c.url.replace(/\/$/,''),c.publishableKey,{
   auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
 });
})();

