import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env,
    });

    child.on('exit', (code) => {
      const exitCode = code ?? 1;
      if (exitCode !== 0) {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${exitCode}`));
        return;
      }
      resolve();
    });
  });
}

const mode = process.argv[2];
if (mode !== '--dir' && mode !== '--mac') {
  console.error('Usage: node scripts/run-electron-package.mjs [--dir|--mac]');
  process.exit(1);
}

const electronBuilderCli = require.resolve('electron-builder/out/cli/cli.js');
const builderArgs = mode === '--dir' ? ['--dir', '--publish', 'never'] : ['--mac', '--publish', 'never'];
const packagingEnv = {
  ...process.env,
  CSC_IDENTITY_AUTO_DISCOVERY: 'false',
};

try {
  await run('npm', ['run', 'rebuild:electron-native']);
  await run('npm', ['run', 'build']);
  await run(process.execPath, [electronBuilderCli, ...builderArgs], packagingEnv);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  try {
    await run('npm', ['run', 'rebuild:node-native']);
  } catch (error) {
    console.warn(
      `Warning: failed to restore node-native dependencies after packaging: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
