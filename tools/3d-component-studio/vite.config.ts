import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({resolve:{dedupe:['three','gsap'],alias:{'@grid-baseline':fileURLToPath(new URL('../../docs/create-3d-component/component-authoring-work/n2-isolated-grid/src/core/Grid.ts',import.meta.url))}},server:{fs:{allow:[fileURLToPath(new URL('.',import.meta.url)),fileURLToPath(new URL('../../docs/create-3d-component/component-authoring-work/n2-isolated-grid',import.meta.url))]}},build:{outDir:'dist'}});
