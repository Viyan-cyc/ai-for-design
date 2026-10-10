import { fileURLToPath, URL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

/** 贴图上传扩展名白名单 */
const TEXTURE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);
const TEXTURE_DIR = fileURLToPath(new URL('./public/assets/textures', import.meta.url));

/**
 * dev-only 贴图上传端点：
 * POST /__gts3d/upload-texture（binary body + x-filename 头，文件名 encodeURIComponent 编码）。
 * 扩展名白名单 + 文件名 sanitize（防路径穿越）+ 重名自动后缀 → 写 public/assets/textures/ → 返回相对 URL。
 * apply='serve' 保证不进 build 产物。
 */
const textureUploadPlugin = (): Plugin => ({
  name: 'gts3d-texture-upload',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__gts3d/upload-texture', (req, res, next) => {
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
          res.end(JSON.stringify({ url: `assets/textures/${name}` }));
        })().catch((err: unknown) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        });
      });
    });
  },
});

export default defineConfig({
  plugins: [vue(), textureUploadPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5183,
  },
});
