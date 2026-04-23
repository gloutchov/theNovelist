/* global require, module */
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

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
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

  await run(rceditPath, [
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
