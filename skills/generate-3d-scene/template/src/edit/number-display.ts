import type { ObjectDirective } from 'vue';

/** Display only. Never feed rounded values back to the model. */
export function displayNumber(value: unknown): string {
  if (value === '' || value === null || value === undefined) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (n !== 0 && Math.abs(n) < 0.001) {
    const places = Math.min(100, 3 - Math.floor(Math.log10(Math.abs(n))));
    const text = n.toFixed(places).replace(/0+$/, '').replace(/\.$/, '');
    return Number(text) === 0 ? String(n) : text;
  }
  return String(Number(n.toFixed(3)));
}
type Entry = { value: unknown; focus: () => void; blur: () => void };
const entries = new WeakMap<HTMLInputElement, Entry>();
export const vNumberDisplay: ObjectDirective<HTMLInputElement, unknown> = {
  mounted(el, binding) {
    const entry: Entry = {
      value: binding.value,
      focus: () => { el.value = entry.value == null ? '' : String(entry.value); },
      // Run after existing change/blur handlers and Vue's state update.
      blur: () => { queueMicrotask(() => {
        if (entries.has(el) && document.activeElement !== el) el.value = displayNumber(entry.value);
      }); },
    };
    entries.set(el, entry);
    el.addEventListener('focus', entry.focus);
    el.addEventListener('blur', entry.blur);
    if (document.activeElement !== el) el.value = displayNumber(binding.value);
  },
  updated(el, binding) {
    const entry = entries.get(el);
    if (entry) entry.value = binding.value;
    if (document.activeElement !== el) el.value = displayNumber(binding.value);
  },
  beforeUnmount(el) {
    const entry = entries.get(el);
    if (entry) { el.removeEventListener('focus', entry.focus); el.removeEventListener('blur', entry.blur); }
    entries.delete(el);
  },
};
