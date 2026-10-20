/** Non-modal feedback for file operations; reusable and dismissible. */
export const showEditorMessage = (message: string): void => {
  document.getElementById('editor-file-message')?.remove();
  const panel = document.createElement('div');
  panel.id = 'editor-file-message';
  panel.setAttribute('role', 'alert');
  panel.style.cssText =
    'position:fixed;bottom:24px;left:24px;z-index:99999;background:#fff;color:#9b241c;padding:16px;border:1px solid #ddd;max-width:70vw';
  panel.append(document.createTextNode(message));
  const close = document.createElement('button');
  close.textContent = '关闭';
  close.style.marginLeft = '16px';
  close.onclick = () => panel.remove();
  panel.append(close);
  document.body.append(panel);
};
