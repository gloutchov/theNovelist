import { spawn } from 'node:child_process';

const child = spawn(
  'npm',
  ['rebuild', 'better-sqlite3'],
  {
    stdio: 'inherit',
    env: process.env,
  },
);

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
