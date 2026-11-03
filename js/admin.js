
/* ExamLab Khoa Bảng - local-first question bank administration (no pretend admin authentication). */
(()=>{
 'use strict';
 const FORMAT='examlab.quiz.v1';
 const SUBJECTS={toan:'Toán học',ly:'Vật lý',hoa:'Hóa học',sinh:'Sinh học'};
 const $=s=>document.querySelector(s);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const makeId=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
 const state={banks:[],selected:null,draft:null,selectedQ:-1,dirty:false,filter:'all',search:'',db:null,visibility:new Map()};
 let toastTimer;
 function toast(msg,error=false){const e=$('#adminToast');e.textContent=msg;e.className=error?'show error':'show';clearTimeout(toastTimer);toastTimer=setTimeout(()=>{e.className=''},4200)}
 function dbOpen(){return new Promise((res,rej)=>{const r=indexedDB.open('examlab-db',1);r.onupgradeneeded=()=>{for(const name of ['banks','attempts','drafts','meta'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
 function dbAction(op,value){return new Promise((res,rej)=>{const tx=state.db.transaction('banks','readwrite'),store=tx.objectStore('banks');let r=op==='all'?store.getAll():op==='save'?store.put(value):store.delete(value);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
 function normalize(raw){
  if(!raw||raw.format!==FORMAT)throw Error(`Sai định dạng (format phải là ${FORMAT})`);
  if(typeof raw.title!=='string'||!raw.title.trim())throw Error('Cần nhập tên bộ đề');
  if(!SUBJECTS[raw.subject])throw Error('Môn không hợp lệ');
  if(!Array.isArray(raw.questions)||!raw.questions.length||raw.questions.length>1500)throw Error('Đề cần từ 1 đến 1500 câu');
  const seen=new Set();
  const questions=raw.questions.map((q,i)=>{
   if(!q||typeof q!=='object')throw Error(`Câu ${i+1}: dữ liệu không hợp lệ`);
   const id=String(q.id??i+1),type=q.type||'short';
   if(seen.has(id))throw Error(`Câu ${i+1}: trùng mã câu`);seen.add(id);
   if(!['short','single','multiple'].includes(type))throw Error(`Câu ${i+1}: dạng câu không hợp lệ`);
   if(!String(q.text||'').trim()&&!String(q.contentHtml||'').trim())throw Error(`Câu ${i+1}: thiếu nội dung`);
   if(!String(q.explanation||'').trim())throw Error(`Câu ${i+1}: thiếu lời giải chi tiết`);
   let options;
   if(type!=='short'){
    if(!q.options||typeof q.options!=='object'||Array.isArray(q.options))throw Error(`Câu ${i+1}: thiếu lựa chọn`);
    options=Object.fromEntries(Object.entries(q.options).filter(([k,v])=>String(v||'').trim()).map(([k,v])=>[String(k),String(v)]));
    if(Object.keys(options).length<2)throw Error(`Câu ${i+1}: cần ít nhất 2 phương án`);
   }
   let answer;
   if(type==='multiple'){
    if(!Array.isArray(q.answer)||!q.answer.length)throw Error(`Câu ${i+1}: chọn ít nhất một đáp án`);
    answer=[...new Set(q.answer.map(String))];
    if(answer.some(k=>!(k in options)))throw Error(`Câu ${i+1}: đáp án không nằm trong lựa chọn`);
   }else{
    answer=String(q.answer??'').trim();
    if(!answer)throw Error(`Câu ${i+1}: thiếu đáp án`);
    if(type==='single'&&!(answer in options))throw Error(`Câu ${i+1}: đáp án không nằm trong lựa chọn`);
   }
   return {id,type,text:String(q.text||''),contentHtml:String(q.contentHtml||''),images:Array.isArray(q.images)?q.images.filter(x=>typeof x==='string'&&/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(x)&&x.length<=2800000):[],options,answer,aliases:type==='short'&&Array.isArray(q.aliases)?q.aliases.map(String):[],explanation:String(q.explanation||'')};
  });
  const duration=Math.round(Number(raw.durationMinutes)||60);
  if(duration<1||duration>300)throw Error('Thời gian làm bài phải từ 1 đến 300 phút');
  return {format:FORMAT,id:String(raw.id||makeId('de')),title:raw.title.trim().slice(0,150),subject:raw.subject,description:String(raw.description||'').slice(0,700),durationMinutes:duration,questions};
 }
 function refresh(){
  const banks=state.banks;
  $('#statBanks').textContent=banks.length;
  $('#statQuestions').textContent=banks.reduce((n,b)=>n+b.questions.length,0);
  $('#statDuration').textContent=banks.reduce((n,b)=>n+(Number(b.durationMinutes)||0),0);
  $('#statSubjects').textContent=new Set(banks.map(b=>b.subject)).size;
  const rows=banks.filter(b=>(state.filter==='all'||state.filter===b.subject)&&(`${b.title} ${b.description}`.toLowerCase().includes(state.search))).sort((a,b)=>a.title.localeCompare(b.title,'vi'));
  $('#bankList').innerHTML=rows.length?rows.map(b=>`<button type="button" class="admin-bank-row ${state.selected===b.id?'selected':''}" data-bank="${esc(b.id)}"><span class="bank-row-icon">${({toan:'∑',ly:'⚛',hoa:'⚗',sinh:'❀'})[b.subject]}</span><span class="bank-row-main"><b>${esc(b.title)}</b><small>${esc(SUBJECTS[b.subject])} · ${b.questions.length} câu · ${b.durationMinutes} phút · ${state.visibility.get(b.id)===false?'🔒 Đã ẩn':state.visibility.get(b.id)===true?'✓ Công khai':'◌ Chưa xuất bản'}</small></span><span class="bank-row-arrow">›</span></button>`).join(''):'<p class="admin-no-data">Chưa có bộ đề phù hợp. Bấm “Tạo đề” hoặc “Tải bộ đề lên” để bắt đầu.</p>';
  $('#publishNote').textContent=`${banks.length} bộ đề (${banks.reduce((n,b)=>n+b.questions.length,0)} câu) sẵn sàng xuất bản. Học sinh chỉ xem đáp án sau khi nộp bài.`;
 }
 async function ensureLeave(){return !state.dirty||await window.ExamLabDialog.confirm('Bạn có thay đổi chưa lưu trong bộ đề. Nếu tiếp tục, những thay đổi đó sẽ bị bỏ qua.',{title:'Bỏ thay đổi chưa lưu?',confirmText:'Bỏ thay đổi',danger:true})}
 async function selectBank(id){
  if(!(await ensureLeave()))return;
  const bank=state.banks.find(b=>b.id===id);if(!bank)return;
  state.selected=id;state.draft=structuredClone(bank);state.selectedQ=bank.questions.length?0:-1;state.dirty=false;
  renderEditor();refresh();
 }
 function markDirty(){state.dirty=true;$('#editStatus').textContent='● Có thay đổi chưa lưu';$('#editStatus').classList.add('unsaved');$('#editorHeadline').textContent=state.draft.title||'Đề chưa đặt tên';}
 function renderEditor(){
  const b=state.draft;
  $('#adminEmpty').hidden=!!b;$('#editorUI').hidden=!b;
  if(!b)return;
  $('#bankTitle').value=b.title;$('#bankSubject').value=b.subject;$('#bankDescription').value=b.description||'';$('#bankDuration').value=b.durationMinutes;
  const visible=state.visibility.get(b.id),toggle=$('#toggleBankVisibility');if(toggle){toggle.disabled=visible===undefined;toggle.textContent=visible===false?'👁 Hiện đề':visible===true?'🔒 Ẩn đề':'◌ Chưa xuất bản';toggle.title=visible===undefined?'Hãy xuất bản đề trước khi ẩn/hiện':'Đổi trạng thái công khai của đề trên Supabase';}
  $('#editorHeadline').textContent=b.title||'Đề mới';$('#editStatus').textContent=state.dirty?'● Có thay đổi chưa lưu':'✓ Đã lưu trên thiết bị';$('#editStatus').classList.toggle('unsaved',state.dirty);
  refreshQuestions();
 }
 function refreshQuestions(){
  const b=state.draft;if(!b)return;
  $('#questionCount').textContent=b.questions.length;
  $('#questionList').innerHTML=b.questions.length?b.questions.map((q,i)=>`<button type="button" class="question-list-row ${state.selectedQ===i?'current':''}" data-selectq="${i}"><span>${String(i+1).padStart(2,'0')}</span><b>${esc((q.text||q.contentHtml?.replace(/<[^>]*>/g,' ')||'Chưa nhập nội dung').slice(0,65))}</b><small>${q.type==='short'?'Điền đáp án':q.type==='single'?'Chọn một':'Chọn nhiều'}</small></button>`).join(''):'<p class="admin-no-data">Chưa có câu hỏi.</p>';
  renderQuestion();
 }
 function renderQuestion(){
  const b=state.draft,q=b?.questions[state.selectedQ],root=$('#questionDetails');
  if(!q){root.innerHTML='<div class="admin-empty inner"><span class="admin-empty-icon">✎</span><b>Chọn một câu bên trái</b><p>Nhập nội dung, đáp án và lời giải tại đây.</p></div>';return}
  const choice=q.type!=='short';
  const opts=['A','B','C','D'].map(k=>`<div class="option-edit-row"><label class="answer-picker" title="Chọn đáp án đúng"><input type="${q.type==='multiple'?'checkbox':'radio'}" name="correctOption" value="${k}" ${q.type==='multiple'?(Array.isArray(q.answer)&&q.answer.includes(k)?'checked':''):(q.answer===k?'checked':'')}></label><span class="option-letter">${k}</span><input type="text" class="option-value" data-option="${k}" placeholder="Phương án ${k}" value="${esc(q.options?.[k]||'')}"></div>`).join('');
  root.innerHTML=`<div class="question-detail-top"><span class="eyebrow">CÂU HỎI SỐ ${state.selectedQ+1}</span><div class="question-tools"><button class="btn btn-ghost btn-xs" data-qtool="up" title="Chuyển lên">↑</button><button class="btn btn-ghost btn-xs" data-qtool="down" title="Chuyển xuống">↓</button><button class="btn btn-ghost btn-xs" data-qtool="duplicate">Nhân bản</button><button class="btn btn-danger btn-xs" data-qtool="remove">Xóa</button></div></div>
   <label class="editor-field">Loại câu hỏi<select id="qType"><option value="short" ${q.type==='short'?'selected':''}>Điền đáp án ngắn</option><option value="single" ${q.type==='single'?'selected':''}>Trắc nghiệm · chọn một</option><option value="multiple" ${q.type==='multiple'?'selected':''}>Trắc nghiệm · chọn nhiều</option></select></label>
   <label class="editor-field">Nội dung câu hỏi <b>*</b><textarea id="qText" rows="5" placeholder="Nhập nội dung câu hỏi; có thể xuống dòng...">${esc(q.text)}</textarea></label>
   <details class="advanced-editor"><summary>Nội dung nâng cao: bảng / công thức HTML có sẵn</summary><p>Nếu điền, phần HTML được ưu tiên hiển thị trước văn bản. Hệ thống chỉ cho phép thẻ an toàn, không chạy mã JavaScript.</p><textarea id="qHtml" rows="4" placeholder="Dán phần HTML của công thức/bảng nếu cần">${esc(q.contentHtml||'')}</textarea></details>
   ${choice?`<div class="editor-field"><div class="field-heading">Các phương án <small>Đánh dấu phương án đúng bằng ô tròn/ô vuông</small></div><div class="options-editor">${opts}</div></div>`:`<label class="editor-field">Đáp án đúng <b>*</b><input id="qShortAnswer" type="text" value="${esc(q.answer||'')}" placeholder="Ví dụ: 42 hoặc 2,5"></label><label class="editor-field">Đáp án khác được chấp nhận (cách nhau bởi dấu chấm phẩy)<input id="qAliases" type="text" value="${esc((q.aliases||[]).join('; '))}" placeholder="Ví dụ: 2.5; 5/2"></label>`}
   <label class="editor-field">Lời giải chi tiết <b>*</b><textarea id="qExplanation" rows="5" placeholder="Giải thích lý do chọn đáp án, trình bày phép tính...">${esc(q.explanation||'')}</textarea></label>
   <div class="image-editor"><div class="field-heading">Hình minh họa <small>PNG/JPG/WebP/GIF, tối đa 1.5 MB mỗi ảnh</small></div><div class="uploaded-images">${(q.images||[]).filter(src=>typeof src==='string'&&/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(src)).map((src,i)=>`<div class="uploaded-image"><img src="${src}" alt="Hình minh họa ${i+1}"><button type="button" data-remove-image="${i}" aria-label="Xóa ảnh">×</button></div>`).join('')}</div><label class="btn btn-ghost btn-sm upload-image-label">＋ Thêm ảnh<input id="qImageInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden></label></div>
   <div class="question-footnote">✦ Đáp án và lời giải chỉ hiển thị cho người học sau khi nộp bài kiểm tra.</div>`;
 }
 async function addImages(input){const f=input.files?.[0];if(!f)return;if(!/^image\/(png|jpeg|webp|gif)$/.test(f.type)||f.size>1.5*1024*1024) return toast('Chỉ chọn ảnh PNG/JPG/WebP/GIF ≤ 1,5 MB',true);const src=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(f)});state.draft.questions[state.selectedQ].images.push(src);markDirty();renderQuestion();toast('Đã thêm hình minh họa')}
 function updateQuestionValue(target){const q=state.draft?.questions[state.selectedQ];if(!q)return;
  switch(target.id){case 'qText':q.text=target.value;break;case 'qHtml':q.contentHtml=target.value;break;case 'qShortAnswer':q.answer=target.value;break;case 'qAliases':q.aliases=target.value.split(';').map(s=>s.trim()).filter(Boolean);break;case 'qExplanation':q.explanation=target.value;break;default:if(target.dataset.option)q.options[target.dataset.option]=target.value;else return}
  markDirty();
 }
 function changeQuestionType(type){const q=state.draft.questions[state.selectedQ];q.type=type;q.options=type==='short'?undefined:(q.options||{A:'',B:'',C:'',D:''});q.answer=type==='short'?'':type==='multiple'?[]:'';q.aliases=[];markDirty();renderQuestion()}
 async function questionTool(action){let i=state.selectedQ;const arr=state.draft.questions;if(i<0)return;
  if(action==='remove'){if(!(await window.ExamLabDialog.confirm(`Câu ${i+1} sẽ bị xóa khỏi bộ đề đang soạn.`,{title:'Xóa câu hỏi',confirmText:'Xóa câu',danger:true})))return;arr.splice(i,1);state.selectedQ=Math.min(i,arr.length-1)}
  if(action==='duplicate'){const clone=structuredClone(arr[i]);clone.id=makeId('cau');arr.splice(i+1,0,clone);state.selectedQ=i+1}
  if(action==='up'&&i>0){[arr[i],arr[i-1]]=[arr[i-1],arr[i]];state.selectedQ=i-1}
  if(action==='down'&&i<arr.length-1){[arr[i],arr[i+1]]=[arr[i+1],arr[i]];state.selectedQ=i+1}
  markDirty();refreshQuestions();
 }
 function updateBankField(e){const b=state.draft;if(!b)return;const fields={bankTitle:'title',bankSubject:'subject',bankDescription:'description',bankDuration:'durationMinutes'};const key=fields[e.target.id];if(!key)return;b[key]=key==='durationMinutes'?Number(e.target.value):e.target.value;markDirty()}
 async function saveBank(){try{const b=normalize(state.draft);await dbAction('save',b);const i=state.banks.findIndex(v=>v.id===b.id);if(i<0)state.banks.push(b);else state.banks[i]=b;state.draft=structuredClone(b);state.selected=b.id;state.dirty=false;renderEditor();refresh();toast(`Đã lưu “${b.title}” · ${b.questions.length} câu`)}catch(e){toast(e.message,true)}}
 async function newBank(){if(!(await ensureLeave()))return;const b={format:FORMAT,id:makeId('de'),title:'',subject:'hoa',description:'',durationMinutes:60,questions:[]};state.draft=b;state.selected=b.id;state.selectedQ=-1;state.dirty=true;renderEditor();refresh();$('#bankTitle').focus()}
 async function deleteBank(){if(!state.draft)return;const b=state.draft;if(!(await window.ExamLabDialog.confirm(`Bộ đề “${b.title||'chưa đặt tên'}” sẽ bị xóa khỏi bộ nhớ thiết bị.`,{title:'Xóa bộ đề',confirmText:'Xóa bộ đề',danger:true})))return;await dbAction('remove',b.id);state.banks=state.banks.filter(x=>x.id!==b.id);state.draft=null;state.selected=null;state.selectedQ=-1;state.dirty=false;renderEditor();refresh();toast('Đã xóa bộ đề trên thiết bị')}
 function saveFile(text,name,type='application/json;charset=utf-8'){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)}
 function exportBank(){try{const b=normalize(state.draft);saveFile(JSON.stringify(b,null,2),`de-${b.subject}-${b.id}.json`);toast('Đã tải bộ đề')}catch(e){toast(e.message,true)}}
 async function readVisibilityStatuses(db){
   const {data,error}=await db.rpc('examlab_admin_deck_statuses');
   if(error)throw Error('Chưa cài SQL quản lý ẩn/hiện đề hoặc thiếu quyền Admin: '+error.message);
   return new Map((data||[]).map(r=>[String(r.deck_id),r.published===true]));
 }
 async function publish(){
  if(state.dirty){toast('Hãy lưu thay đổi trước khi phát hành.',true);return}
  try{
   const db=window.ExamLabSupabase;if(!db)throw Error(window.ExamLabSupabaseError||'Chưa kết nối hệ thống');
   // Lấy trực tiếp trạng thái Supabase để không vô tình hiện lại các đề đã ẩn.
   const statuses=await readVisibilityStatuses(db);state.visibility=statuses;
   const all=state.banks.map(normalize);
   if(!all.length)throw Error('Không có đề nào để phát hành.');
   let count=0,hiddenSkipped=0;
   for(const b of all){
    if(statuses.get(b.id)===false){hiddenSkipped++;continue}
    const {error}=await db.from('examlab_decks').upsert({id:b.id,title:b.title,subject:b.subject,payload:b,published:true,updated_at:new Date().toISOString()},{onConflict:'id'});
    if(error)throw error;count++;state.visibility.set(b.id,true);
   }
   refresh();renderEditor();
   toast(`Đã xuất bản ${count} bộ đề.${hiddenSkipped?' Giữ nguyên '+hiddenSkipped+' đề đang ẩn.':''}`);
  }catch(e){toast('Không phát hành được: '+e.message,true)}
 }
 async function toggleBankVisibility(){
  const bank=state.draft;if(!bank)return;
  if(state.dirty){toast('Hãy lưu thay đổi trên máy trước khi ẩn/hiện đề.',true);return}
  const before=state.visibility.get(bank.id);
  if(before===undefined){toast('Đề chưa được xuất bản lên Supabase.',true);return}
  const next=!before,button=$('#toggleBankVisibility');
  if(!(await window.ExamLabDialog.confirm(`${next?'Cho phép học sinh nhìn thấy':'Tạm ẩn với học sinh'} đề “${bank.title}”.\nNội dung đề và kết quả đã có được giữ nguyên.`,{title:next?'Hiện bộ đề':'Ẩn bộ đề',confirmText:next?'Hiện đề':'Ẩn đề'})))return;
  button.disabled=true;
  try{
   const db=window.ExamLabSupabase;if(!db)throw Error('Chưa kết nối Supabase');
   const {data,error}=await db.rpc('examlab_admin_set_deck_visibility',{p_deck_id:bank.id,p_visible:next});
   if(error)throw error;if(data!==true)throw Error('Không tìm thấy đề trên máy chủ');
   state.visibility.set(bank.id,next);refresh();renderEditor();
   toast(next?'Đã hiện đề. Học sinh tải lại trang để xem.':'Đã ẩn đề trên Supabase. Học sinh tải lại trang để đồng bộ.');
  }catch(e){toast('Không đổi được trạng thái: '+e.message,true);renderEditor()}
 }

 // Chế độ nhập hàng loạt: chỉ thao tác cục bộ. KHÔNG phát hành tự động.
 const IMPORT_MAX_FILE=50*1024*1024;
 const IMPORT_MAX_UNCOMPRESSED=65*1024*1024;
 const importState={entries:[],errors:[],skipped:[],busy:false};
 function isReviewOnlyName(path){return /(?:^|\/)BAN_NHAP_CAN_KIEM_TRA\//i.test(path)||/(?:^|\/)DANH_MUC(?:_DE)?\.json$/i.test(path)||/(?:^|\/)DANH_SACH_16_DE\.csv$/i.test(path)}
 function reviewFlag(raw){
   const note=String(raw?._reviewStatus||raw?.description||'');
   const pending=(raw?.questions||[]).filter(q=>/(?:chưa có trong tài liệu gốc|cần biên soạn|chưa kiểm chứng)/i.test(String(q?.explanation||''))).length;
   const warns=[];
   if(pending)warns.push(`${pending} câu chưa có lời giải chi tiết đã xác minh`);
   if(/(?:NEEDS_REVIEW|PARTIAL|NEEDS_EXPLANATIONS)/i.test(note))warns.push('Đề cần rà soát hình/công thức/đáp án');
   if(!warns.length && /cần đối chiếu PDF gốc/i.test(note))warns.push('Cần đối chiếu hình với PDF gốc');
   return warns;
 }
 async function scanQuiz(name,raw){
  const arrays=Array.isArray(raw)?raw:raw?.format==='examlab.published.v1'&&Array.isArray(raw.banks)?raw.banks:[raw];
  for(let i=0;i<arrays.length;i++){
   const r=arrays[i];
   try{
    const b=normalize(r);
    // Bảo vệ: không tự cập nhật dữ liệu đã xuất bản.
    const existing=state.banks.find(x=>x.id===b.id);
    importState.entries.push({name:name+(arrays.length>1?` #${i+1}`:''),bank:b,warnings:reviewFlag(r),existing:!!existing});
   }catch(e){importState.errors.push(`${name}${arrays.length>1?` #${i+1}`:''}: ${e.message}`)}
  }
 }
 async function scanFile(file){
   const name=String(file.name||'');
   if(file.size>IMPORT_MAX_FILE){importState.errors.push(`${name}: tệp lớn hơn 50 MB. Hãy dùng tệp đề nhỏ hơn.`);return}
   try{
     if(/\.json$/i.test(name)){
       const obj=JSON.parse(await file.text());await scanQuiz(name,obj);return;
     }
     if(!/\.zip$/i.test(name)){importState.errors.push(`${name}: định dạng tệp chưa được hỗ trợ`);return}
     if(!window.JSZip)throw Error('Không đọc được tệp nén. Vui lòng kiểm tra tệp hoặc tải lại trang');
     const zip=await window.JSZip.loadAsync(await file.arrayBuffer(),{checkCRC32:false});
     const entries=Object.values(zip.files).filter(v=>!v.dir && /\.json$/i.test(v.name));
     if(entries.length>250)throw Error('Gói đề có quá nhiều tệp (>250)');
     let sizeTotal=0;
     for(const item of entries){
       const path=item.name.replaceAll('\\','/');
       if(isReviewOnlyName(path)){importState.skipped.push(path+' (bản nháp / danh mục chưa dùng để chấm)');continue}
       const size=Number(item._data?.uncompressedSize)||0;
       if(size>IMPORT_MAX_UNCOMPRESSED){importState.errors.push(`${path}: nội dung quá lớn`);continue}
       sizeTotal+=size;
       if(sizeTotal>IMPORT_MAX_UNCOMPRESSED){importState.errors.push('Dung lượng giải nén vượt quá 65 MB');break}
       try{await scanQuiz(path,JSON.parse(await item.async('string')))}catch(e){importState.errors.push(`${path}: ${e.message}`)}
     }
     if(!entries.length)importState.errors.push(`${name}: không tìm thấy đề hợp lệ trong gói đã chọn`);
   }catch(e){importState.errors.push(`${name}: ${e.message}`)}
 }
 function renderImportModal(){
  const root=$('#adminImportModal');
  const list=importState.entries;
  const available=list.filter(e=>!e.existing).length;
  root.innerHTML=`<div class="admin-mask" data-bulk-mask="1"><div class="admin-dialog bulk-dialog" role="dialog" aria-modal="true" aria-label="Kiểm tra bộ đề trước khi nhập">
    <div class="dialog-head"><div><span class="eyebrow">QUẢN TRỊ · NHẬP ĐỀ</span><h2>Kiểm tra bộ đề trước khi nhập</h2><p>Đã nhận ${list.length} bộ đề hợp lệ. Chưa lưu hoặc xuất bản bất kỳ đề nào.</p></div><button type="button" class="btn btn-ghost btn-sm" id="bulkClose">✕ Đóng</button></div>
    <div class="bulk-info"><strong>ⓘ Lưu ý</strong> Đề được lưu trong trình duyệt của Admin để bạn rà soát. <b>Chỉ công khai khi bạn chọn xuất bản.</b> Các lời giải chưa xác minh vẫn cần hoàn thiện trước khi công khai.</div>
    <div class="bulk-actions"><button type="button" class="btn btn-ghost btn-sm" id="bulkAll">Chọn ${available} đề mới</button><label class="bulk-overwrite"><input id="bulkOverwrite" type="checkbox"> Cho phép cập nhật đề trùng mã (cẩn thận)</label></div>
    <div class="bulk-list">${list.map((x,i)=>`<label class="bulk-row"><input type="checkbox" class="bulk-check" data-bulk-index="${i}" ${x.existing?'disabled':'checked'}><span class="bulk-item"><strong>${esc(x.bank.title)}</strong><small>${esc(x.name)} · ${esc(SUBJECTS[x.bank.subject])} · ${x.bank.questions.length} câu · ${x.bank.durationMinutes} phút</small>${x.existing?'<small class="bulk-conflict">Đề đã tồn tại — mặc định không ghi đè</small>':''}${x.warnings.length?`<small class="bulk-warning">⚠ ${esc(x.warnings.join('; '))}</small>`:'<small class="bulk-ok">✓ Có đáp án và dữ liệu hợp lệ; vẫn cần tự kiểm tra PDF</small>'}</span></label>`).join('')||'<p>Không có đề hợp lệ để nhập.</p>'}</div>
    ${importState.skipped.length?`<details class="bulk-issues"><summary>Đã bỏ qua ${importState.skipped.length} tệp nháp / danh mục (không chấm tự động)</summary><p>${esc(importState.skipped.slice(0,20).join(' · '))}</p></details>`:''}
    ${importState.errors.length?`<details class="bulk-issues" open><summary>⚠ ${importState.errors.length} lỗi cấu trúc (chưa nhập)</summary><ul>${importState.errors.slice(0,20).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`:''}
    <div class="bulk-foot"><span id="bulkCount">${available} bộ đề được chọn</span><div><button type="button" class="btn btn-ghost" id="bulkCancel">Hủy</button><button type="button" class="btn btn-primary" id="bulkSave" ${list.length?'':'disabled'}>⇧ Lưu các đề đã chọn</button></div></div>
  </div></div>`;
  root.hidden=false;
  const check=[...root.querySelectorAll('.bulk-check')];
  function selectedCount(){const n=check.filter(x=>x.checked&&!x.disabled).length;root.querySelector('#bulkCount').textContent=`${n} bộ đề được chọn`;root.querySelector('#bulkSave').disabled=n===0}
  root.querySelector('#bulkClose').onclick=root.querySelector('#bulkCancel').onclick=()=>root.hidden=true;
  root.querySelector('#bulkAll').onclick=()=>{const isAll=check.filter(x=>!x.disabled).every(x=>x.checked);check.forEach(x=>{if(!x.disabled)x.checked=!isAll});selectedCount()};
  root.querySelector('#bulkOverwrite').onchange=e=>{check.forEach((el,i)=>{if(list[i].existing){el.disabled=!e.target.checked;el.checked=false}});selectedCount()};
  check.forEach(x=>x.addEventListener('change',selectedCount));
  root.querySelector('#bulkSave').onclick=async()=>{
    if(importState.busy)return;
    const selected=check.filter(x=>x.checked&&!x.disabled).map(x=>list[Number(x.dataset.bulkIndex)]);
    if(!selected.length)return;
    const overwrite=selected.filter(x=>x.existing);
    if(overwrite.length&&!(await window.ExamLabDialog.confirm(`${overwrite.length} bộ đề đang có trên thiết bị sẽ được thay thế bằng bản nhập mới.`,{title:'Ghi đè bộ đề?',confirmText:'Ghi đè',danger:true})))return;
    importState.busy=true;root.querySelector('#bulkSave').disabled=true;let count=0;const errors=[];
    for(const x of selected){
      try{await dbAction('save',x.bank);const i=state.banks.findIndex(b=>b.id===x.bank.id);if(i===-1)state.banks.push(x.bank);else state.banks[i]=x.bank;count++}
      catch(e){errors.push(`${x.bank.title}: ${e.message}`)}
    }
    importState.busy=false;root.hidden=true;refresh();
    toast(errors.length?`Đã lưu ${count} đề, ${errors.length} lỗi: ${errors[0]}`:`Đã lưu ${count} đề vào bản nháp Admin. Chưa xuất bản.`,!!errors.length);
    if(count&&!state.dirty){const bank=selected.find(x=>state.banks.some(b=>b.id===x.bank.id))?.bank;if(bank)selectBank(bank.id)}
  };
 }
 async function importFiles(files){
  if(!files?.length)return;
  if(state.dirty){toast('Vui lòng lưu đề đang chỉnh sửa trước khi nhập bộ đề mới.',true);return}
  if(!state.db){toast('Bạn cần đăng nhập Admin và kết nối cơ sở dữ liệu trước.',true);return}
  importState.entries=[];importState.errors=[];importState.skipped=[];
  $('#adminImportModal').hidden=false;
  $('#adminImportModal').innerHTML='<div class="admin-mask"><div class="admin-dialog bulk-dialog"><h2>Đang kiểm tra tệp đề...</h2><p>Đang kiểm tra nội dung và đáp án.</p></div></div>';
  for(const file of files)await scanFile(file);
  // Mỗi ID xuất hiện tối đa một lần trong một lượt nhập.
  const seen=new Set();importState.entries=importState.entries.filter(x=>{if(seen.has(x.bank.id)){importState.errors.push(`${x.name}: trùng mã bộ đề trong lượt nhập`);return false}seen.add(x.bank.id);return true});
  renderImportModal();
 }
 function previewHtml(raw){
  const doc=new DOMParser().parseFromString(String(raw||''),'text/html'),keep=new Set(['P','BR','B','STRONG','I','EM','U','SUB','SUP','H4','TABLE','THEAD','TBODY','TR','TH','TD','DIV','FIGURE','SPAN','IMG','CODE','UL','OL','LI']);
  const out=document.createElement('div');function add(n,parent){if(n.nodeType===Node.TEXT_NODE){parent.appendChild(document.createTextNode(n.nodeValue));return}if(n.nodeType!==Node.ELEMENT_NODE)return;const tag=n.tagName;if(['SCRIPT','STYLE','IFRAME','OBJECT','SVG','FORM','INPUT','BUTTON'].includes(tag))return;if(!keep.has(tag)){n.childNodes.forEach(c=>add(c,parent));return}const item=document.createElement(tag.toLowerCase());if(tag==='IMG'){const src=n.getAttribute('src')||'';if(!/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(src))return;item.setAttribute('src',src);item.setAttribute('alt','Hình minh họa')}else{n.childNodes.forEach(c=>add(c,item))}parent.appendChild(item)}doc.body.childNodes.forEach(n=>add(n,out));return out.innerHTML
 }
 function preview(){const b=state.draft;if(!b)return;const questions=b.questions;const html=questions.slice(0,8).map((q,i)=>`<article class="preview-question"><div class="eyebrow">CÂU ${i+1}</div><div class="preview-content">${q.contentHtml?previewHtml(q.contentHtml):`<p>${esc(q.text).replace(/\n/g,'<br>')}</p>${(q.images||[]).filter(src=>typeof src==='string'&&/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(src)).map(src=>`<img src="${src}" alt="Hình minh họa">`).join('')}`}</div>${q.type!=='short'?`<div class="preview-options">${Object.entries(q.options||{}).filter(([,v])=>String(v).trim()).map(([k,v])=>`<div>${esc(k)}. ${esc(v)}</div>`).join('')}</div>`:''}<div class="preview-key"><b>Đáp án:</b> ${esc(Array.isArray(q.answer)?q.answer.join(', '):q.answer)}<div><b>Lời giải:</b> ${esc(q.explanation)}</div></div></article>`).join('');
  $('#adminModal').innerHTML=`<div class="admin-mask" data-close-modal="true"><div class="admin-dialog" role="dialog" aria-modal="true" aria-label="Xem trước đề" data-dialog="true"><div class="dialog-head"><div><span class="eyebrow">CHẾ ĐỘ BIÊN SOẠN</span><h2>Xem trước: ${esc(b.title||'Đề chưa đặt tên')}</h2><p>${questions.length} câu · ${esc(SUBJECTS[b.subject])} · ${b.durationMinutes} phút</p></div><button class="btn btn-ghost btn-sm" data-close-modal="true">✕ Đóng</button></div><p class="admin-small">Đây là bản xem trước dành cho người soạn, nên có kèm đáp án và lời giải. Bài kiểm tra học sinh chỉ hiện sau khi nộp.</p>${html||'<p>Đề chưa có câu hỏi.</p>'}${questions.length>8?`<div class="admin-warning">Đang xem 8/${questions.length} câu đầu tiên để trang không quá dài.</div>`:''}</div></div>`;$('#adminModal').hidden=false;
 }
 function template(){const ex={format:FORMAT,id:'de-toan-mau',title:'Bài kiểm tra Toán – Mẫu',subject:'toan',description:'Ví dụ 3 loại câu hỏi',durationMinutes:45,questions:[{id:'1',type:'short',text:'2x + 6 = 14. Tìm x.',answer:'4',explanation:'2x = 14 − 6 = 8, suy ra x = 4.'},{id:'2',type:'single',text:'√81 bằng bao nhiêu?',options:{A:'7',B:'8',C:'9',D:'10'},answer:'C',explanation:'9² = 81, nên căn bậc hai số học của 81 bằng 9.'},{id:'3',type:'multiple',text:'Chọn các số nguyên tố.',options:{A:'2',B:'4',C:'5',D:'9'},answer:['A','C'],explanation:'2 và 5 là số nguyên tố; 4 và 9 là hợp số.'}]};saveFile(JSON.stringify(ex,null,2),'MAU_DE_ON_TAP.json')}
 let syncingCloud=false;
 function syncMessage(message){const el=$('#cloudSyncStatus');if(el)el.textContent=message}
 async function syncPublishedFromSupabase(){
  if(syncingCloud)return;
  if(!state.db){syncMessage('Chưa mở được dữ liệu cục bộ; không thể đồng bộ.');return}
  syncingCloud=true;const reload=$('#reloadPublished');if(reload)reload.disabled=true;
  syncMessage('Đang cập nhật thư viện đề…');
  try{
   const db=window.ExamLabSupabase;if(!db)throw Error('Chưa kết nối được dữ liệu.');
   const {data,error}=await db.from('examlab_decks').select('id,payload,published').order('updated_at',{ascending:false}).limit(500);
   if(error)throw error;
   state.visibility=await readVisibilityStatuses(db);
   let added=0,invalid=0,notSaved=0;
   for(const row of data||[]){
    try{
     const bank=normalize(row.payload);
     if(state.banks.some(x=>x.id===bank.id))continue; // Bảo toàn thay đổi cục bộ, không ghi đè.
     state.banks.push(bank);added++;
     try{await dbAction('save',bank)}catch(e){notSaved++;console.warn('Đề lấy từ máy chủ chưa lưu được trong IndexedDB',bank.id,e)}
    }catch(e){invalid++;console.warn('Dữ liệu đề từ Supabase không hợp lệ',e)}
   }
   refresh();renderEditor();
   syncMessage(`Đã tìm thấy ${(data||[]).length} bộ đề, cập nhật ${added} bộ vào thư viện.${invalid?' '+invalid+' bộ lỗi định dạng.':''}${notSaved?' '+notSaved+' bộ chỉ giữ trong phiên này vì thiếu dung lượng.':''}`);
  }catch(e){console.warn('Lỗi tải đề từ Supabase',e);syncMessage('Không tải được thư viện: '+String(e.message||e)+'. Không xóa đề cục bộ.');toast('Không đồng bộ được đề: '+(e.message||e),true)}
  finally{syncingCloud=false;if(reload)reload.disabled=false}
 }
 async function boot(){
  try{
   const access=await window.ExamLabAdminAccess.getAccess();
   if(!access.allowed)throw Error(access.message);
   state.db=await dbOpen();
   state.banks=await dbAction('all');
   refresh();renderEditor(); // Không đợi mạng trước khi hiện danh sách đề của máy.
   syncMessage(`Có ${state.banks.length} bộ đề trên máy. Đang cập nhật dữ liệu…`);
   await syncPublishedFromSupabase();
  }catch(e){
   toast('Không vào được Admin: '+e.message,true);
   syncMessage('Không xác minh được quyền quản trị hoặc bộ nhớ trình duyệt.');
   $('#bankList').innerHTML='<p class="admin-no-data">'+esc(e.message)+' · <a href="login.html">Đăng nhập</a></p>';
  }
 }
 $('#newBank').addEventListener('click',newBank);
 $('#saveBank').addEventListener('click',saveBank);
 $('#previewBank').addEventListener('click',preview);
 $('#deleteBank').addEventListener('click',deleteBank);
 $('#exportBank').addEventListener('click',exportBank);
 $('#publishBtn').addEventListener('click',publish);
 $('#toggleBankVisibility')?.addEventListener('click',toggleBankVisibility);
 $('#reloadPublished')?.addEventListener('click',syncPublishedFromSupabase);
 $('#addQuestion').addEventListener('click',()=>{if(!state.draft)return;state.draft.questions.push({id:makeId('cau'),type:'short',text:'',answer:'',explanation:'',aliases:[],images:[],contentHtml:''});state.selectedQ=state.draft.questions.length-1;markDirty();refreshQuestions();$('#qText')?.focus()});
 $('#importTrigger').addEventListener('click',()=>$('#adminFileInput').click());
 $('#adminFileInput').addEventListener('change',async e=>{await importFiles(e.target.files);e.target.value=''});
 $('#templateTrigger').addEventListener('click',template);
 $('#bankSearch').addEventListener('input',e=>{state.search=e.target.value.toLowerCase().trim();refresh()});
 $('#subjectFilter').addEventListener('change',e=>{state.filter=e.target.value;refresh()});
 $('#bankList').addEventListener('click',e=>{const row=e.target.closest('[data-bank]');if(row)selectBank(row.dataset.bank)});
 $('#questionList').addEventListener('click',e=>{const row=e.target.closest('[data-selectq]');if(row){state.selectedQ=Number(row.dataset.selectq);refreshQuestions()}});
 $('#editorUI').addEventListener('input',e=>{if(['bankTitle','bankSubject','bankDescription','bankDuration'].includes(e.target.id))updateBankField(e);else updateQuestionValue(e.target)});
 $('#editorUI').addEventListener('change',async e=>{const t=e.target,q=state.draft?.questions[state.selectedQ];if(!q)return;if(t.id==='qType')return changeQuestionType(t.value);if(t.id==='qImageInput')return addImages(t);if(t.name==='correctOption'){if(q.type==='multiple'){const s=new Set(Array.isArray(q.answer)?q.answer:[]);t.checked?s.add(t.value):s.delete(t.value);q.answer=[...s].sort()}else q.answer=t.value;markDirty()}});
 $('#questionDetails').addEventListener('click',e=>{const tool=e.target.closest('[data-qtool]');if(tool)questionTool(tool.dataset.qtool);const img=e.target.closest('[data-remove-image]');if(img){state.draft.questions[state.selectedQ].images.splice(Number(img.dataset.removeImage),1);markDirty();renderQuestion()}});
 $('#adminModal').addEventListener('click',e=>{if(e.target.hasAttribute('data-close-modal')&&!e.target.closest('[data-dialog]')){$('#adminModal').hidden=true;return}if(e.target.closest('button[data-close-modal]'))$('#adminModal').hidden=true});
 window.addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue=''}});
 boot();
})();

