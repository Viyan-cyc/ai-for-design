import { computed, readonly, ref } from 'vue'

// Create once in the application shell; pass state/actions to theme controls.
export function createThemeState({ names = ['default', 'dark'], storageKey = 'uxproto-theme' } = {}) {
  const allowed = new Set(names)
  if (!allowed.has('default') || !allowed.has('dark')) throw new Error('Theme names must include default and dark')
  const theme = ref('default')
  const setTheme = (name) => {
    if (!allowed.has(name)) throw new Error('Unknown theme: ' + name)
    document.documentElement.setAttribute('data-theme', name)
    theme.value = name
    try { localStorage.setItem(storageKey, name) } catch {}
  }
  let initial = document.documentElement.getAttribute('data-theme')
  try {
    const saved = localStorage.getItem(storageKey)
    if (allowed.has(saved)) initial = saved
  } catch {}
  setTheme(allowed.has(initial) ? initial : 'default')
  return {
    theme: readonly(theme),
    isDark: computed(() => theme.value === 'dark'),
    setTheme,
    toggleTheme: () => setTheme(theme.value === 'dark' ? 'default' : 'dark'),
  }
}
