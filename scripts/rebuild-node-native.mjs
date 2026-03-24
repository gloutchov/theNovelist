import { spawn } from 'node:child_process';

const child = spawn(
  'npm',
  ['rebuild', 'better-sqlite3'],
  {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
    windowsHide: process.platform === 'win32',
  },
);

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
