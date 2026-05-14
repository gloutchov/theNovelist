import { spawn } from 'node:child_process';

const npmInvocation = process.env.npm_execpath
  ? { command: process.execPath, argsPrefix: [process.env.npm_execpath] }
  : { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', argsPrefix: [] };

function run(command, args, { allowFailure = false, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, {
        stdio: 'inherit',
        env,
      });
    } catch (error) {
      if (!allowFailure) {
        reject(error);
        return;
      }
      console.error(error instanceof Error ? error.message : String(error));
      resolve(1);
      return;
    }

    child.on('exit', (code) => {
      const exitCode = code ?? 1;
      if (!allowFailure && exitCode !== 0) {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${exitCode}`));
        return;
      }
      resolve(exitCode);
    });

    child.on('error', (error) => {
      if (!allowFailure) {
        reject(error);
        return;
      }
      console.error(error instanceof Error ? error.message : String(error));
      resolve(1);
    });
  });
}

function runNpm(args, options) {
  return run(npmInvocation.command, [...npmInvocation.argsPrefix, ...args], options);
}

let testExitCode = 1;

try {
  await runNpm(['run', 'rebuild:electron-native']);
  await runNpm(['run', 'build']);
  testExitCode = await runNpm(
    [
      'exec',
      '--',
      'playwright',
      'test',
      '-c',
      'playwright.electron.config.ts',
      'tests/e2e/electron-smoke.spec.ts',
    ],
    {
      allowFailure: true,
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: '.playwright-browsers',
      },
    },
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
} finally {
  await runNpm(['run', 'rebuild:node-native'], { allowFailure: true });
}

process.exit(testExitCode);
