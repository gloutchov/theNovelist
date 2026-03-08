import { spawn } from 'node:child_process';

function run(command, args, { allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
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
  testExitCode = await run('npm', ['run', 'test:e2e:electron:run'], { allowFailure: true });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
} finally {
  await run('npm', ['run', 'rebuild:node-native'], { allowFailure: true });
}

process.exit(testExitCode);

