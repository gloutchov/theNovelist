import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const child = spawn(
  npmCommand,
  ['rebuild', 'better-sqlite3'],
  {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  },
);

child.on('error', (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
