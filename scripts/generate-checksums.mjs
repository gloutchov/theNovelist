import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_RELEASE_DIR = 'release';
const DEFAULT_OUTPUT_NAME = 'SHA256SUMS.txt';
const CHECKSUM_EXTENSIONS = new Set([
  '.7z',
  '.appimage',
  '.blockmap',
  '.dmg',
  '.exe',
  '.msi',
  '.pkg',
  '.portable',
  '.tar.gz',
  '.tar.xz',
  '.yml',
  '.yaml',
  '.zip',
]);

function parseArgs(argv) {
  const options = {
    all: false,
    releaseDir: DEFAULT_RELEASE_DIR,
    outputName: DEFAULT_OUTPUT_NAME,
    version: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--all') {
      options.all = true;
      continue;
    }
    if (arg === '--release-dir') {
      options.releaseDir = argv[index + 1] ?? options.releaseDir;
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.outputName = argv[index + 1] ?? options.outputName;
      index += 1;
      continue;
    }
    if (arg === '--version') {
      options.version = argv[index + 1] ?? options.version;
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      console.log(
        'Uso: node scripts/generate-checksums.mjs [--release-dir release] [--output SHA256SUMS.txt] [--version X.Y.Z] [--all]',
      );
      process.exit(0);
    }
  }

  return options;
}

function normalizedRelativePath(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

function hasChecksumExtension(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tar.xz')) {
    return true;
  }
  return CHECKSUM_EXTENSIONS.has(path.extname(lower));
}

function isReleaseMetadata(name) {
  return name === 'latest.yml' || name === 'latest-mac.yml';
}

function shouldIncludeArtifact(name, options) {
  if (options.all || isReleaseMetadata(name)) {
    return true;
  }
  return Boolean(options.version && name.includes(options.version));
}

async function readPackageVersion() {
  const packageJsonPath = path.resolve('package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  return typeof packageJson.version === 'string' ? packageJson.version : null;
}

async function listChecksumFiles(rootDir, outputPath, options) {
  const result = [];
  const entries = await readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (!entry.isFile()) {
      continue;
    }
    if (path.resolve(entryPath) === path.resolve(outputPath)) {
      continue;
    }
    if (entry.name.toLowerCase().startsWith('builder-')) {
      continue;
    }
    if (!shouldIncludeArtifact(entry.name, options)) {
      continue;
    }
    if (hasChecksumExtension(entryPath)) {
      result.push(entryPath);
    }
  }

  return result.sort((left, right) =>
    normalizedRelativePath(rootDir, left).localeCompare(
      normalizedRelativePath(rootDir, right),
      'en',
    ),
  );
}

async function sha256(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

export async function generateChecksums(options = {}) {
  const releaseDir = path.resolve(options.releaseDir ?? DEFAULT_RELEASE_DIR);
  const outputPath = path.resolve(releaseDir, options.outputName ?? DEFAULT_OUTPUT_NAME);
  const version = options.version ?? (options.all ? null : await readPackageVersion());

  await mkdir(releaseDir, { recursive: true });
  const files = await listChecksumFiles(releaseDir, outputPath, {
    all: Boolean(options.all),
    version,
  });
  const lines = [];
  for (const filePath of files) {
    lines.push(`${await sha256(filePath)}  ${normalizedRelativePath(releaseDir, filePath)}`);
  }
  await writeFile(outputPath, `${lines.join('\n')}${lines.length > 0 ? '\n' : ''}`, 'utf8');

  return {
    outputPath,
    fileCount: files.length,
  };
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  const options = parseArgs(process.argv.slice(2));
  generateChecksums(options)
    .then((result) => {
      console.log(`Checksum generati: ${result.fileCount} file -> ${result.outputPath}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
