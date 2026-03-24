import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electronVersion = require('electron/package.json').version;
const rebuildEnv = {
  ...process.env,
  npm_config_runtime: 'electron',
  npm_config_target: electronVersion,
  npm_config_disturl: 'https://electronjs.org/headers',
  npm_config_build_from_source: 'false',
  npm_config_update_binary: 'true',
};

const child = spawn(
  'npm',
  ['rebuild', 'better-sqlite3'],
  {
    stdio: 'inherit',
    env: rebuildEnv,
    shell: process.platform === 'win32',
    windowsHide: process.platform === 'win32',
  },
);

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
