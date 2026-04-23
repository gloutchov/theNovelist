import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function shouldUseShell(command) {
  return process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
}

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env,
      shell: shouldUseShell(command),
    });

    child.on('error', reject);
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
if (mode !== '--dir' && mode !== '--mac' && mode !== '--win') {
  console.error('Usage: node scripts/run-electron-package.mjs [--dir|--mac|--win]');
  process.exit(1);
}

const electronBuilderCli = require.resolve('electron-builder/out/cli/cli.js');
const builderArgs =
  mode === '--dir'
    ? ['--dir', '--publish', 'never']
    : mode === '--mac'
      ? ['--mac', '--publish', 'never']
      : ['--win', '--publish', 'never'];
const packagingEnv = {
  ...process.env,
  CSC_IDENTITY_AUTO_DISCOVERY: 'false',
};

try {
  const npmCommand = getNpmCommand();
  await run(npmCommand, ['run', 'rebuild:electron-native']);
  await run(npmCommand, ['run', 'build']);
  await run(process.execPath, [electronBuilderCli, ...builderArgs], packagingEnv);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  try {
    await run(getNpmCommand(), ['run', 'rebuild:node-native']);
  } catch (error) {
    console.warn(
      `Warning: failed to restore node-native dependencies after packaging: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
