
(function(){
 'use strict';
 const $=s=>document.querySelector(s), store=window.ExamLabDocumentsStore;
 const SUBJECTS={toan:'Toán học',ly:'Vật lý',hoa:'Hóa học',sinh:'Sinh học'};
 const icons={pdf:'▧',doc:'▤',docx:'▤',ppt:'▥',pptx:'▥',xls:'▦',xlsx:'▦',txt:'☷',md:'☷',png:'▣',jpg:'▣',jpeg:'▣',webp:'▣'};
 const state={tab:'public',subject:'all',search:'',docs:[],session:null};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmtSize=n=>n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';
 const date=s=>new Date(s).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});
 const uid=()=>state.session?.id||null;
 let toastTimer;
 function toast(message,error=false){const el=$('#docsToast');el.textContent=message;el.classList.toggle('is-error',error);el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4400)}
 function badge(d){const types={private:['🔒 Riêng tư','private'],pending:['⌛ Chờ duyệt','pending'],approved:['🌐 Công khai','approved'],rejected:['✕ Bị từ chối','rejected']};const [text,cls]=types[d.status]||types.pending;return `<span class="docs-status ${cls}">${text}</span>`}
 function filtered(){const q=state.search.toLocaleLowerCase('vi');return state.docs.filter(d=>{
  const mine=!!uid()&&d.ownerId===uid(),pub=d.visibility==='public'&&d.status==='approved';
  if(state.tab==='mine'&&!mine)return false;if(state.tab==='public'&&!pub)return false;if(state.tab==='all'&&!mine&&!pub)return false;
  if(state.subject!=='all'&&d.subject!==state.subject)return false;
  if(q&&!(`${d.title} ${d.description} ${d.filename}`.toLocaleLowerCase('vi').includes(q)))return false;
  return true;
 }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
 function card(d){const mine=uid()===d.ownerId,owner=mine?'Bạn':d.ownerName;return `<article class="docs-card">
  <div class="docs-card-top"><div class="docs-file-type" aria-hidden="true">${icons[d.ext]||'▣'}</div><div class="docs-card-badges">${badge(d)}<span class="docs-subject">${esc(SUBJECTS[d.subject]||d.subject)}</span></div></div>
  <h3 title="${esc(d.title)}">${esc(d.title)}</h3><p class="docs-desc">${esc(d.description||'Tài liệu học tập do thành viên chia sẻ.')}</p>
  <div class="docs-info"><span>✎ ${esc(owner)}</span><span>◷ ${date(d.createdAt)}</span><span>⇩ ${fmtSize(d.bytes)}</span></div>
  ${d.status==='rejected'&&mine?'<p class="docs-reject">Tài liệu này chưa được duyệt. Bạn có thể sửa thông tin hoặc chuyển về riêng tư.</p>':''}
  <div class="docs-card-actions"><button class="btn btn-ghost btn-sm" data-doc="view" data-id="${esc(d.id)}">Xem thông tin</button><button class="btn btn-primary btn-sm" data-doc="download" data-id="${esc(d.id)}">⇩ Tải xuống</button></div>
 </article>`}
 function render(){const docs=filtered();$('#docsGrid').innerHTML=docs.length?docs.map(card).join(''):`<div class="docs-empty"><div>▤</div><h3>${state.tab==='mine'?'Tủ sách riêng còn trống':'Chưa có tài liệu phù hợp'}</h3><p>${state.tab==='mine'?'Bạn có thể tải tài liệu của mình lên và chọn chế độ riêng tư hoặc công khai.':'Thử đổi bộ lọc hoặc quay lại sau khi có tài liệu công khai được duyệt.'}</p></div>`;
  $('#statPublic').textContent=state.docs.filter(d=>d.status==='approved'&&d.visibility==='public').length;
  $('#statMine').textContent=state.docs.filter(d=>uid()&&d.ownerId===uid()).length;
  $('#statPending').textContent=state.docs.filter(d=>uid()&&d.ownerId===uid()&&d.status==='pending').length;
 }
 async function reload(){state.docs=await store.getAll();render()}
 function openDialog(){if(state.session?.kind!=='supabase-account'){toast('Hãy đăng nhập tài khoản email để đăng tài liệu.',true);return}$('#docsUploadForm').hidden=false;$('#docsDialogContent').hidden=true;$('#dialogTitle').textContent='Đăng tài liệu';$('#docsUploadForm').reset();$('#fileLabel').textContent='Chọn hoặc thả file tài liệu';$('#docsOverlay').hidden=false;document.body.style.overflow='hidden';$('#docTitle').focus()}
 function closeDialog(){$('#docsOverlay').hidden=true;document.body.style.overflow='';}
 function showDetails(id){const d=state.docs.find(x=>x.id===id),mine=d?.ownerId===uid();if(!d||(!mine&&!(d.visibility==='public'&&d.status==='approved'))){toast('Không tìm thấy tài liệu có thể truy cập.',true);return}
  $('#docsUploadForm').hidden=true;$('#docsDialogContent').hidden=false;$('#dialogTitle').textContent='Thông tin tài liệu';$('#docsDialogContent').innerHTML=`<div class="docs-detail">
  <div class="docs-detail-icon">${icons[d.ext]||'▣'}</div><h3>${esc(d.title)}</h3>${badge(d)}
  <p>${esc(d.description||'Không có mô tả.')}</p><dl><div><dt>Môn học</dt><dd>${esc(SUBJECTS[d.subject])}</dd></div><div><dt>Người đăng</dt><dd>${esc(d.ownerName)}</dd></div><div><dt>Tên file</dt><dd class="breakable">${esc(d.filename)}</dd></div><div><dt>Dung lượng</dt><dd>${fmtSize(d.bytes)}</dd></div><div><dt>Ngày đăng</dt><dd>${date(d.createdAt)}</dd></div></dl>
  <div class="docs-detail-buttons"><button class="btn btn-primary" data-doc="download" data-id="${esc(id)}">⇩ Tải file</button>${['pdf','png','jpg','jpeg','webp','txt','md'].includes(d.ext)?`<button class="btn btn-ghost" data-doc="preview" data-id="${esc(id)}">◉ Xem file</button>`:''}</div>
  ${mine?`<hr><h4>Quản lý tài liệu của tôi</h4><div class="docs-manage-actions">${d.visibility==='private'?`<button class="btn btn-ghost" data-doc="publish" data-id="${esc(id)}">🌐 Gửi duyệt công khai</button>`:`<button class="btn btn-ghost" data-doc="private" data-id="${esc(id)}">🔒 Chuyển sang riêng tư</button>`}<button class="btn btn-danger" data-doc="delete" data-id="${esc(id)}">Xóa tài liệu</button></div><p class="docs-fineprint">Đổi sang công khai sẽ đưa tài liệu về trạng thái chờ duyệt.</p>`:''}</div>`;
  $('#docsOverlay').hidden=false;document.body.style.overflow='hidden';$('#docsClose').focus();
 }
 async function handleUpload(ev){ev.preventDefault();const form=ev.currentTarget,file=$('#docFile').files?.[0];if(state.session?.kind!=='supabase-account'){toast('Bạn cần đăng nhập tài khoản email trước khi tải tài liệu lên.',true);return}const title=$('#docTitle').value.trim();if(!title){toast('Vui lòng nhập tên tài liệu.',true);return}if(!file){toast('Chưa chọn file tài liệu.',true);return}const btn=$('#saveDocBtn');try{store.checkFile(file);btn.disabled=true;btn.textContent='Đang lưu...';await store.create({title,subject:$('#docSubject').value,description:$('#docDescription').value.trim(),visibility:$('#docVisibility').value,ownerId:uid(),ownerName:state.session?.name||'Sĩ tử'},file);closeDialog();state.tab='mine';document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab==='mine'));await reload();toast('Đã lưu tài liệu'+($('#docVisibility').value==='public'?' và gửi chờ duyệt.':'.'))}catch(e){console.error(e);toast(e.message||'Không thể lưu. Thử file nhỏ hơn hoặc kiểm tra dung lượng trống.',true)}finally{btn.disabled=false;btn.textContent='Lưu tài liệu'}}
 async function downloadDoc(id,preview=false){const d=state.docs.find(x=>x.id===id);if(!d)return;const mine=uid()===d.ownerId;if(!mine&&!(d.visibility==='public'&&d.status==='approved')){toast('Bạn không có quyền xem tài liệu này.',true);return}const blob=await store.getFile(id);if(!blob){toast('Không tải được file từ Supabase.',true);return}
  if(preview&&['txt','md'].includes(d.ext)){const content=(await blob.text()).slice(0,500000);$('#docsUploadForm').hidden=true;$('#docsDialogContent').hidden=false;$('#dialogTitle').textContent=d.title;const pre=document.createElement('pre');pre.className='docs-pre';pre.textContent=content;$('#docsDialogContent').replaceChildren(pre);$('#docsOverlay').hidden=false;document.body.style.overflow='hidden';return}
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.rel='noopener';if(preview){a.target='_blank'}else{a.download=d.filename}document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),90000);
 }
 async function changeVisibility(id,value){const d=state.docs.find(x=>x.id===id);if(!d||d.ownerId!==uid())throw Error('Chỉ người đăng mới được đổi quyền xem.');await store.update(id,{visibility:value,status:value==='public'?'pending':'private',reviewedAt:null});closeDialog();await reload();toast(value==='public'?'Đã gửi tài liệu chờ Admin duyệt.':'Đã chuyển tài liệu về riêng tư.')}
 async function deleteDoc(id){const d=state.docs.find(x=>x.id===id);if(!d||d.ownerId!==uid())throw Error('Chỉ người đăng mới được xóa tài liệu.');if(!(await window.ExamLabDialog.confirm('Tài liệu và tệp đính kèm sẽ bị xóa khỏi tài khoản của bạn. Bạn muốn tiếp tục?',{title:'Xóa tài liệu',confirmText:'Xóa tài liệu',danger:true})))return;await store.remove(id);closeDialog();await reload();toast('Đã xóa tài liệu.')}
 $('#uploadBtn').addEventListener('click',openDialog);$('#docsClose').addEventListener('click',closeDialog);$('#cancelUpload').addEventListener('click',closeDialog);
 $('#docsOverlay').addEventListener('click',e=>{if(e.target.id==='docsOverlay')closeDialog()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#docsOverlay').hidden)closeDialog()});
 document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',b===x));render()}));
 $('#docsSubject').addEventListener('change',e=>{state.subject=e.target.value;render()});$('#docsSearch').addEventListener('input',e=>{state.search=e.target.value.trim();render()});
 $('#docFile').addEventListener('change',e=>{$('#fileLabel').textContent=e.target.files?.[0]?.name||'Chọn hoặc thả file tài liệu'});
 $('#fileDrop').addEventListener('dragover',e=>{e.preventDefault();e.currentTarget.classList.add('dragover')});$('#fileDrop').addEventListener('dragleave',e=>e.currentTarget.classList.remove('dragover'));
 $('#fileDrop').addEventListener('drop',e=>{e.preventDefault();e.currentTarget.classList.remove('dragover');const f=e.dataTransfer.files?.[0];if(!f)return;const dt=new DataTransfer();dt.items.add(f);$('#docFile').files=dt.files;$('#fileLabel').textContent=f.name});
 $('#docsUploadForm').addEventListener('submit',handleUpload);
 document.addEventListener('click',async e=>{const btn=e.target.closest('[data-doc]');if(!btn)return;try{const id=btn.dataset.id;switch(btn.dataset.doc){case 'view':showDetails(id);break;case 'download':await downloadDoc(id);break;case 'preview':await downloadDoc(id,true);break;case 'publish':await changeVisibility(id,'public');break;case 'private':await changeVisibility(id,'private');break;case 'delete':await deleteDoc(id);break;}}catch(err){console.error(err);toast(err.message||'Có lỗi xảy ra.',true)}});
 async function init(){try{await store.connect();state.session=await window.ExamLabAuth.getSession();window.ExamLabAuth.onAuthStateChange(async next=>{state.session=next;try{await reload()}catch(err){toast(err.message,true)}});await reload()}catch(e){console.error(e);toast('Không thể kết nối thư viện Supabase.',true)}}init();
})();

