import { spawn } from 'node:child_process';

function run(command, args, { allowFailure = false, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env,
    });

    child.on('exit', (code) => {
      const exitCode = code ?? 1;
      if (!allowFailure && exitCode !== 0) {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${exitCode}`));
        return;
      }
      resolve(exitCode);
    });
  });
}

let testExitCode = 1;

try {
  await run('npm', ['run', 'rebuild:electron-native']);
  await run('npm', ['run', 'build']);
  testExitCode = await run(
    'npx',
    ['playwright', 'test', '-c', 'playwright.electron.config.ts', 'tests/e2e/electron-codex-smoke.spec.ts'],
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
  await run('npm', ['run', 'rebuild:node-native'], { allowFailure: true });
}

process.exit(testExitCode);
