
/* Thư viện ExamLab trực tuyến: Supabase PostgreSQL + private Storage + RLS. */
(function(){
 'use strict';
 const LIMIT=20*1024*1024;
 const TYPES={pdf:'application/pdf',doc:'application/octet-stream',docx:'application/octet-stream',ppt:'application/octet-stream',pptx:'application/octet-stream',xls:'application/octet-stream',xlsx:'application/octet-stream',txt:'text/plain',md:'text/plain',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
 const bucket='examlab-materials';
 const client=()=>{const db=window.ExamLabSupabase;if(!db)throw Error(window.ExamLabSupabaseError||'Chưa thiết lập kết nối');return db};
 async function user(){const {data,error}=await client().auth.getUser();if(error)throw error;return data.user}
 function mapDoc(d){return {id:d.id,title:d.title,subject:d.subject,description:d.description||'',visibility:d.visibility,status:d.review_status,ownerId:d.owner_id,ownerName:d.owner_name||'Thành viên',filename:d.filename,bytes:Number(d.file_bytes),ext:d.filename.split('.').pop().toLowerCase(),storagePath:d.storage_path,createdAt:d.created_at,updatedAt:d.updated_at,reviewedAt:d.reviewed_at}}
 function checkFile(file){if(!file)throw Error('Chưa chọn file');const ext=(file.name.split('.').pop()||'').toLowerCase();if(!TYPES[ext])throw Error('Định dạng không được hỗ trợ');if(file.size===0||file.size>LIMIT)throw Error('File phải lớn hơn 0 và tối đa 20 MB');return {ext,mime:TYPES[ext]}}
 async function connect(){client();return true}
 async function getAll(){const {data,error}=await client().from('examlab_materials').select('*').order('created_at',{ascending:false}).limit(500);if(error)throw error;return (data||[]).map(mapDoc)}
 async function getDoc(id){const {data,error}=await client().from('examlab_materials').select('*').eq('id',id).maybeSingle();if(error)throw error;if(!data)throw Error('Không tìm thấy hoặc không có quyền xem tài liệu.');return data}
 async function getFile(id){const doc=await getDoc(id);const {data,error}=await client().storage.from(bucket).download(doc.storage_path);if(error)throw error;return data}
 async function create(data,file){const db=client(),me=await user();if(!me)throw Error('Đăng nhập bằng tài khoản thật để tải tài liệu lên.');const {ext,mime}=checkFile(file);
   const id=crypto.randomUUID(),path=`${me.id}/${id}.${ext}`;
   const {error:uploadError}=await db.storage.from(bucket).upload(path,file,{contentType:mime,upsert:false});if(uploadError)throw uploadError;
   const row={owner_id:me.id,owner_name:String(data.ownerName||me.user_metadata?.display_name||'Thành viên').slice(0,40),title:String(data.title||'').trim().slice(0,140),description:String(data.description||'').slice(0,1200),subject:data.subject,visibility:data.visibility,filename:file.name.slice(0,180),storage_path:path,file_bytes:file.size,mime};
   const {data:created,error}=await db.from('examlab_materials').insert(row).select('*').single();
   if(error){try{await db.storage.from(bucket).remove([path])}catch{}throw error}return mapDoc(created);
 }
 async function update(id,changes){const db=client();const delta={};if(changes.visibility)delta.visibility=changes.visibility;if(changes.status)delta.review_status=changes.status;if(changes.title!==undefined)delta.title=String(changes.title).slice(0,140);if(changes.description!==undefined)delta.description=String(changes.description).slice(0,1200);
   const {data,error}=await db.from('examlab_materials').update(delta).eq('id',id).select('*').single();if(error)throw error;return mapDoc(data);
 }
 async function remove(id){const db=client(),doc=await getDoc(id);
   const {error:e}=await db.storage.from(bucket).remove([doc.storage_path]);if(e)throw e;
   const {error}=await db.from('examlab_materials').delete().eq('id',id);if(error)throw error;
   return true;
 }
 window.ExamLabDocumentsStore={mode:'supabase',maxBytes:LIMIT,connect,getAll,getFile,checkFile,create,update,remove};
})();

