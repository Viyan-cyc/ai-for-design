import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: { entry: 'src/index.ts', name: 'GDesignEnterprise', fileName: 'g-design-enterprise' },
    rollupOptions: {
      external: ['vue', 'element-plus'],
      output: { exports: 'named', globals: { vue: 'Vue', 'element-plus': 'ElementPlus' } }
    }
  }
})
