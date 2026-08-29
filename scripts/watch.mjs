// 同时 watch 主构建与内容脚本构建（改代码后到 chrome://extensions 点刷新即可）
import { spawn } from 'node:child_process';

const procs = [
  spawn('npx', ['vite', 'build', '--watch'], { stdio: 'inherit', shell: true }),
  spawn('npx', ['vite', 'build', '--watch', '--config', 'vite.content.config.ts'], {
    stdio: 'inherit',
    shell: true,
  }),
];

let code = 0;
for (const p of procs) {
  p.on('exit', (c) => {
    code = code || (c ?? 0);
  });
}
process.on('SIGINT', () => {
  for (const p of procs) p.kill();
  process.exit(code);
});
