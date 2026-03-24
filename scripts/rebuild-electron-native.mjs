import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronVersion = require('electron/package.json').version;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let command = 'npm';
let args = [
  'rebuild',
  'better-sqlite3',
  '--runtime=electron',
  `--target=${electronVersion}`,
  '--dist-url=https://electronjs.org/headers',
  '--build-from-source=false',
  '--update-binary=true',
];

try {
  const electronRebuildMain = require.resolve('@electron/rebuild');
  const electronRebuildCli = path.join(path.dirname(electronRebuildMain), 'cli.js');
  command = process.execPath;
  args = [
    electronRebuildCli,
    '--version',
    electronVersion,
    '--module-dir',
    repoRoot,
    '--only',
    'better-sqlite3',
    '--force',
  ];
} catch {
  // Fallback for environments where @electron/rebuild is not installed.
}

const child = spawn(command, args, {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32' && command === 'npm',
  windowsHide: process.platform === 'win32',
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
