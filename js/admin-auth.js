
/* Quyền Admin xác minh trên Supabase, KHÔNG lấy từ localStorage. */
window.ExamLabAdminAccess={
 mode:'supabase-rls',
 async getAccess(){
   const db=window.ExamLabSupabase;if(!db)throw Error(window.ExamLabSupabaseError||'Chưa kết nối hệ thống');
   const {data:{user},error:authError}=await db.auth.getUser();
   if(authError||!user)return {allowed:false,message:'Bạn cần đăng nhập trước khi truy cập Admin.'};
   const {data,error}=await db.from('examlab_material_admins').select('user_id').eq('user_id',user.id).maybeSingle();
   if(error)throw error;return {allowed:!!data,mode:'supabase-rls',message:data?'Quyền Admin đã xác minh.':'Tài khoản chưa được cấp quyền quản trị.'};
 }
};

