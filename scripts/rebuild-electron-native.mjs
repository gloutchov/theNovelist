import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electronVersion = require('electron/package.json').version;

const child = spawn(
  'npm',
  [
    'rebuild',
    'better-sqlite3',
    '--runtime=electron',
    `--target=${electronVersion}`,
    '--dist-url=https://electronjs.org/headers',
    '--build-from-source=false',
  ],
  {
  stdio: 'inherit',
  env: process.env,
},
);

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
