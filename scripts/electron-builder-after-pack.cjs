/* global require, module, process, setTimeout */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { spawn } = require('node:child_process');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('node:path');

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if ((code ?? 1) !== 0) {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 1}`));
        return;
      }

      resolve();
    });
  });
}

async function runWithRetry(command, args, attempts = 5) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await run(command, args);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        break;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, attempt * 1000);
      });
    }
  }

  throw lastError;
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  // When cross-building Windows artifacts from macOS/Linux, rcedit.exe is not runnable directly.
  // Skip this post-step and rely on electron-builder's native Windows metadata where available.
  if (process.platform !== 'win32') {
    return;
  }

  const appInfo = context.packager?.appInfo;
  const productFilename = appInfo?.productFilename || 'The Novelist';
  const executablePath = path.join(context.appOutDir, `${productFilename}.exe`);
  const iconPath = path.join(context.packager.projectDir, 'build', 'icon.ico');
  const rceditPath = path.join(
    context.packager.projectDir,
    'node_modules',
    'electron-winstaller',
    'vendor',
    'rcedit.exe',
  );

  await runWithRetry(rceditPath, [
    executablePath,
    '--set-icon',
    iconPath,
    '--set-file-version',
    appInfo.version,
    '--set-product-version',
    appInfo.version,
    '--set-version-string',
    'ProductName',
    appInfo.productName,
    '--set-version-string',
    'FileDescription',
    appInfo.productName,
    '--set-version-string',
    'InternalName',
    productFilename,
    '--set-version-string',
    'OriginalFilename',
    `${productFilename}.exe`,
  ]);
};
