// Async texture completions invalidate active scenes; no render loop is kept alive.
const listeners = new Set<() => void>();
export function invalidateResources(): void { listeners.forEach(cb => cb()); }
export function onResourcesChanged(cb: () => void): () => void {
  listeners.add(cb); return () => { listeners.delete(cb); };
}
