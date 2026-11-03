/* ExamLab V9 · Đồng hồ học tập kế thừa từ Timeline V9 (stopwatch, Pomodoro, lịch sử) */
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
    $('historyToday').textContent=fmtStudyMinutes(todayMs);
    $('historyWeek').textContent=fmtStudyMinutes(weekMs);
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
      remove.addEventListener('click',()=>{studyHistory=studyHistory.filter(r=>r.id!==item.id);persistStudyHistory();renderStudyHistory();});
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
    resetStudySession();persistTimer();renderStudyTimer();toast('✓ Đã lưu phiên học vào lịch sử');
  });
  $('studyHistoryClear').addEventListener('click',()=>{
    if(!studyHistory.length)return;
    if(!confirm('Xóa toàn bộ lịch sử học tập trên thiết bị này?'))return;
    studyHistory=[];persistStudyHistory();renderStudyHistory();
  });
  readTimer();renderStudyHistory();renderStudyTimer();
  setInterval(renderStudyTimer,500);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderStudyTimer();});
})();
