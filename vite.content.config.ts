import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// 正文抽取脚本：单独打成 IIFE，固定输出 dist/content-extract.js，
// 供 chrome.scripting.executeScript({ files: ['content-extract.js'] }) 按需注入。
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2020',
    lib: {
      entry: fileURLToPath(new URL('./src/content/extract.ts', import.meta.url)),
      name: 'DigestExtract',
      formats: ['iife'],
      fileName: () => 'content-extract.js',
    },
  },
});
