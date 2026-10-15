import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Independent real-project build: plain Vite + @vitejs/plugin-vue.
// Deliberately does NOT use the skill's build.mjs — this is standalone evidence
// that the generated barrel + rewritten page import compile in a real bundler.
export default defineConfig({
  plugins: [vue()],
});
