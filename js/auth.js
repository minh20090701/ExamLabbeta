
/* Standalone account UI. Can switch to Supabase by replacing auth-adapter.js. */
(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const api = window.ExamLabAuth;
  const tabs = [...document.querySelectorAll('[data-auth-tab]')];
  let mode = 'login';
  function showMessage(message, isError = false) {
    const el = $('#authStatus');
    el.textContent = message;
    el.dataset.error = String(isError);
  }
  function switchMode(next) {
    mode = next === 'register' ? 'register' : 'login';
    tabs.forEach(btn => {
      const active = btn.dataset.authTab === mode;
      btn.setAttribute('aria-selected', String(active));
      btn.tabIndex = active ? 0 : -1;
    });
    const register = mode === 'register';
    $('#nameWrap').hidden = !register;
    $('#authName').required = register;
    $('#confirmPasswordWrap').hidden = !register;
    $('#authConfirm').required = register;
    $('#authPassword').autocomplete = register ? 'new-password' : 'current-password';
    $('#authSubmit').textContent = register ? 'Tạo tài khoản' : 'Đăng nhập';
    $('#forgotPassword').hidden = register;
    $('#authTitle').textContent = register ? 'Ghi danh khoa bảng' : 'Vào thư phòng';
    $('#authDescription').textContent = register
      ? 'Tạo hồ sơ học tập bằng email và xác minh để bắt đầu.'
      : 'Đăng nhập để tiếp tục hành trình ôn tập của bạn.';
    showMessage('Tài khoản được xác thực qua email.');
    try { history.replaceState(null, '', location.pathname + location.search + (register ? '#dang-ky' : '')); } catch {}
  }
  function node(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
  }
  function initials(name) {
    return Array.from(String(name || 'S').trim()).slice(0, 1).join('').toLocaleUpperCase('vi-VN');
  }
  function tile(href, icon, title, note) {
    const a = node('a', 'profile-shortcut');
    a.href = href;
    a.append(node('span','profile-icon',icon));
    const group = node('div');
    group.append(node('strong','',title),node('small','',note));
    a.append(group);
    return a;
  }
  function stat(title, value) {
    const cell = node('div');
    cell.append(node('small','',title),node('strong','',value));
    return cell;
  }
  async function refresh() {
    const session = await api.getSession();
    const gate = $('#authMfaGate');
    $('#authPublic').hidden = !!session;
    $('#authLoggedIn').hidden = !session;
    gate.hidden = true;
    if (session && session.kind !== 'guest' && window.ExamLabProfile) {
      try {
        if (await window.ExamLabProfile.pendingMfa()) {
          $('#authLoggedIn').hidden = true;
          gate.hidden = false;
          window.ExamLabProfile.mfaGate(gate, () => refresh().catch(console.error));
          return;
        }
      } catch (err) { console.warn('MFA status check:', err.message); }
    }
    const card = document.querySelector('.auth-card');
    card.classList.toggle('is-logged', !!session);
    if (!session) {
      $('#authTitle').textContent = mode === 'register' ? 'Ghi danh khoa bảng' : 'Vào thư phòng';
      $('#authDescription').textContent = 'Đăng nhập để tiếp tục hành trình ôn tập của bạn.';
      return;
    }
    const guest = session.kind === 'guest';
    $('#authTitle').textContent = guest ? 'Hồ sơ khách' : 'Hồ sơ sĩ tử';
    $('#authDescription').textContent = guest
      ? 'Bạn đang dùng chế độ khách. Đăng nhập để đồng bộ lịch sử và tài liệu.'
      : 'Không gian học tập của bạn tại ExamLab Khoa Bảng.';
    const panel = $('#authLoggedIn');
    panel.replaceChildren();
    const wrapper = node('div','auth-logged-card');
    const banner = node('div','profile-banner');
    const avatar = node('div','profile-avatar',initials(session.name));
    avatar.setAttribute('aria-label','Ảnh đại diện chữ cái đầu');
    const details = node('div');
    details.append(node('span','profile-eyebrow',guest ? 'KHÁCH THAM QUAN' : 'THÀNH VIÊN KHOA BẢNG'));
    details.append(node('div','profile-name',session.name || 'Sĩ tử'));
    details.append(node('div','profile-email',guest ? 'Chưa liên kết email' : session.email || ''));
    banner.append(avatar,details);
    wrapper.append(banner);
    const badges = node('div','profile-badges');
    badges.append(node('span','profile-badge is-good',guest ? '◈ Chế độ khách' : '✓ Đã đăng nhập'));
    if (!guest) badges.append(node('span','profile-badge','✦ Tài khoản đã xác thực'));
    const adminBadge = node('span','profile-badge is-admin','✦ Quản trị viên');
    adminBadge.hidden = true;
    badges.append(adminBadge);
    wrapper.append(badges);
    wrapper.append(node('div','profile-section-heading','Lối tắt học tập'));
    const links = node('div','profile-shortcuts');
    links.append(
      tile('index.html','▤','Tủ đề ôn tập','Chọn đề và vào phòng thi'),
      tile('documents.html','▥','Thư viện tài liệu','Xem và lưu tài liệu học tập')
    );
    if (!guest) links.append(tile('profile.html','⚙','Hồ sơ & bảo mật','Thông tin, mật khẩu, Authenticator, lịch sử đăng nhập'));
    wrapper.append(links);
    if (!guest) {
      wrapper.append(node('div','profile-section-heading','Hành trình của bạn'));
      const stats = node('div','profile-extra');
      const attempts = stat('Bài thi đã nộp','—');
      const materials = stat('Tài liệu của tôi','—');
      stats.append(attempts,materials);wrapper.append(stats);
      if (session.createdAt) {
        const date = new Date(session.createdAt);
        if (!Number.isNaN(date.getTime())) {
          const d = node('small','profile-date',`Ghi danh ngày ${new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}).format(date)}`);
          wrapper.append(d);
        }
      }
      if (window.ExamLabSupabase && session.id) {
        const db = window.ExamLabSupabase;
        // RLS on Supabase guarantees only the owner's counts are readable.
        Promise.allSettled([
          db.from('examlab_attempts').select('id',{count:'exact',head:true}).eq('owner_id',session.id),
          db.from('examlab_materials').select('id',{count:'exact',head:true}).eq('owner_id',session.id),
          db.from('examlab_material_admins').select('user_id').eq('user_id',session.id).maybeSingle()
        ]).then(results => {
          if (panel.firstChild !== wrapper) return;
          const countA=results[0].status==='fulfilled'&&!results[0].value.error?results[0].value.count:null;
          const countM=results[1].status==='fulfilled'&&!results[1].value.error?results[1].value.count:null;
          if (typeof countA === 'number') attempts.querySelector('strong').textContent=String(countA);
          if (typeof countM === 'number') materials.querySelector('strong').textContent=String(countM);
          const admin=results[2].status==='fulfilled'&&!results[2].value.error&&!!results[2].value.data;
          if (admin) {
            adminBadge.hidden=false;
            const link=node('a','profile-admin-link','⚜ Vào phòng quản lý đề và duyệt tài liệu');
            link.href='admin.html';
            wrapper.insertBefore(link,wrapper.querySelector('.profile-actions'));
          }
        }).catch(console.error);
      }
    }
    const actions = node('div','profile-actions');
    const back = node('a','',guest ? 'Đăng nhập tài khoản' : 'Về trang chủ');
    back.href=guest ? 'login.html#dang-ky' : 'index.html';
    back.addEventListener('click',event=>{if(guest){event.preventDefault();api.signOut().then(()=>{switchMode('login');refresh()});}});
    const out = node('button','profile-logout','Đăng xuất');out.type='button';
    out.addEventListener('click',async()=>{
      out.disabled=true;
      try { await api.signOut();await refresh();switchMode('login'); }
      catch(error){showMessage(error?.message||'Chưa thể đăng xuất.',true);out.disabled=false;}
    });
    actions.append(back,out);wrapper.append(actions);panel.append(wrapper);
  }
  tabs.forEach(tab => tab.addEventListener('click', () => switchMode(tab.dataset.authTab)));
  $('#authForm').addEventListener('submit', async event => {
    event.preventDefault();
    const email = $('#authEmail').value.trim();
    const password = $('#authPassword').value;
    if (mode === 'register' && password !== $('#authConfirm').value) {
      showMessage('Mật khẩu xác nhận không khớp.', true); return;
    }
    const button = $('#authSubmit');
    button.disabled = true;
    button.textContent = mode === 'register' ? 'Đang tạo tài khoản...' : 'Đang xác thực...';
    try {
      if (mode === 'register') {
        const created = await api.signUp(email, password, {name:$('#authName').value});
        $('#authForm').reset();
        if(created.needsEmailConfirmation){switchMode('login');showMessage('Đã gửi email xác minh. Mở hộp thư, nhấn liên kết rồi quay lại đăng nhập.');}
        else {await refresh();}
      } else {
        await api.signIn(email, password);
        window.ExamLabProfile?.afterSignIn();
        $('#authForm').reset();
        if (window.ExamLabProfile && !(await window.ExamLabProfile.pendingMfa())) {
          const moved = await window.ExamLabProfile.doneMfa();
          if (moved) return;
        }
        await refresh();
      }
    } catch (error) {
      showMessage(error?.message || 'Không thể xử lý tài khoản.', true);
    } finally {
      button.disabled = false;
      button.textContent = mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập';
    }
  });
  $('#forgotPassword').addEventListener('click', async () => {
    try { await api.resetPassword($('#authEmail').value.trim()); showMessage('Đã gửi hướng dẫn đặt lại mật khẩu nếu email có tài khoản.'); }
    catch (error) { showMessage(error.message || 'Chưa thể đặt lại mật khẩu.', true); }
  });
  $('#guestLogin').addEventListener('click', async () => {
    try { await api.continueAsGuest($('#guestAlias').value || 'Sĩ tử'); location.href='index.html'; }
    catch (error) { showMessage(error.message || 'Không thể vào chế độ khách.', true); }
  });
  api.onAuthStateChange(() => { refresh().catch(console.error); });
  window.addEventListener('hashchange', () => { if (!$('#authPublic').hidden) switchMode(location.hash === '#dang-ky' ? 'register' : 'login'); });
  switchMode(location.hash === '#dang-ky' || new URLSearchParams(location.search).get('mode') === 'register' ? 'register' : 'login');
  refresh();
})();

