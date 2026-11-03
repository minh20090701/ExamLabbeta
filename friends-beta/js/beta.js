/* ExamLab Friends & Competition Beta — độc lập với app chính.
   Không ghi vào examlab_attempts hoặc các bảng người dùng chính. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const db = window.ExamLabSupabase;
  const model = {user:null, overview:null, found:null, session:null, answers:{}, timer:null, submitting:false};

  function message(text, type='') {
    const el=$('notice');
    el.textContent=text;
    el.className='notice'+(type ? ` is-${type}` : '');
  }
  function errMessage(error) {
    const msg=String(error?.message||error||'Có lỗi xảy ra');
    if (/could not find the function|schema cache|404|relation .* does not exist|permission denied for function/i.test(msg))
      return 'Chưa cài SQL Beta hoặc Supabase chưa cập nhật schema. Hãy chạy sql/SETUP_BETA.sql trong Supabase SQL Editor rồi tải lại.';
    return msg;
  }
  function make(tag, cls, value) {
    const el=document.createElement(tag);
    if(cls) el.className=cls;
    if(value!==undefined) el.textContent=String(value);
    return el;
  }
  function elBtn(label, cls, onClick) {
    const btn=make('button','btn small '+cls,label);btn.type='button';
    btn.addEventListener('click', async () => {
      if(btn.disabled)return; btn.disabled=true;
      try { await onClick(); } catch(error) {message(errMessage(error),'error')} finally {btn.disabled=false}
    });
    return btn;
  }
  function initials(name){return (String(name||'?').trim().charAt(0)||'?').toLocaleUpperCase('vi-VN')}
  function personCard(data, detail, actions) {
    const row=make('div','list-card');
    const person=make('div','person');person.append(make('div','avatar',initials(data.name)));
    const info=make('div','person-name');info.append(make('strong','',data.name));
    if(detail)info.append(make('small','',detail));person.append(info);row.append(person);
    if(actions?.length){const act=make('div','list-actions');for(const x of actions)act.append(elBtn(x.label,x.cls,x.fn));row.append(act)}
    return row;
  }
  async function rpc(name, params={}) {
    if(!db) throw Error(window.ExamLabSupabaseError||'Không kết nối được Supabase.');
    const {data,error}=await db.rpc(name,params);
    if(error)throw error;
    return data;
  }
  function fillList(containerId, rows, emptyText, builder) {
    const area=$(containerId);area.replaceChildren();
    if(!rows?.length){area.append(make('p','empty',emptyText));return}
    rows.forEach(row=>area.append(builder(row)));
  }
  async function refresh(showMessage=true) {
    const o=await rpc('examlab_beta_overview');model.overview=o;
    const joined=Boolean(o?.joined);
    $('joinCard').hidden=joined;
    $('participationArea').hidden=!joined;
    if(joined){
      $('displayName').value=o.name||'';
      $('discoverable').checked=Boolean(o.discoverable);
      $('friendCount').textContent=String(o.friends?.length||0);
      $('requestCount').textContent=String(o.incoming?.length||0);
      const mine=(o.leaderboard||[]).find(p=>p.me);
      $('myPoints').textContent=String(mine?.points||0);
      fillList('incoming',o.incoming,'Chưa có lời mời mới.',row=>personCard(row,'Muốn kết bạn với bạn',[
        {label:'Chấp nhận',cls:'primary',fn:()=>friendAction(row.id,'accept')},
        {label:'Từ chối',cls:'danger',fn:()=>friendAction(row.id,'decline')}
      ]));
      fillList('outgoing',o.outgoing,'Không có lời mời đang chờ.',row=>personCard(row,'Đang chờ phản hồi',[
        {label:'Thu hồi',cls:'subtle',fn:()=>friendAction(row.id,'cancel')}
      ]));
      fillList('friendList',o.friends,'Chưa có bạn bè. Hãy tìm một người bằng Gmail!',row=>personCard(row,'Đã kết bạn',[
        {label:'⚔ Thách đấu',cls:'primary',fn:()=>document.dispatchEvent(new CustomEvent('examlab:beta-duel-invite',{detail:{userId:row.user_id,name:row.name}}))},
        {label:'Hủy kết bạn',cls:'danger',fn:async()=>{if(await window.ExamLabDialog.confirm('Bạn muốn hủy kết bạn với '+row.name+'?',{title:'Hủy kết bạn',confirmText:'Hủy kết bạn',danger:true}))await friendAction(row.id,'remove')}}
      ]));
      const board=$('weeklyBoard');board.replaceChildren();
      (o.leaderboard||[]).forEach((entry,i)=>{
        const row=make('div','rank-row'+(entry.me?' me':''));
        row.append(make('span','rank-number',i+1));
        const info=make('div','rank-info');info.append(make('strong','',entry.name+(entry.me?' (bạn)':'')));
        info.append(make('span','',`${entry.plays||0} ngày thi · ${entry.seconds||0} giây`));
        row.append(info,make('strong','rank-points',entry.points||0));board.append(row)
      });
    }
    document.dispatchEvent(new CustomEvent('examlab:beta-updated',{detail:{overview:o}}));
    if(showMessage)message('Đã cập nhật Hội bạn và bảng thi đua.','ok');
  }
  async function friendAction(id, action) {
    await rpc('examlab_beta_friend_action',{p_request_id:id,p_action:action});
    await refresh(false);message('Đã cập nhật lời mời kết bạn.','ok');
    $('findResult').replaceChildren();model.found=null;
  }
  function searchResult(result) {
    const host=$('findResult');host.replaceChildren();
    if(!result?.found){host.append(make('div','muted','Không tìm thấy. Người đó cần đăng nhập Beta và bật quyền được tìm bằng email.'));return}
    const status={friend:'Hai bạn đã kết bạn.',sent:'Bạn đã gửi lời mời.',received:'Người này đã gửi lời mời cho bạn.',none:'Có thể gửi lời mời kết bạn.'};
    const actions=[];
    if(result.relationship==='none'||result.relationship==='received')actions.push({label:result.relationship==='received'?'Chấp nhận lời mời':'Kết bạn',cls:'primary',fn:async()=>{
      const state=await rpc('examlab_beta_send_invite',{p_recipient:result.user_id});
      await refresh(false);
      message(state==='accepted'?'Đã kết bạn!':'Đã gửi lời mời kết bạn.','ok');
      host.replaceChildren();model.found=null;
    }});
    host.append(personCard(result,status[result.relationship]||'',actions));
  }
  function formatSeconds(n){return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
  function exitQuiz() {
    if(model.timer){clearInterval(model.timer);model.timer=null}
    $('quizLayer').hidden=true;document.body.style.overflow='';model.session=null;model.answers={};model.submitting=false;
  }
  function updateAnswered(){
    const q=model.session?.questions||[];
    $('quizAnswered').textContent=`${Object.keys(model.answers).length}/${q.length} đã chọn`;
  }
  function timerTick(){
    if(!model.session)return;
    const n=Math.max(0,Math.ceil((model.session.deadline-Date.now())/1000));
    $('quizTimer').textContent=formatSeconds(n);
    if(n===0){exitQuiz();message('Đã hết 10 phút. Lượt thi hôm nay kết thúc, không thể nộp muộn.','error')}
  }
  function openQuiz(data){
    model.session={...data,deadline:Date.now()+Number(data.seconds_left)*1000};model.answers={};
    const list=$('quizQuestions');list.replaceChildren();
    data.questions.forEach((q,i)=>{
      const set=make('fieldset','quiz-q');
      const legend=make('legend','',`Câu ${i+1}. ${q.prompt}`);set.append(legend);
      set.append(make('small','',q.subject));
      const letters=['A','B','C','D'];
      q.options.forEach((option,j)=>{
        const label=make('label','quiz-option');
        const input=document.createElement('input');input.type='radio';input.name='q_'+q.id;input.value=letters[j];
        input.addEventListener('change',()=>{model.answers[String(q.id)]=letters[j];updateAnswered()});
        label.append(input,make('span','',`${letters[j]}. ${option}`));set.append(label)
      });list.append(set)
    });
    $('quizLayer').hidden=false;document.body.style.overflow='hidden';
    updateAnswered();timerTick();model.timer=setInterval(timerTick,1000);
    $('quizLayer').scrollTop=0;
  }
  function showDailyResult(result) {
    const note=$('dailyNote');
    const score=Number(result.score||0), correct=Number(result.correct||0);
    note.textContent=`✓ Hôm nay: ${score} điểm · ${correct}/10 câu đúng · ${result.seconds||0} giây.`;
    $('startDaily').disabled=true;$('startDaily').textContent='Đã hoàn thành hôm nay';
  }
  async function startDaily() {
    const btn=$('startDaily');btn.disabled=true;
    try{
      const result=await rpc('examlab_beta_daily');
      if(result.status==='done'){
        showDailyResult(result);message('Bạn đã hoàn thành thử thách hôm nay.','ok');return;
      }
      if(result.status==='expired'){
        btn.textContent='Đã hết lượt hôm nay';message('Lượt thi hôm nay đã hết thời gian. Hẹn ngày mai nhé.','error');return;
      }
      if(result.status!=='ready'||!result.questions?.length)throw Error('Không lấy được bộ câu hỏi hôm nay.');
      openQuiz(result);
    }catch(error){message(errMessage(error),'error')}
    finally{if(btn.textContent==='Bắt đầu thi đua')btn.disabled=false}
  }
  async function submitDaily(event){
    event.preventDefault();
    if(!model.session||model.submitting)return;
    model.submitting=true;$('submitDaily').disabled=true;
    try{
      const s=await rpc('examlab_beta_submit',{p_session_id:model.session.id,p_answers:model.answers});
      exitQuiz();showDailyResult(s);
      await refresh(false);
      message(`Đã nộp! Bạn đạt ${s.score} điểm (${s.correct}/${s.total} câu đúng). Xem bảng xếp hạng bên dưới.`, 'ok');
      $('weeklyBoard').scrollIntoView({block:'center',behavior:'smooth'});
    }catch(error){message(errMessage(error),'error');
      if(/hết 10 phút|đã nộp bài/i.test(String(error.message))){exitQuiz();}
    }finally{model.submitting=false;$('submitDaily').disabled=false}
  }
  function bind(){
    $('profileForm').addEventListener('submit',async(event)=>{
      event.preventDefault();const btn=$('saveProfile');btn.disabled=true;
      try{
        await rpc('examlab_beta_register',{p_name:$('displayName').value.trim(),p_discoverable:$('discoverable').checked});
        await refresh(false);message('Đã lưu hồ sơ Beta.','ok');
      }catch(error){message(errMessage(error),'error')}finally{btn.disabled=false}
    });
    $('findForm').addEventListener('submit',async(event)=>{
      event.preventDefault();const b=$('findBtn');b.disabled=true;
      try{const result=await rpc('examlab_beta_find_friend',{p_email:$('findEmail').value.trim()});model.found=result;searchResult(result);
        message(result.found?'Đã kiểm tra email được nhập.':'Không tìm thấy tài khoản có quyền được tìm kiếm.',result.found?'ok':'');
      }catch(error){message(errMessage(error),'error')}finally{b.disabled=false}
    });
    $('refreshBtn').addEventListener('click',async()=>{try{await refresh()}catch(error){message(errMessage(error),'error')}});
    $('startDaily').addEventListener('click',startDaily);
    $('quizForm').addEventListener('submit',submitDaily);
    window.addEventListener('pagehide',()=>{if(model.timer)clearInterval(model.timer)});
  }
  async function bootstrap(){
    bind();
    if(!db){message(window.ExamLabSupabaseError||'Không tải được thư viện Supabase. Kiểm tra mạng và đường dẫn ../supabase-config.js.','error');return}
    try{
      const {data,error}=await db.auth.getUser();if(error)throw error;
      const user=data?.user;
      if(!user){$('loginGate').hidden=false;message('Bạn cần đăng nhập tài khoản ExamLab để dùng Beta.');return}
      model.user=user;
      $('emailMe').textContent=user.email||'';
      $('app').hidden=false;
      $('displayName').value=String(user.user_metadata?.display_name||user.email?.split('@')[0]||'Sĩ tử').slice(0,40);
      await refresh(false);
      message('Hội bạn Beta đã sẵn sàng!','ok');
    }catch(error){message(errMessage(error),'error');$('loginGate').hidden=false}
  }
  bootstrap();
})();
