/* ExamLab Friends Beta V2: thách đấu, thành tích, bảng tháng.
   Chỉ dùng RPC trên Supabase; không đọc/ghi bảng ExamLab chính.
   Không tự chấm điểm từ trình duyệt. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const db = window.ExamLabSupabase;
  let loading = false;
  let reloadRequested = false;
  let isMonth = false;
  let latest = null;
  let latestOverview = null;
  const fmt = new Intl.NumberFormat('vi-VN');

  function node(tag, cls='', text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = String(text);
    return el;
  }
  function plainDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value || '');
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  function showNote(value, error=false) {
    let place = $('v2Notice');
    if (!place) {
      place = node('p','v2-inline-note');
      place.id = 'v2Notice';
      $('duelArea')?.append(place);
    }
    place.textContent = value;
    place.classList.toggle('is-error', error);
  }
  function errorText(err) {
    const msg = String(err?.message || err || 'Lỗi không xác định');
    if (/examlab_beta_v2_|schema cache|function .* does not exist|404|permission denied/i.test(msg)) {
      return 'Chưa cài bản nâng cấp Beta V2. Hãy chạy sql/UPGRADE_BETA_V2.sql trong Supabase SQL Editor (sau SETUP_BETA.sql).';
    }
    return msg;
  }
  async function rpc(name, params={}) {
    if (!db) throw new Error('Không tải được kết nối Supabase.');
    const {data,error} = await db.rpc(name,params);
    if (error) throw error;
    return data;
  }
  function safeButton(text, style, handler) {
    const button = node('button', `btn small ${style}`, text);
    button.type = 'button';
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      button.disabled = true;
      try { await handler(); }
      catch (err) { showNote(errorText(err), true); }
      finally { button.disabled = false; }
    });
    return button;
  }

  function displayStats(stats={}) {
    const host = $('personalStats');
    if (!host) return;
    host.replaceChildren();
    const correct = Number(stats.correct || 0);
    const possible = Number(stats.possible || 0);
    const accuracy = possible ? Math.round(correct*100/possible) : 0;
    const list = [
      ['🔥', String(stats.streak||0) + ' ngày', 'Chuỗi ngày hiện tại'],
      ['📚', String(stats.days||0) + ' ngày', 'Ngày đã dự thi'],
      ['⭐', fmt.format(stats.points||0), 'Tổng điểm Beta'],
      ['🎯', accuracy+'%', 'Tỉ lệ đúng tổng thể'],
      ['🏆', fmt.format(stats.best||0), 'Điểm cao nhất'],
      ['🗓️', fmt.format(stats.month_points||0), 'Điểm tháng này']
    ];
    for (const [icon,value,label] of list) {
      const card = node('div','progress-stat');
      card.append(node('span','progress-symbol',icon),node('strong','',value),node('small','',label));
      host.append(card);
    }
  }
  function displayBadges(badges=[]) {
    const host = $('badgeList');
    if (!host) return;
    host.replaceChildren();
    for (const item of badges) {
      const box = node('div','badge-card'+(item.unlocked?' unlocked':' locked'));
      box.append(node('span','badge-art',item.icon),node('strong','',item.name),node('small','',item.detail));
      if (item.unlocked) box.append(node('span','badge-earned','Đã đạt'));
      host.append(box);
    }
  }
  function displayHistory(history=[]) {
    const host = $('personalHistory');
    if (!host) return;
    host.replaceChildren();
    if (!history.length) {
      host.append(node('p','empty','Chưa có lần thi nào. Hoàn thành thử thách hôm nay để bắt đầu ghi thành tích!'));
      return;
    }
    for (const entry of history) {
      const row=node('div','history-item');
      const info=node('div','history-info');
      info.append(node('strong','',plainDate(entry.day)), node('small','',`${entry.correct||0}/10 đúng · ${entry.seconds||0} giây`));
      const progress=node('div','history-meter');
      const fill=node('span');
      fill.style.width=`${Math.min(100,Math.max(0,Number(entry.score||0)/10))}%`;
      progress.append(fill);
      row.append(info,progress,node('b','history-score',`${fmt.format(entry.score||0)} đ`));
      host.append(row);
    }
  }
  function displayMonthly(board=[]) {
    const host=$('monthlyBoard');
    if (!host) return;
    host.replaceChildren();
    if (!board.length) {
      host.append(node('p','empty','Chưa có dữ liệu xếp hạng tháng.'));
      return;
    }
    for (const [i,entry] of board.entries()) {
      const row=node('div','rank-row'+(entry.me?' me':''));
      row.append(node('span','rank-number',i+1));
      const info=node('div','rank-info');
      info.append(node('strong','',entry.name+(entry.me?' (bạn)':'')),
        node('span','',`${entry.plays||0} ngày thi · ${entry.seconds||0} giây`));
      row.append(info,node('strong','rank-points',fmt.format(entry.points||0)));
      host.append(row);
    }
  }
  function switchBoard(month) {
    isMonth=Boolean(month);
    $('weeklyBoard').hidden=isMonth;
    $('monthlyBoard').hidden=!isMonth;
    for (const [button,active] of [[$('rankWeek'),!isMonth],[$('rankMonth'),isMonth]]) {
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    }
  }

  function matchOutcome(item, today) {
    if (item.status==='declined') return {label:'Đã từ chối',cls:'closed'};
    if (item.status==='cancelled') return {label:'Đã thu hồi',cls:'closed'};
    if (item.status==='pending' && item.day < today) return {label:'Hết hạn',cls:'closed'};
    if (item.status==='pending') return {label:item.is_challenger?'Chờ phản hồi':'Lời mời mới',cls:'new'};
    const mine = Number(item.mine), theirs=Number(item.theirs);
    if (item.mine != null && item.theirs != null) {
      if (mine>theirs) return {label:'Bạn thắng 🎉',cls:'win'};
      if (mine<theirs) return {label:'Bạn thua',cls:'closed'};
      if (Number(item.my_seconds)<Number(item.their_seconds)) return {label:'Bạn thắng nhờ thời gian 🎉',cls:'win'};
      if (Number(item.my_seconds)>Number(item.their_seconds)) return {label:'Bạn thua vì thời gian',cls:'closed'};
      return {label:'Hòa 🤝',cls:'complete'};
    }
    return item.day < today ? {label:'Hết hạn — chưa đủ kết quả',cls:'closed'} :
      {label:'Đã nhận thách đấu · chờ hai bên thi',cls:'complete'};
  }
  function displayDuels(duels=[], today='') {
    const host=$('duelList');
    if (!host) return;
    host.replaceChildren();
    const pending=duels.filter(d=>d.status==='pending' && !d.is_challenger && d.day===today).length;
    $('duelCount').hidden=!pending;
    $('duelAlert').hidden=!pending;
    $('duelCount').textContent=String(pending);
    $('duelAlert').textContent=String(pending);
    if (latestOverview) {
      const incoming=(latestOverview.incoming||[]).length;
      const all=incoming+pending;
      document.title=all?`(${all}) Hội bạn · ExamLab Beta`:'Hội bạn đồng môn · ExamLab Beta';
    }
    if (!duels.length) {
      host.append(node('p','empty','Chưa có thách đấu. Chọn “⚔ Thách đấu” bên cạnh một người trong danh sách Bạn bè.'));
      return;
    }
    for (const d of duels) {
      const box=node('div','duel-card');
      const head=node('div','duel-main');
      head.append(node('strong','',d.other_name || 'Bằng hữu'),node('small','',`${d.is_challenger?'Bạn gửi lời mời':'Bạn nhận lời mời'} · ${plainDate(d.day)}`));
      const outcome=matchOutcome(d,today);
      const pill=node('span','duel-status '+outcome.cls,outcome.label);
      const top=node('div','duel-top');top.append(head,pill);box.append(top);
      if (d.status==='accepted' && (d.mine != null || d.theirs != null)) {
        const score=node('p','duel-scores',`Bạn: ${d.mine==null?'Chưa thi':fmt.format(d.mine)+' điểm'} · ${d.other_name}: ${d.theirs==null?'Chưa thi':fmt.format(d.theirs)+' điểm'}`);
        box.append(score);
      }
      if (d.status==='pending' && d.day===today) {
        const actions=node('div','duel-actions');
        if (!d.is_challenger) {
          actions.append(safeButton('Chấp nhận','primary',()=>action('accept',null,d.id)),
            safeButton('Từ chối','subtle',()=>action('decline',null,d.id)));
        } else actions.append(safeButton('Thu hồi','subtle',()=>action('cancel',null,d.id)));
        box.append(actions);
      }
      host.append(box);
    }
  }
  function render(data) {
    if (!data?.joined) return;
    latest=data;
    displayStats(data.stats);
    displayBadges(data.badges);
    displayHistory(data.history);
    displayMonthly(data.monthly);
    displayDuels(data.duels,data.server_day);
    switchBoard(isMonth);
  }
  async function load(quiet=false) {
    if (loading) {reloadRequested=true;return;}
    loading=true;
    try {
      const result=await rpc('examlab_beta_v2_dashboard');
      render(result);
      if (!quiet) showNote('Đã cập nhật thách đấu, thành tích và xếp hạng tháng.');
    } catch(err) {showNote(errorText(err),true);}
    finally {
      loading=false;
      if (reloadRequested) {reloadRequested=false;void load(true);}
    }
  }
  async function action(kind,otherUser=null,duelId=null) {
    const result=await rpc('examlab_beta_v2_duel_action',{
      p_action:kind,p_other_user:otherUser,p_duel_id:duelId
    });
    const messages={invited:'Đã gửi lời thách đấu! Bạn ấy sẽ thấy trong Beta.',already_exists:'Hai bạn đã có thách đấu hôm nay.',accepted:'Đã chấp nhận! Mỗi người làm thử thách 10 câu hôm nay.',declined:'Đã từ chối lời thách đấu.',cancelled:'Đã thu hồi lời thách đấu.'};
    await load(true);
    showNote(messages[result]||'Đã cập nhật thách đấu.');
  }
  document.addEventListener('examlab:beta-duel-invite',async event=>{
    const friend=event.detail;
    if (!friend?.userId) return;
    if (!(await window.ExamLabDialog.confirm(`Gửi lời thách đấu 10 câu hôm nay tới ${friend.name}?\nKết quả được tính từ lượt thi hôm nay của hai người.`,{title:'Thách đấu bạn bè',confirmText:'Gửi lời thách đấu'}))) return;
    void action('invite',friend.userId).catch(err=>showNote(errorText(err),true));
  });
  document.addEventListener('examlab:beta-updated',event=>{
    latestOverview=event.detail?.overview || null;
    if (latestOverview?.joined) void load(true);
  });
  $('rankWeek')?.addEventListener('click',()=>switchBoard(false));
  $('rankMonth')?.addEventListener('click',()=>switchBoard(true));
  $('duelRefresh')?.addEventListener('click',()=>void load(false));
  document.addEventListener('visibilitychange',()=>{
    if (!document.hidden && latestOverview?.joined) void load(true);
  });
})();
