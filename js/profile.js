/* ExamLab V8: Thông tin cá nhân, đổi mật khẩu, TOTP MFA, lịch sử đăng nhập có RLS.
   Không dùng service_role, không lưu mật khẩu/secret TOTP hoặc địa chỉ IP vào localStorage. */
(function(){
 'use strict';
 const $=(s,r=document)=>r.querySelector(s);
 const db=()=>window.ExamLabSupabase;
 const safe=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 let pendingLogin=false;
 let enrollment=null;
 function notify(target,text,error=false){if(!target)return;target.textContent=text;target.classList.add('show');target.classList.toggle('error',error);target.setAttribute('role','status')}
 function requireClient(){if(!db())throw Error('Chưa có kết nối Supabase.');return db()}
 async function user(){const c=requireClient();const {data:state,error:sessionError}=await c.auth.getSession();if(sessionError)throw sessionError;if(!state?.session)return null;const {data,error}=await c.auth.getUser();if(error)throw error;return data.user}
 async function pendingMfa(){const c=requireClient();const {data,error}=await c.auth.mfa.getAuthenticatorAssuranceLevel();if(error)throw error;return data?.currentLevel==='aal1' && data?.nextLevel==='aal2'}
 async function factorList(){const {data,error}=await requireClient().auth.mfa.listFactors();if(error)throw error;return (data?.totp||[]).filter(f=>f.status==='verified')}
 async function verify(factorId,code){if(!/^\d{6}$/.test(code))throw Error('Nhập mã 6 chữ số từ ứng dụng Authenticator.');const c=requireClient();const r=await c.auth.mfa.challenge({factorId});if(r.error)throw r.error;const v=await c.auth.mfa.verify({factorId,challengeId:r.data.id,code});if(v.error)throw v.error;return true}
 function deviceLabel(){const ua=navigator.userAgent||'';const platform=/Android/i.test(ua)?'Android':/iPhone|iPad/i.test(ua)?'iPhone / iPad':/Windows/i.test(ua)?'Windows':/Macintosh/i.test(ua)?'macOS':'Thiết bị khác';const browser=/Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Firefox\//.test(ua)?'Firefox':/Safari\//.test(ua)?'Safari':'Trình duyệt';return platform+' · '+browser}
 async function recordLogin(){try{const u=await user();if(!u)return;const {error}=await requireClient().from('examlab_login_history').insert({user_id:u.id,device:deviceLabel(),event:'Đăng nhập'});if(error)console.info('[ExamLab] Lịch sử đăng nhập cần cài SQL V8:',error.code||error.message)}catch(err){console.info('[ExamLab] Không ghi được lịch sử đăng nhập:',err.message)}}
 function pendingRedirect(){const path=new URLSearchParams(location.search).get('next');if(!path)return null;try{const u=new URL(path,location.href);if(u.origin!==location.origin||u.pathname.includes('/login.html')||!u.pathname.endsWith('.html'))return null;return u.href}catch{return null}}
 async function doneMfa(){if(pendingLogin){pendingLogin=false;await recordLogin()}const next=pendingRedirect();if(next){location.assign(next);return true}return false}
 function mfaGate(host,onDone){host.replaceChildren();const gate=document.createElement('section');gate.className='profile-login-mfa';gate.innerHTML='<h3>Xác thực hai bước</h3><p>Tài khoản đã bật Authenticator. Nhập mã 6 chữ số từ ứng dụng của bạn để tiếp tục.</p><form id="mfaGateForm"><label class="profile-input-label" for="mfaGateCode">Mã Authenticator</label><input id="mfaGateCode" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="000000"><button class="btn btn-primary" type="submit">Xác minh & tiếp tục</button></form><p class="profile-message" id="mfaGateMessage" role="status"></p>';
  host.append(gate);
  $('#mfaGateForm',gate).addEventListener('submit',async ev=>{ev.preventDefault();const button=$('button[type=submit]',gate);button.disabled=true;try{const factors=await factorList();if(!factors.length)throw Error('Không thấy Authenticator đã xác minh.');await verify(factors[0].id,$('#mfaGateCode',gate).value.trim());const redirected=await doneMfa();if(!redirected)onDone?.()}catch(err){notify($('#mfaGateMessage',gate),err.message||'Không xác minh được mã.',true)}finally{button.disabled=false}});
 }
 async function populate(){const c=requireClient();const u=await user();if(!u){location.replace('login.html');return}
  if(await pendingMfa()){
   const gate=$('#profileGuard');gate.hidden=false;$('#profileContent').hidden=true;
   mfaGate(gate,()=>{gate.hidden=true;$('#profileContent').hidden=false;populate().catch(console.error)});return;
  }
  $('#profileGuard').hidden=true;$('#profileContent').hidden=false;
  const md=u.user_metadata||{};$('#profileName').value=md.display_name||'';$('#profileBirth').value=md.birth_date||'';$('#profilePhone').value=md.contact_phone||'';$('#profileEmail').value=u.email||'';
  const name=$('#profileNamePreview');if(name)name.textContent=md.display_name||u.email?.split('@')[0]||'Sĩ tử';
  await refreshMfa();await refreshHistory(u.id);
 }
 async function refreshMfa(){const status=$('#mfaStatus');const active=$('#mfaActive');const start=$('#mfaStart');try{const factors=await factorList();const on=factors.length>0;status.textContent=on?'✓ Đang bật bảo mật hai bước':'Chưa bật Authenticator';start.hidden=on;active.hidden=!on;if(on)active.dataset.factorId=factors[0].id}catch(err){status.textContent='Chưa kiểm tra được Authenticator';notify($('#mfaMessage'),err.message,true)}}
 async function refreshHistory(uid){const list=$('#loginHistory');list.replaceChildren();try{const {data,error}=await requireClient().from('examlab_login_history').select('logged_at,device,event').eq('user_id',uid).order('logged_at',{ascending:false}).limit(25);if(error)throw error;if(!data?.length){list.innerHTML='<p class="profile-note">Chưa có lượt đăng nhập được ghi nhận từ khi bật tính năng này.</p>';return}
  for(const item of data){const row=document.createElement('div');row.className='profile-history-item';const label=document.createElement('div');const title=document.createElement('strong');title.textContent=item.event||'Đăng nhập';const meta=document.createElement('span');meta.textContent=item.device||'Thiết bị không rõ';label.append(title,meta);const time=document.createElement('span');time.textContent=new Date(item.logged_at).toLocaleString('vi-VN');row.append(label,time);list.append(row)}
 }catch(err){list.innerHTML='<p class="profile-note">Lịch sử chưa hoạt động. Quản trị viên cần chạy tệp <code>docs/SETUP_PROFILE_V8.sql</code> trong Supabase SQL Editor. Tính năng này chỉ ghi lại các lần đăng nhập mới, không truy xuất lịch sử cũ.</p>';}}
 function bindPage(){if(!$('#profileContent'))return;
  $('#profileForm').addEventListener('submit',async e=>{e.preventDefault();const button=$('#profileSave');button.disabled=true;try{const name=$('#profileName').value.trim();const birth=$('#profileBirth').value;const phone=$('#profilePhone').value.trim();if(name.length<2||name.length>40)throw Error('Tên phải có từ 2 đến 40 ký tự.');if(birth && (Number.isNaN(Date.parse(birth))||birth>new Date().toISOString().slice(0,10)))throw Error('Ngày sinh không hợp lệ.');if(phone&&!/^[+\d ()-]{7,20}$/.test(phone))throw Error('Số điện thoại không hợp lệ.');const result=await requireClient().auth.updateUser({data:{display_name:name,birth_date:birth,contact_phone:phone}});if(result.error)throw result.error;notify($('#profileSaveMessage'),'Đã lưu thông tin cá nhân.');$('#profileNamePreview').textContent=name}catch(err){notify($('#profileSaveMessage'),err.message,true)}finally{button.disabled=false}});
  $('#passwordForm').addEventListener('submit',async e=>{e.preventDefault();const button=$('#passwordSave');button.disabled=true;try{const pass=$('#profilePassword').value;if(pass.length<8)throw Error('Mật khẩu mới phải có ít nhất 8 ký tự.');if(pass!==$('#profilePasswordRepeat').value)throw Error('Hai lần nhập mật khẩu không khớp.');const {error}=await requireClient().auth.updateUser({password:pass});if(error)throw error;e.target.reset();notify($('#passwordMessage'),'Đã cập nhật mật khẩu.')}catch(err){notify($('#passwordMessage'),err.message,true)}finally{button.disabled=false}});
  $('#mfaStart').addEventListener('click',async()=>{const b=$('#mfaStart');b.disabled=true;try{const r=await requireClient().auth.mfa.enroll({factorType:'totp',friendlyName:'ExamLab Authenticator'});if(r.error)throw r.error;enrollment=r.data;const qr=r.data.totp?.qr_code||'';if(!qr.startsWith('data:image/'))throw Error('Không tải được mã QR bảo mật.');$('#mfaQr').src=qr;$('#mfaSecret').textContent=r.data.totp?.secret||'';$('#mfaEnroll').hidden=false;notify($('#mfaMessage'),'Quét mã QR và nhập mã 6 chữ số để hoàn tất. Không chia sẻ mã bí mật của bạn.')}catch(err){notify($('#mfaMessage'),err.message,true)}finally{b.disabled=false}});
  $('#mfaEnable').addEventListener('click',async()=>{const b=$('#mfaEnable');b.disabled=true;try{if(!enrollment)throw Error('Vui lòng bắt đầu thiết lập Authenticator.');await verify(enrollment.id,$('#mfaEnrollCode').value.trim());enrollment=null;$('#mfaEnroll').hidden=true;$('#mfaEnrollCode').value='';$('#mfaSecret').textContent='';$('#mfaQr').removeAttribute('src');await refreshMfa();notify($('#mfaMessage'),'Đã bật Authenticator. Lần đăng nhập tiếp theo sẽ cần mã xác thực.')}catch(err){notify($('#mfaMessage'),err.message,true)}finally{b.disabled=false}});
  $('#mfaCancel').addEventListener('click',async()=>{if(enrollment){try{await requireClient().auth.mfa.unenroll({factorId:enrollment.id})}catch{}}enrollment=null;$('#mfaEnroll').hidden=true;$('#mfaSecret').textContent='';$('#mfaQr').removeAttribute('src')});
  $('#mfaDisable').addEventListener('click',async()=>{
    const b=$('#mfaDisable');if(b.disabled)return;
    const id=$('#mfaActive').dataset.factorId;
    if(!id){notify($('#mfaMessage'),'Không tìm thấy phương thức xác thực đang bật.',true);return}
    const code=await window.ExamLabDialog.code({
      title:'Xác nhận tắt Authenticator',
      message:'Để bảo vệ tài khoản, hãy mở ứng dụng Authenticator và nhập mã 6 chữ số hiện tại. Chỉ sau khi xác minh thành công, bảo mật hai bước mới được tắt.',
      confirmText:'Xác minh & tắt',cancelText:'Giữ bảo mật',danger:true
    });
    if(code===null)return;
    b.disabled=true;
    try{
      // Luôn xác minh lại mã TOTP; không chỉ dựa vào phiên AAL2 có sẵn.
      await verify(id,code);
      const r=await requireClient().auth.mfa.unenroll({factorId:id});
      if(r.error)throw r.error;
      // Sau khi bỏ MFA, làm mới JWT để cập nhật assurance level.
      try {
        const session=await requireClient().auth.refreshSession();
        if(session.error)console.warn('[ExamLab] Đã tắt MFA nhưng làm mới phiên chưa thành công:',session.error.message);
      } catch(refreshError) {
        console.warn('[ExamLab] Đã tắt MFA nhưng chưa làm mới phiên:',refreshError.message);
      }
      await refreshMfa();
      notify($('#mfaMessage'),'Đã xác minh và tắt Authenticator thành công.');
    }catch(err){notify($('#mfaMessage'),'Không thể tắt Authenticator: '+(err?.message||'Mã xác thực không hợp lệ.'),true)}
    finally{b.disabled=false}
  });
  $('#profileLogout').addEventListener('click',async()=>{const {error}=await requireClient().auth.signOut();if(error)await window.ExamLabDialog.alert(error.message,{title:'Không thể đăng xuất'});else location.assign('login.html')});
  populate().catch(err=>notify($('#profileGlobalMessage'),err.message,true));
 }
 window.ExamLabProfile={pendingMfa,mfaGate,recordLogin,afterSignIn(){pendingLogin=true},doneMfa};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindPage);else bindPage();
})();
