/** Arrays are replaced atomically; before values allow conflict checking against source. */
export interface SceneChange { path: string[]; before?: unknown; after?: unknown; }
export function sceneChanges(before: unknown, after: unknown, path: string[] = []): SceneChange[] {
  if (JSON.stringify(before) === JSON.stringify(after)) { return []; }
  if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
    const a = before as Record<string, unknown>, b = after as Record<string, unknown>;
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(key => sceneChanges(a[key], b[key], [...path, key]));
  }
  return [{ path, ...(before !== undefined ? { before } : {}), ...(after !== undefined ? { after } : {}) }];
}

export async function copyChanges(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* Manual fallback below. */ }
  const dialog = document.createElement('dialog');
  const title = document.createElement('p');
  title.textContent = '自动复制不可用，请选中下方内容按 Ctrl+C，然后粘贴到对话。';
  const area = document.createElement('textarea');
  area.value = text; area.readOnly = true; area.setAttribute('aria-label', '场景修改内容');
  area.style.cssText = 'width:100%;height:260px;box-sizing:border-box';
  const close = document.createElement('button'); close.textContent = '关闭';
  close.onclick = () => dialog.close();
  dialog.onclose = () => dialog.remove();
  dialog.style.cssText = 'width:min(640px,85vw);border:1px solid #ddd;border-radius:12px;padding:20px';
  dialog.append(title, area, close); document.body.appendChild(dialog); dialog.showModal(); area.select();
  return false;
}
