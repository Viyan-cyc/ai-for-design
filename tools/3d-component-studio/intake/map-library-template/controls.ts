export type Sync = () => void;
export function panel(root: HTMLElement) {
  const syncs: Sync[] = [];
  root.style.maxWidth = '250px';
  root.style.width = 'min(250px, 44%)';
  const status = document.createElement('p'); status.className = 'info'; status.role = 'status'; root.append(status);
  function run(fn: () => void) { try { fn(); status.textContent = ''; } catch (e) { status.textContent = String(e); } sync(); }
  function sync() { syncs.forEach(f => f()); }
  function range(key: string, title: string, min: number, max: number, step: number, get: () => number, set: (n: number) => void, unit = '') {
    const label = document.createElement('label'), text = document.createElement('span'), value = document.createElement('code'), input = document.createElement('input');
    text.append(title + ' ', value); input.type = 'range'; input.dataset.control = key; input.min = String(min); input.max = String(max); input.step = String(step); input.setAttribute('aria-label', title);
    label.append(text, input); root.append(label);
    input.oninput = () => run(() => set(Number(input.value)));
    syncs.push(() => { input.value = String(get()); value.textContent = Number(get().toFixed(2)) + unit; }); return input;
  }
  function select(key: string, title: string, choices: Record<string, string>, get: () => string, set: (s: string) => void) {
    const label = document.createElement('label'), input = document.createElement('select'); input.dataset.control = key; input.setAttribute('aria-label', title);
    for (const [value, text] of Object.entries(choices)) { const option = document.createElement('option'); option.value = value; option.textContent = text; input.append(option); }
    label.append(title, input); root.append(label); input.onchange = () => run(() => set(input.value)); syncs.push(() => { input.value = get(); });
  }
  function check(key: string, title: string, get: () => boolean, set: (b: boolean) => void) {
    const label = document.createElement('label'), input = document.createElement('input'); label.className = 'check'; input.type = 'checkbox'; input.dataset.control = key;
    label.append(input, title); root.append(label); input.onchange = () => run(() => set(input.checked)); syncs.push(() => { input.checked = get(); });
  }
  function color(key: string, title: string, get: () => string, set: (c: string) => void, parent = root) {
    const label = document.createElement('label'), input = document.createElement('input'); label.className = 'check'; input.type = 'color'; input.dataset.control = key; input.title = title; input.setAttribute('aria-label', title);
    label.append(title, input); parent.append(label); input.oninput = () => run(() => set(input.value)); syncs.push(() => { input.value = get(); input.title = title + ': ' + get(); });
  }
  function button(key: string, text: string, action: () => void) { const b = document.createElement('button'); b.dataset.action = key; b.textContent = text; b.onclick = () => run(action); root.append(b); }
  function info(text: string) { const p = document.createElement('p'); p.className = 'info'; p.textContent = text; root.append(p); }
  return { range, select, check, color, button, info, sync, status };
}

export function stageFor(canvas: HTMLCanvasElement) {
  const host = document.createElement('div'); host.className = 'restored-stage'; host.style.cssText = 'position:relative;width:100%;height:560px;min-width:0;';
  canvas.replaceWith(host); return host;
}
