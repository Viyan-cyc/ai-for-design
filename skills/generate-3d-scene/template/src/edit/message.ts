/** A single, non-blocking toast. Only failures use an error accent. */
let dismissTimer: ReturnType<typeof setTimeout> | undefined;
export const showEditorMessage = (message: string): void => {
  if (dismissTimer) { clearTimeout(dismissTimer); }
  document.getElementById('editor-file-message')?.remove();
  const error = /失败|错误/.test(message);
  const panel = document.createElement('div');
  panel.id = 'editor-file-message';
  panel.setAttribute('role', error ? 'alert' : 'status');
  panel.style.cssText = 'position:fixed;bottom:76px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;align-items:center;gap:12px;box-sizing:border-box;background:rgba(255,255,255,.98);color:#334155;padding:12px 14px;border:1px solid #e5e9ef;border-radius:12px;box-shadow:0 6px 24px rgba(24,39,64,.10);max-width:min(560px,calc(100vw - 32px));font:13px/1.6 system-ui,sans-serif;overflow-wrap:anywhere';
  const icon = document.createElement('span');
  icon.textContent = error ? '!' : 'i';
  icon.setAttribute('aria-hidden', 'true');
  icon.style.cssText = `flex-shrink:0;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;font-weight:600;background:${error ? '#fff1f0' : '#edf3ff'};color:${error ? '#c43b32' : '#3d7eff'}`;
  const text = document.createElement('span'); text.textContent = message;
  const close = document.createElement('button');
  close.textContent = '×'; close.setAttribute('aria-label', '关闭提示');
  close.style.cssText = 'flex-shrink:0;border:0;background:transparent;color:#64748b;border-radius:6px;width:28px;height:28px;cursor:pointer;font-size:20px';
  const dismiss = (): void => { clearTimeout(dismissTimer); panel.remove(); };
  close.onclick = dismiss;
  const schedule = (): void => { clearTimeout(dismissTimer); dismissTimer = setTimeout(dismiss, error ? 10000 : 6000); };
  panel.onmouseenter = () => clearTimeout(dismissTimer);
  panel.onmouseleave = schedule;
  panel.addEventListener('focusin', () => clearTimeout(dismissTimer));
  panel.addEventListener('focusout', schedule);
  panel.append(icon, text, close); document.body.append(panel); schedule();
};
