/* ExamLab V14 · Hộp thoại xác nhận, thông báo, mã xác thực (không ghi lại mã). */
(function(){
  'use strict';
  let previous=Promise.resolve();
  function show(opts){
    const promise=previous.then(()=>new Promise(resolve=>{
      const mode=opts.mode||'confirm';
      const oldFocus=document.activeElement;
      const host=document.createElement('div');host.id='examlab-dialog-host';
      const backdrop=document.createElement('div');backdrop.className='exm-backdrop';backdrop.setAttribute('aria-hidden','true');
      const box=document.createElement('form');box.className='exm-card';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.noValidate=true;
      const symbol=document.createElement('div');symbol.className='exm-symbol';symbol.setAttribute('aria-hidden','true');symbol.textContent=mode==='code'?'⌑':opts.danger?'!':'❖';
      const eyebrow=document.createElement('p');eyebrow.className='exm-kicker';eyebrow.textContent='EXAMLAB · KHOA BẢNG';
      const title=document.createElement('h2');title.className='exm-title';title.id='exm-dialog-title';title.textContent=opts.title||(mode==='code'?'Xác thực bảo mật':mode==='alert'?'Thông báo':opts.danger?'Xác nhận thay đổi':'Xác nhận thao tác');
      box.setAttribute('aria-labelledby',title.id);
      const message=document.createElement('p');message.className='exm-message';message.id='exm-dialog-desc';message.textContent=String(opts.message||'');box.setAttribute('aria-describedby',message.id);
      box.append(symbol,eyebrow,title,message);
      let input=null,errorLabel=null;
      if(mode==='code'){
        const label=document.createElement('label');label.className='exm-field';label.textContent='Mã xác thực từ ứng dụng';
        input=document.createElement('input');input.className='exm-code';input.type='text';input.inputMode='numeric';input.autocomplete='one-time-code';input.maxLength=6;input.placeholder='000000';input.setAttribute('aria-label','Mã Authenticator gồm 6 chữ số');
        label.append(input);box.append(label);
        errorLabel=document.createElement('div');errorLabel.className='exm-error';errorLabel.setAttribute('role','status');box.append(errorLabel);
        input.addEventListener('input',()=>{input.value=input.value.replace(/[^0-9]/g,'').slice(0,6);errorLabel.textContent=''});
      }
      const actions=document.createElement('div');actions.className='exm-actions'+(mode==='alert'?' only-ok':'');
      let cancel=null;
      if(mode!=='alert'){
        cancel=document.createElement('button');cancel.type='button';cancel.className='exm-btn exm-cancel';cancel.textContent=opts.cancelText||'Quay lại';actions.append(cancel);
      }
      const ok=document.createElement('button');ok.type='submit';ok.className='exm-btn exm-ok'+(opts.danger?' exm-danger':'');ok.textContent=opts.confirmText||(mode==='alert'?'Đã hiểu':mode==='code'?'Xác minh & tiếp tục':'Đồng ý');actions.append(ok);
      box.append(actions);host.append(backdrop,box);
      const oldOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';document.body.append(host);
      function close(value){host.removeEventListener('keydown',onKey);host.remove();document.documentElement.style.overflow=oldOverflow;if(oldFocus&&oldFocus.isConnected&&oldFocus.focus)oldFocus.focus();resolve(value)}
      function onKey(e){if(e.key==='Escape'){e.preventDefault();close(mode==='code'?null:false);return}if(e.key==='Tab'){
        const focusables=[...box.querySelectorAll('input,button')].filter(el=>!el.disabled);
        const a=focusables[0],z=focusables.at(-1);if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
      }}
      host.addEventListener('keydown',onKey);
      if(cancel)cancel.addEventListener('click',()=>close(mode==='code'?null:false));
      backdrop.addEventListener('click',()=>{if(mode!=='code')close(mode==='alert'?true:false)});
      box.addEventListener('submit',e=>{e.preventDefault();if(mode==='code'){
        const code=input.value.trim();if(!/^\d{6}$/.test(code)){errorLabel.textContent='Vui lòng nhập đủ 6 chữ số từ ứng dụng Authenticator.';input.focus();return}close(code);
      }else close(true)});
      (input||cancel||ok).focus();
    }));
    previous=promise.then(()=>undefined,()=>undefined);
    return promise;
  }
  window.ExamLabDialog={
    confirm(message,options={}){return show({...options,mode:'confirm',message})},
    alert(message,options={}){return show({...options,mode:'alert',message})},
    code(options={}){return show({...options,mode:'code'})}
  };
})();
