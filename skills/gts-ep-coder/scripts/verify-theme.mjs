// Maintenance-only state tests; no page mounting or browser checks.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./preview/theme-scaffold/index.js', import.meta.url), 'utf8')
  .replace("import { computed, readonly, ref } from 'vue'", 'const { computed, readonly, ref } = Vue')
  .replace('export function createThemeState', 'function createThemeState');
const vue = fs.readFileSync(new URL('./preview/public/library/vue.global.prod.js', import.meta.url), 'utf8');
function setup(saved, current = 'default', blocked = false, options) {
  let attribute = current;
  const context = vm.createContext({});
  vm.runInContext(vue, context);
  Object.assign(context, {
    document: { documentElement: {
      getAttribute: () => attribute,
      setAttribute: (_, value) => { attribute = value; },
    } },
    localStorage: {
      getItem: () => { if (blocked) throw Error('blocked'); return saved; },
      setItem: (_, value) => { if (blocked) throw Error('blocked'); saved = value; },
    },
  });
  vm.runInContext(source, context);
  return { state: context.createThemeState(options), attribute: () => attribute, saved: () => saved };
}
const first = setup(null);
first.state.toggleTheme();
assert.equal(first.state.theme.value, 'dark');
assert.equal(first.attribute(), 'dark');
assert.equal(first.state.isDark.value, true);
first.state.toggleTheme();
assert.equal(first.attribute(), 'default');
assert.equal(first.saved(), 'default');
assert.equal(first.state.isDark.value, false);
assert.throws(() => first.state.setTheme('light'), /Unknown theme/);
assert.equal(first.attribute(), 'default');
assert.equal(setup('light', 'light').attribute(), 'default');
assert.equal(setup('dark').state.isDark.value, true);
const blocked = setup(null, 'default', true);
blocked.state.toggleTheme();
assert.equal(blocked.attribute(), 'dark');
const custom = setup('blue', 'default', false, { names: ['default', 'dark', 'blue'] });
assert.equal(custom.attribute(), 'blue');
assert.equal(custom.state.isDark.value, false);
assert.equal(setup(null).attribute(), 'default');
console.log('RESULT: OK — theme state, round trip, invalid names, persistence, blocked storage, custom skin, instance isolation');
