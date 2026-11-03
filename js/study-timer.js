/* ExamLab V15 · Stopwatch, Pomodoro and personal Supabase study history sync (RLS). */
(async function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const makeId=()=>typeof crypto!== 'undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
 let toastHandle;
 function toast(message){const el=$('studyToast');el.textContent=message;el.classList.add('show');clearTimeout(toastHandle);toastHandle=setTimeout(()=>el.classList.remove('show'),3500)}
 let identity='guest';
 try{
  const db=window.ExamLabSupabase;
  if(db){const {data}=await db.auth.getSession();if(data?.session?.user?.id)identity=data.session.user.id;}
 }catch(e){console.warn('Không tải được phiên tài khoản cho đồng hồ',e)}
 const TIMER_STORAGE='examlab.study.timer.v9:'+identity;
 const STUDY_HISTORY_KEY='examlab.study.history.v9:'+identity;

  const TIMER_FOCUS_OPTIONS=[15,25,45,50];
  const TIMER_BREAK_OPTIONS=[5,10,15];
  const defaultTimer=()=>({mode:'stopwatch',phase:'focus',elapsedMs:0,startedAt:0,running:false,focusMin:25,breakMin:5,completed:0,sessionStartedOn:0,sessionRecorded:false,subject:''});
  let studyTimer=defaultTimer();
  function persistTimer() {
    try {localStorage.setItem(TIMER_STORAGE,JSON.stringify(studyTimer));} catch (_) { /* bộ nhớ đầy */ }
  }
  function readTimer() {
    try {
      const raw=JSON.parse(localStorage.getItem(TIMER_STORAGE)||'null');
      if (raw && typeof raw==='object') {
        studyTimer={mode:['stopwatch','focus'].includes(raw.mode)?raw.mode:'stopwatch',
          phase:raw.phase==='break'?'break':'focus',
          elapsedMs:Number.isFinite(raw.elapsedMs)?Math.max(0,Math.min(raw.elapsedMs,1e12)):0,
          startedAt:Number.isFinite(raw.startedAt)?Math.max(0,raw.startedAt):0,
          running:raw.running===true && Number.isFinite(raw.startedAt) && raw.startedAt>0,
          focusMin:TIMER_FOCUS_OPTIONS.includes(raw.focusMin)?raw.focusMin:25,
          breakMin:TIMER_BREAK_OPTIONS.includes(raw.breakMin)?raw.breakMin:5,
          completed:Number.isInteger(raw.completed)?Math.max(0,Math.min(raw.completed,999999)):0,
          sessionStartedOn:Number.isFinite(raw.sessionStartedOn)?Math.max(0,raw.sessionStartedOn):0,
          sessionRecorded:raw.sessionRecorded===true, subject:typeof raw.subject==='string'?raw.subject.slice(0,75):''};
      }
    } catch (_) {studyTimer=defaultTimer();}
    $('timerFocusMinutes').value=String(studyTimer.focusMin);
    $('timerBreakMinutes').value=String(studyTimer.breakMin);
    $('timerSubject').value=studyTimer.subject;
  }
  function currentTimerElapsed(){return studyTimer.elapsedMs+(studyTimer.running?Math.max(0,Date.now()-studyTimer.startedAt):0);}
  function timerFormat(ms,withHours) {
    const seconds=Math.max(0,Math.floor(ms/1000));
    const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60;
    return (withHours?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }

  // V9: history is separate from the running timer, and survives app restarts.

  let studyHistory=[];
  try {
    const rows=JSON.parse(localStorage.getItem(STUDY_HISTORY_KEY)||'[]');
    if(Array.isArray(rows)) studyHistory=rows.filter(item=>item && Number.isFinite(item.durationMs) && item.durationMs>0 && Number.isFinite(item.at)).slice(0,500);
  } catch (_) {studyHistory=[];}
  // Sync is an optional account feature. The running stopwatch stays device-local.
  // Only completed/saved sessions travel to Supabase; unsigned guests remain local.
  const cloud=window.ExamLabSupabase;
  const cloudEnabled=!!cloud && identity!=='guest';
  const STUDY_TABLE='examlab_study_sessions';
  const PENDING_KEY='examlab.study.pending.v10:'+identity;
  const IMPORT_KEY='examlab.study.imported.v10:'+identity;
  const IMPORT15_KEY='examlab.study.migrated.v15:'+identity;
  const BACKUP_KEY='examlab.study.history.backup.v15:'+identity;
  let pending={clear:false,upserts:{},deletes:[]};
  try{
    const saved=JSON.parse(localStorage.getItem(PENDING_KEY)||'null');
    if(saved && typeof saved==='object')pending={
      clear:saved.clear===true,clearToken:saved.clearToken||'v10',
      upserts:saved.upserts && typeof saved.upserts==='object'&&!Array.isArray(saved.upserts)?saved.upserts:{},
      deletes:Array.isArray(saved.deletes)?saved.deletes.filter(id=>typeof id==='string'):[]
    };
  }catch(_){/* Empty sync queue. */}
  const syncStatus=$('studySyncStatus'),syncButton=$('studySyncNow'),loginLink=$('studyLoginLink');
  let syncing=false,syncTimer=null, syncRetryAt=0;
  let syncLastSuccess=0;
  function showSyncStatus(message, state='info'){
    if(syncStatus){syncStatus.textContent=message;syncStatus.dataset.state=state;}
    if(syncButton){syncButton.disabled=syncing||!cloudEnabled;syncButton.setAttribute('aria-busy',syncing?'true':'false');}
  }
  function savePending(){try{localStorage.setItem(PENDING_KEY,JSON.stringify(pending));}catch(e){console.warn('Không lưu được hàng đợi đồng bộ',e)}}
  function hasPending(){return pending.clear||pending.deletes.length>0||Object.keys(pending.upserts).length>0;}
  function planSync(delay=250){if(!cloudEnabled)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncStudyHistory(),delay)}
  function queueSession(item){
    if(!cloudEnabled){showSyncStatus('Đã lưu tại thiết bị · Đăng nhập để đồng bộ.','offline');return;}
    pending.upserts[item.id]=item;
    pending.deletes=pending.deletes.filter(id=>id!==item.id);
    savePending();showSyncStatus('Đã lưu trên thiết bị · Đang chờ đồng bộ…','pending');planSync();
  }
  function queueRemoval(id){
    if(!cloudEnabled){showSyncStatus('Đã xóa khỏi thiết bị này.','offline');return;}
    delete pending.upserts[id];
    if(!pending.clear&&!pending.deletes.includes(id))pending.deletes.push(id);
    savePending();showSyncStatus('Đã xóa trên thiết bị · Đang cập nhật Supabase…','pending');planSync();
  }
  function queueClear(){
    if(!cloudEnabled){showSyncStatus('Đã xóa lịch sử trên thiết bị này.','offline');return;}
    pending={clear:true,clearToken:Date.now()+'-'+Math.random().toString(36).slice(2),upserts:{},deletes:[]};
    savePending();showSyncStatus('Đang chờ xóa lịch sử trên Supabase…','pending');planSync();
  }
  function validSession(item){
    return item&&typeof item.id==='string'&&item.id.length>0&&item.id.length<=120&&
      Number.isFinite(item.at)&&item.at>0&&Number.isFinite(item.durationMs)&&item.durationMs>=1000&&
      item.durationMs<=86400000&&['focus','stopwatch'].includes(item.mode);
  }
  function toCloudRow(item){return {
    user_id:identity,id:String(item.id).slice(0,120),
    study_at:new Date(item.at).toISOString(),
    started_at:Number.isFinite(item.startedAt)&&item.startedAt>0?new Date(item.startedAt).toISOString():null,
    duration_ms:Math.round(item.durationMs),mode:item.mode,
    subject:String(item.subject||'').slice(0,75),complete:item.complete===true
  }}
  function fromCloudRow(row){return {
    id:String(row.id),at:Date.parse(row.study_at),
    startedAt:row.started_at?Date.parse(row.started_at):Date.parse(row.study_at)-Number(row.duration_ms),
    durationMs:Number(row.duration_ms),mode:row.mode,subject:row.subject||'',complete:row.complete===true
  }}
  // V15 repairs an accidental V9->V14 regression: the UI was shipped with
  // the old offline-only controller. Preserve all local V9/V14 sessions once,
  // even when a previous V10 migration flag exists. Back up before cloud merge.
  if(cloudEnabled){
    let imported15=false;
    try{imported15=localStorage.getItem(IMPORT15_KEY)==='done'}catch(_){}
    if(!imported15){
      try { if(!localStorage.getItem(BACKUP_KEY))
        localStorage.setItem(BACKUP_KEY,JSON.stringify(studyHistory)); }catch(_){}
      if(!pending.clear){
        for(const item of studyHistory){
          if(validSession(item) && !pending.deletes.includes(item.id) && !pending.upserts[item.id])
            pending.upserts[item.id]=item;
        }
      }
      const queuedOk=savePending();
      // Mark migration only after queued changes are safely saved locally.
      // The queue persists through offline time, reload, and server errors.
      if(queuedOk)try{localStorage.setItem(IMPORT15_KEY,'done')}catch(_){}
    }
  }
  // Guest history belongs to this browser, not automatically to any account.
  // It can be imported explicitly after signing in, avoiding accidental mixing.
  const guestImportButton=document.createElement('button');
  guestImportButton.type='button';
  guestImportButton.className='study-guest-import';
  guestImportButton.textContent='Nhập lịch sử học cũ trên máy';
  guestImportButton.hidden=true;
  if(syncButton?.parentNode)syncButton.parentNode.appendChild(guestImportButton);
  let guestRows=[];
  if(cloudEnabled){try{
    const rows=JSON.parse(localStorage.getItem('examlab.study.history.v9:guest')||'[]');
    if(Array.isArray(rows))guestRows=rows.filter(validSession);
  }catch(_){}}
  if(guestRows.length)guestImportButton.hidden=false;
  guestImportButton.addEventListener('click',async()=>{
    if(!cloudEnabled || !guestRows.length)return;
    const ok=await (window.ExamLabDialog?.confirm?.(
      `Có ${guestRows.length} phiên học đã lưu khi chưa đăng nhập trên thiết bị này. Bạn muốn nhập chúng vào tài khoản hiện tại?`,
      {title:'Nhập lịch sử học cũ',confirmText:'Nhập lịch sử'}
    ) ?? Promise.resolve(window.confirm('Nhập lịch sử học cũ vào tài khoản này?')));
    if(!ok)return;
    const currentIds=new Set(studyHistory.map(row=>row.id));
    let added=0;
    for(const row of guestRows){
      if(currentIds.has(row.id))continue;
      studyHistory.push({...row});
      queueSession(row);currentIds.add(row.id);added++;
    }
    studyHistory.sort((a,b)=>b.at-a.at);
    studyHistory=studyHistory.slice(0,500);
    persistStudyHistory();renderStudyHistory();
    guestImportButton.hidden=true;
    if(added)toast(`Đã nhập ${added} phiên học; đang chờ đồng bộ.`);
    else toast('Các phiên học này đã có trong tài khoản.');
    planSync(200);
  });
  async function syncStudyHistory(manual=false){
    if(!cloudEnabled){showSyncStatus('Chưa đăng nhập · Lịch sử chỉ lưu trên thiết bị này.');return;}
    if(syncing)return;
    if(typeof navigator!=='undefined' && navigator.onLine===false){showSyncStatus('Ngoại tuyến · Lịch sử vẫn an toàn trên thiết bị; sẽ tự đồng bộ khi có mạng.','offline');return;}
    const now=Date.now();
    if(!manual&&now<syncRetryAt)return;
    syncing=true;showSyncStatus('Đang đồng bộ với Supabase…','busy');
    try{
      const snapshot={clear:pending.clear,clearToken:pending.clearToken,deletes:[...pending.deletes],upserts:{...pending.upserts}};
      // Operations are sent before the cloud read to avoid resurrecting deleted rows.
      if(snapshot.clear){
        const {error}=await cloud.from(STUDY_TABLE).delete().eq('user_id',identity);
        if(error)throw error;
        if(pending.clear && pending.clearToken===snapshot.clearToken){pending.clear=false;pending.clearToken=null;}
        savePending();
      }
      for(let start=0;start<snapshot.deletes.length;start+=80){
        const batch=snapshot.deletes.slice(start,start+80);
        const {error}=await cloud.from(STUDY_TABLE).delete().eq('user_id',identity).in('id',batch);
        if(error)throw error;
        pending.deletes=pending.deletes.filter(id=>!batch.includes(id));
        savePending();
      }
      const items=Object.values(snapshot.upserts).filter(validSession);
      for(let start=0;start<items.length;start+=70){
        const batch=items.slice(start,start+70);
        const {error}=await cloud.from(STUDY_TABLE).upsert(batch.map(toCloudRow),{onConflict:'user_id,id'});
        if(error)throw error;
        for(const item of batch){if(JSON.stringify(pending.upserts[item.id])===JSON.stringify(item))delete pending.upserts[item.id]}
        savePending();
      }
      const {data,error}=await cloud.from(STUDY_TABLE)
        .select('id,study_at,started_at,duration_ms,mode,subject,complete')
        .eq('user_id',identity).order('study_at',{ascending:false}).limit(500);
      if(error)throw error;
      // Current in-flight mutations override the last server snapshot.
      const map=new Map();
      if(!pending.clear)for(const row of data||[]){const item=fromCloudRow(row);if(validSession(item))map.set(item.id,item)}
      for(const id of pending.deletes)map.delete(id);
      for(const item of Object.values(pending.upserts))if(validSession(item))map.set(item.id,item);
      studyHistory=[...map.values()].sort((a,b)=>b.at-a.at).slice(0,500);
      persistStudyHistory();renderStudyHistory();
      try{localStorage.setItem(IMPORT_KEY,'done')}catch(_){}
      syncLastSuccess=Date.now();
      syncRetryAt=0;
      showSyncStatus(hasPending()?'Đang hoàn tất các thay đổi còn lại…':'✓ Đã đồng bộ · Lịch sử học có trên các thiết bị đăng nhập.','success');
      if(hasPending())planSync(1000);
    }catch(err){
      console.warn('Đồng bộ học tập chưa thành công',err);
      syncRetryAt=Date.now()+30000;
      const message=String(err?.message||'');
      showSyncStatus(/examlab_study_sessions|schema cache|does not exist|PGRST205|42P01/i.test(message)
        ?'Chưa có bảng đồng bộ · Chạy docs/SETUP_STUDY_SYNC_V15.sql trong Supabase.'
        : /permission denied|row-level security|42501|403/i.test(message)
        ?'Không có quyền đồng bộ · Kiểm tra chính sách RLS trong SQL V15.'
        :'Đồng bộ chưa thành công · Dữ liệu vẫn lưu trên thiết bị và sẽ thử lại.','error');
      planSync(30000);
    }finally{syncing=false;if(syncButton){syncButton.disabled=!cloudEnabled;syncButton.setAttribute('aria-busy','false');}}
  }
  if(syncButton)syncButton.addEventListener('click',()=>{syncRetryAt=0;syncStudyHistory(true)});
  if(loginLink)loginLink.hidden=cloudEnabled;
  window.addEventListener('online',()=>{syncRetryAt=0;planSync(300)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncRetryAt=0;planSync(500)}});
  if(cloud?.auth?.onAuthStateChange){
    cloud.auth.onAuthStateChange((_event,session)=>{
      // Never mix histories if the account changes while this tab stays open.
      const newId=session?.user?.id||'guest';
      if(newId!==identity)setTimeout(()=>location.reload(),0);
    });
  }
  if(cloudEnabled){showSyncStatus('Đang kết nối Supabase…','busy');planSync(80)}
  else showSyncStatus('Chưa đăng nhập · Lịch sử chỉ được lưu trên thiết bị này.','offline');
  const fmtStudyMinutes=(ms)=>{if(ms>0 && ms<60000)return '<1 phút';const n=Math.round(ms/60000);return n>=60?`${Math.floor(n/60)}h ${String(n%60).padStart(2,'0')}p`:`${n} phút`;};
  function persistStudyHistory(){
    try {localStorage.setItem(STUDY_HISTORY_KEY,JSON.stringify(studyHistory.slice(0,500)));return true;}
    catch (_) {toast('Bộ nhớ đầy, không thể ghi lịch sử');return false;}
  }
  function renderStudyHistory(){
    const now=Date.now();
    const today=new Date();today.setHours(0,0,0,0);
    const todayMs=studyHistory.filter(r=>r.at>=today.getTime()).reduce((sum,r)=>sum+r.durationMs,0);
    const weekMs=studyHistory.filter(r=>r.at>=now-7*86400000).reduce((sum,r)=>sum+r.durationMs,0);
    const monthStart=new Date();monthStart.setDate(1);monthStart.setHours(0,0,0,0);
    const monthMs=studyHistory.filter(r=>r.at>=monthStart.getTime()).reduce((sum,r)=>sum+r.durationMs,0);
    $('historyToday').textContent=fmtStudyMinutes(todayMs);
    $('historyWeek').textContent=fmtStudyMinutes(weekMs);
    $('historyMonth').textContent=fmtStudyMinutes(monthMs);
    $('historyCount').textContent=String(studyHistory.length);
    const list=$('studyHistoryList');list.replaceChildren();
    if(!studyHistory.length){const p=document.createElement('p');p.className='history-empty';p.textContent='Chưa có lịch sử. Bắt đầu học rồi bấm “Lưu phiên” nhé!';list.append(p);return;}
    for(const item of studyHistory.slice(0,100)){
      const row=document.createElement('div');row.className='history-row';
      const ico=document.createElement('span');ico.textContent=item.mode==='focus'?'🍅':'⏱️';
      const copy=document.createElement('div');copy.className='history-item-copy';
      const title=document.createElement('strong');title.textContent=item.subject || (item.mode==='focus'?'Pomodoro':'Bấm giờ tự do');
      const date=document.createElement('small');date.textContent=new Date(item.at).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})+' · '+(item.complete?'Hoàn thành':'Đã lưu');
      copy.append(title,date);
      const duration=document.createElement('span');duration.className='history-duration';duration.textContent=timerFormat(item.durationMs,item.durationMs>=3600000);
      const remove=document.createElement('button');remove.className='history-delete';remove.type='button';remove.textContent='×';remove.title='Xóa phiên';remove.setAttribute('aria-label','Xóa phiên '+title.textContent);
      remove.addEventListener('click',()=>{studyHistory=studyHistory.filter(r=>r.id!==item.id);persistStudyHistory();queueRemoval(item.id);renderStudyHistory();});
      row.append(ico,copy,duration,remove);list.append(row);
    }
  }
  function recordStudySession(complete=false){
    if(studyTimer.sessionRecorded || (studyTimer.mode==='focus' && studyTimer.phase==='break'))return false;
    const durationMs=Math.floor(currentTimerElapsed()/1000)*1000;
    if(durationMs<1000)return false;
    const now=Date.now();
    const item={id:makeId(),at:now,startedAt:studyTimer.sessionStartedOn || now-durationMs,
       durationMs:Math.min(durationMs,24*3600000),mode:studyTimer.mode,
       subject:studyTimer.subject.trim().slice(0,75),complete:!!complete};
    studyHistory.unshift(item);studyHistory=studyHistory.slice(0,500);
    if(!persistStudyHistory()){studyHistory.shift();return false;}
    queueSession(item);
    studyTimer.sessionRecorded=true;
    renderStudyHistory();return true;
  }
  function resetStudySession(){studyTimer.elapsedMs=0;studyTimer.startedAt=0;studyTimer.running=false;studyTimer.sessionStartedOn=0;studyTimer.sessionRecorded=false;}

  function timerDuration() {return (studyTimer.phase==='focus'?studyTimer.focusMin:studyTimer.breakMin)*60000;}
  function timerFinish() {
    const duration=timerDuration();
    studyTimer.elapsedMs=duration;
    studyTimer.startedAt=0;
    studyTimer.running=false;
    if(studyTimer.phase==='focus') {studyTimer.completed+=1;recordStudySession(true);}
    persistTimer();
    $('timerHelp').textContent=studyTimer.phase==='focus'?'🎉 Hoàn thành phiên học! Bấm “Chuyển sang nghỉ” để nghỉ một chút.':'🌷 Hết giờ nghỉ! Bấm “Chuyển sang học” để tiếp tục.';
    if(!document.hidden) {try {const A=window.AudioContext||window.webkitAudioContext;if(A){const ctx=new A();const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=784;gain.gain.value=.035;osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.18);osc.onended=()=>ctx.close();}}catch(_){/* Trình duyệt có thể chặn âm */}}
  }
  function renderStudyTimer() {
    if(studyTimer.mode==='focus' && studyTimer.running && currentTimerElapsed()>=timerDuration())timerFinish();
    const elapsed=currentTimerElapsed();
    const focused=studyTimer.mode==='focus';
    const remaining=focused?Math.max(0,timerDuration()-elapsed):elapsed;
    $('timerValue').textContent=timerFormat(remaining,!focused);



    $('timerPhase').textContent=!focused?'Bấm giờ học':studyTimer.phase==='focus'?'🍅 Đang học tập trung':'☕ Đang nghỉ';
    $('timerSettings').hidden=!focused;
    $('timerSwitch').hidden=!focused;
    $('timerFocusMinutes').disabled=studyTimer.running;
    $('timerBreakMinutes').disabled=studyTimer.running;
    $('timerCompleted').textContent=String(studyTimer.completed);
    $('timerStart').textContent=studyTimer.running?'Ⅱ Tạm dừng':(studyTimer.elapsedMs>0?'▶ Tiếp tục':'▶ Bắt đầu');
    $('timerSave').disabled=studyTimer.sessionRecorded || (studyTimer.mode==='focus' && studyTimer.phase==='break') || currentTimerElapsed()<1000;
    $('timerSwitch').textContent=studyTimer.phase==='focus'?'☕ Chuyển sang nghỉ':'📖 Chuyển sang học';
    const ratio=focused?Math.min(100,elapsed/timerDuration()*100):0;
    $('timerDial').style.setProperty('--timer-progress',ratio+'%');
    for(const btn of document.querySelectorAll('[data-timer-mode]')) {
      const active=btn.dataset.timerMode===studyTimer.mode;
      btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));
    }
  }
  document.querySelectorAll('[data-timer-mode]').forEach(btn=>btn.addEventListener('click',()=>{
    if(studyTimer.mode===btn.dataset.timerMode)return;
    recordStudySession(false);
    studyTimer.mode=btn.dataset.timerMode;
    studyTimer.phase='focus';resetStudySession();
    $('timerHelp').textContent=studyTimer.mode==='focus'?'Học tập trung theo phiên, rồi chủ động chuyển sang giờ nghỉ.':'Bấm giờ học tự do, có thể tạm dừng và tiếp tục.';
    persistTimer();renderStudyTimer();
  }));
  $('timerStart').addEventListener('click',()=>{
    if(studyTimer.running){studyTimer.elapsedMs=currentTimerElapsed();studyTimer.running=false;studyTimer.startedAt=0;}
    else {
      if(studyTimer.mode==='focus' && studyTimer.elapsedMs>=timerDuration())studyTimer.elapsedMs=0;
      studyTimer.startedAt=Date.now();
      if(!studyTimer.sessionStartedOn || studyTimer.sessionRecorded){if(studyTimer.sessionRecorded)studyTimer.elapsedMs=0;studyTimer.sessionStartedOn=Date.now();studyTimer.sessionRecorded=false;}
      studyTimer.running=true;
    }
    persistTimer();renderStudyTimer();
  });
  $('timerReset').addEventListener('click',()=>{
    recordStudySession(false);resetStudySession();
    $('timerHelp').textContent='Đã đặt lại đồng hồ. Sẵn sàng cho phiên học mới!';
    persistTimer();renderStudyTimer();
  });
  $('timerSwitch').addEventListener('click',()=>{
    recordStudySession(false);
    studyTimer.phase=studyTimer.phase==='focus'?'break':'focus';resetStudySession();
    $('timerHelp').textContent=studyTimer.phase==='break'?'☕ Nghỉ ngơi thư giãn một chút nhé.':'📚 Sẵn sàng tập trung học bài.';
    persistTimer();renderStudyTimer();
  });
  for(const [id,key,choices] of [['timerFocusMinutes','focusMin',TIMER_FOCUS_OPTIONS],['timerBreakMinutes','breakMin',TIMER_BREAK_OPTIONS]]) {
    $(id).addEventListener('change',()=>{
      const value=Number($(id).value);if(!choices.includes(value))return;
      recordStudySession(false);studyTimer[key]=value;resetStudySession();
      persistTimer();renderStudyTimer();
    });
  }
  $('timerSubject').addEventListener('input',()=>{studyTimer.subject=$('timerSubject').value.slice(0,75);persistTimer();});
  $('timerSave').addEventListener('click',()=>{
    if(!recordStudySession(false)){toast('Chưa có phiên học cần lưu');return;}
    resetStudySession();persistTimer();renderStudyTimer();toast(cloudEnabled?'✓ Đã lưu phiên học · Đang đồng bộ':'✓ Đã lưu phiên học vào lịch sử');
  });
  $('studyHistoryClear').addEventListener('click',async()=>{
    if(!studyHistory.length)return;
    const ok=window.ExamLabDialog?.confirm
      ? await window.ExamLabDialog.confirm(cloudEnabled?'Xóa toàn bộ lịch sử đã lưu trên tài khoản và thiết bị này?':'Xóa toàn bộ lịch sử đã lưu trên thiết bị này?',{title:'Xóa lịch sử học tập',confirmText:'Xóa lịch sử',danger:true})
      : window.confirm('Xóa toàn bộ lịch sử học tập?');
    if(!ok)return;
    studyHistory=[];persistStudyHistory();queueClear();renderStudyHistory();
  });
  readTimer();renderStudyHistory();renderStudyTimer();
  setInterval(renderStudyTimer,500);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderStudyTimer();});
})();
