
(function(){
 'use strict';
 const $=s=>document.querySelector(s),store=window.ExamLabDocumentsStore;
 const subject={toan:'Toán',ly:'Vật lý',hoa:'Hóa học',sinh:'Sinh học'};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let docs=[],filter='pending',to;
 function toast(s,error=false){const n=$('#docsToast');n.textContent=s;n.classList.toggle('is-error',error);n.classList.add('visible');clearTimeout(to);to=setTimeout(()=>n.classList.remove('visible'),3500)}
 async function reload(){docs=(await store.getAll()).filter(d=>d.visibility==='public').sort((a,b)=>b.createdAt.localeCompare(a.createdAt));render()}
 function render(){$('#statPending').textContent=docs.filter(d=>d.status==='pending').length;$('#statApproved').textContent=docs.filter(d=>d.status==='approved').length;$('#statRejected').textContent=docs.filter(d=>d.status==='rejected').length;
  const current=docs.filter(d=>filter==='all'||d.status===filter);$('#adminDocsRows').innerHTML=current.length?current.map(d=>`<tr>
  <td><span class="docs-title">${esc(d.title)}</span><small>${esc(d.filename)} · ${(d.bytes/1048576).toFixed(2)} MB</small><small style="display:block;margin-top:5px;max-width:280px;overflow-wrap:anywhere">${esc(d.description||'Không có mô tả')}</small></td>
  <td>${esc(subject[d.subject]||d.subject)}</td><td>${esc(d.ownerName)}</td><td>${new Date(d.createdAt).toLocaleDateString('vi-VN')}</td>
  <td><span class="docs-status ${esc(d.status)}">${d.status==='pending'?'⌛ Chờ duyệt':d.status==='approved'?'✓ Đã công khai':'✕ Từ chối'}</span></td>
  <td><div class="docs-admin-actions"><button class="btn btn-ghost" data-review="download" data-id="${esc(d.id)}">⇩ Tải kiểm tra</button>${d.status!=='approved'?`<button class="btn btn-primary" data-review="approve" data-id="${esc(d.id)}">Duyệt</button>`:''}${d.status!=='rejected'?`<button class="btn btn-ghost" data-review="reject" data-id="${esc(d.id)}">Từ chối</button>`:''}<button class="btn btn-danger" data-review="delete" data-id="${esc(d.id)}">Xóa</button></div></td>
  </tr>`).join(''):'<tr><td colspan="6"><div class="docs-admin-empty">Không có tài liệu ở trạng thái này.</div></td></tr>';
 }
 document.querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{filter=btn.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b===btn));render()}));
 document.addEventListener('click',async e=>{const b=e.target.closest('[data-review]');if(!b)return;const d=docs.find(x=>x.id===b.dataset.id);if(!d)return;try{if(b.dataset.review==='download'){const blob=await store.getFile(d.id);if(!blob)throw Error('File đã bị xóa khỏi bộ nhớ.');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=d.filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),90000);toast('Đã tải file để kiểm tra.');return;}if(b.dataset.review==='delete'){if(!(await window.ExamLabDialog.confirm('Tài liệu và tệp đính kèm sẽ bị xóa. Thao tác này không thể hoàn tác.',{title:'Xóa tài liệu',confirmText:'Xóa tài liệu',danger:true})))return;await store.remove(d.id);toast('Đã xóa tài liệu.')}
  else if(b.dataset.review==='approve'){await store.update(d.id,{status:'approved',reviewedAt:new Date().toISOString()});toast('Đã duyệt tài liệu công khai.')}
  else if(b.dataset.review==='reject'){await store.update(d.id,{status:'rejected',reviewedAt:new Date().toISOString()});toast('Đã từ chối tài liệu.')}await reload()}
  catch(err){console.error(err);toast('Không thể xử lý tài liệu: '+err.message,true)}});
 (async()=>{try{const access=await window.ExamLabAdminAccess.getAccess();if(!access.allowed)throw Error(access.message);await store.connect();await reload()}catch(e){toast('Không có quyền kiểm duyệt: '+e.message,true);document.getElementById('adminDocsRows').innerHTML='<tr><td colspan="6">Bạn cần đăng nhập bằng tài khoản quản trị. <a href="login.html">Đăng nhập</a></td></tr>'}})();
})();

