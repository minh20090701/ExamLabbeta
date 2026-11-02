/* ExamLab V6 — a single event listener and a single theme state. */
(() => {
  'use strict';
  const ROOT = document.documentElement;
  const KEY = 'examlab.theme';
  const BUTTON = '[data-examlab-theme-toggle]';
  const SYMBOL = {
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2m4.93-17.07-1.42 1.42M6.49 17.51l-1.42 1.42M22 12h-2M4 12H2m17.07 7.07-1.42-1.42M6.49 6.49 5.07 5.07"/>',
    dark: '<path d="M20.985 12.486A9 9 0 0 1 11.514 3.015a9 9 0 1 0 9.471 9.471Z"/>'
  };
  const current = () => ROOT.dataset.theme === 'dark' ? 'dark' : 'light';
  function render() {
    const mode = current();
    document.querySelectorAll(BUTTON).forEach(button => {
      if (button.dataset.themeRendered === mode) return;
      button.classList.add('theme-button');
      button.type = 'button';
      button.innerHTML = '<svg class="theme-symbol" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + SYMBOL[mode] + '</svg>';
      button.dataset.themeRendered = mode;
      const hint = mode === 'dark' ? 'Đang ở chế độ tối. Bấm để chuyển sáng.' : 'Đang ở chế độ sáng. Bấm để chuyển tối.';
      button.setAttribute('aria-label', hint);
      button.setAttribute('title', hint);
      button.setAttribute('aria-pressed', String(mode === 'dark'));
    });
  }
  function set(mode, persist = true) {
    const next = mode === 'dark' ? 'dark' : 'light';
    ROOT.dataset.theme = next;
    if (persist) {
      try { localStorage.setItem(KEY, next); } catch (_) {}
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = next === 'dark' ? '#201b19' : '#542821';
    render();
    return next;
  }
  function toggle() {return set(current() === 'dark' ? 'light' : 'dark');}
  document.addEventListener('click', event => {
    const button = event.target?.closest?.(BUTTON);
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    toggle();
  }, true);
  window.addEventListener('storage', event => {
    if (event.key === KEY) set(event.newValue, false);
  });
  // Rerender icons for dynamically created room/exam buttons.
  function watch() {
    render();
    const mount = document.getElementById('view') || document.body;
    if (!mount || typeof MutationObserver === 'undefined') return;
    new MutationObserver(records => {
      if (records.some(item => Array.from(item.addedNodes).some(node => node.nodeType === 1 && (node.matches?.(BUTTON) || node.querySelector?.(BUTTON))))) render();
    }).observe(mount,{childList:true,subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch, {once:true});
  else watch();
  window.ExamLabTheme = {version:6,get:current,set,toggle,refresh:render};
  render();
})();
