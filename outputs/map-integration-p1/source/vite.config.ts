import { fileURLToPath, URL } from 'node:url';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

/** 贴图上传扩展名白名单 */
const TEXTURE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);
const TEXTURE_DIR = fileURLToPath(new URL('./public/scene3d/assets/textures', import.meta.url));

/**
 * dev-only 贴图上传端点：
 * POST /__scene3d/upload-texture（binary body + x-filename 头，文件名 encodeURIComponent 编码）。
 * 扩展名白名单 + 文件名 sanitize（防路径穿越）+ 重名自动后缀 → 写 public/scene3d/assets/textures/ → 返回相对 URL。
 * apply='serve' 保证不进 build 产物。
 */
const textureUploadPlugin = (): Plugin => ({
  name: 'scene3d-texture-upload',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__scene3d/upload-texture', (req, res, next) => {
      if (req.method !== 'POST') {
        next();
        return;
      }
      const raw = decodeURIComponent(String(req.headers['x-filename'] ?? 'texture.png'));
      const ext = path.extname(raw).toLowerCase();
      if (!TEXTURE_EXT.has(ext)) {
        res.statusCode = 415;
        res.end(JSON.stringify({ error: 'unsupported texture extension' }));
        return;
      }
      const base = path.basename(raw, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'texture';
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        void (async () => {
          const body = Buffer.concat(chunks);
          await mkdir(TEXTURE_DIR, { recursive: true });
          let name = `${base}${ext}`;
          let suffix = 1;
          for (;;) {
            try {
              await writeFile(path.join(TEXTURE_DIR, name), body, { flag: 'wx' });
              break;
            } catch (err) {
              if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
                name = `${base}-${suffix}${ext}`;
                suffix += 1;
              } else {
                throw err;
              }
            }
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ url: `scene3d/assets/textures/${name}` }));
        })().catch((err: unknown) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        });
      });
    });
  },
});

/** Local dev only: fixed target, same-origin requests, bounded JSON, atomic replacement. */
const sceneSavePlugin = (): Plugin => ({
  name: 'scene3d-save-scene',
  apply: 'serve',
  handleHotUpdate(context) {
    if (path.resolve(context.file) === fileURLToPath(new URL('./public/scene3d/scene-data.json', import.meta.url))) { return []; }
  },
  configureServer(server) {
    server.middlewares.use('/__scene3d/save-scene', (req, res) => {
      if (req.method !== 'POST' || req.headers['content-type'] !== 'application/json'
        || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) {
        res.statusCode = 403; res.end(); return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size <= 32 * 1024 * 1024) { chunks.push(chunk); }
      });
      req.on('end', () => {
        void (async () => {
          if (size > 32 * 1024 * 1024) { res.statusCode = 413; res.end(); return; }
          const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (!data.scene || !data.camera || !data.controls || !data.renderer || !Array.isArray(data.lights)) {
            res.statusCode = 400; res.end(); return;
          }
          const target = fileURLToPath(new URL('./public/scene3d/scene-data.json', import.meta.url));
          const temp = `${target}.${crypto.randomUUID()}.tmp`;
          await writeFile(temp, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
          await rename(temp, target);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ saved: true }));
        })().catch(() => { res.statusCode = 500; res.end(); });
      });
    });
  },
});

export default defineConfig({
  cacheDir: fileURLToPath(new URL('./.cache/vite', import.meta.url)),
  plugins: [vue(), textureUploadPlugin(), sceneSavePlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5183,
  },
});
