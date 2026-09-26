import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Checksum published by whisper.cpp in models/README.md for the multilingual tiny model.
const expectedSha1 = 'bd577a113a864445d4c299885e0cb97d4ba92b5f';
const maxBytes = 90 * 1024 * 1024;
const fileName = 'ggml-tiny.bin';
const directory =
  process.env.NOVELIST_WHISPER_MODEL_DIR || path.join(os.homedir(), '.the-novelist', 'whisper');
const target = path.join(directory, fileName);

async function sha1(file) {
  const hash = createHash('sha1');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function responseAt(url, redirects = 0) {
  if (redirects > 5 || new URL(url).protocol !== 'https:')
    throw new Error('Invalid download redirect');
  const response = await new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 30_000 }, resolve);
    request.once('error', reject);
    request.once('timeout', () => request.destroy(new Error('Download timed out')));
  });
  if (
    response.statusCode === 301 ||
    response.statusCode === 302 ||
    response.statusCode === 303 ||
    response.statusCode === 307 ||
    response.statusCode === 308
  ) {
    const location = response.headers.location;
    response.resume();
    if (!location) throw new Error('Download redirect without location');
    return responseAt(new URL(location, url).toString(), redirects + 1);
  }
  if (response.statusCode !== 200) {
    response.resume();
    throw new Error(`Model download failed (HTTP ${response.statusCode})`);
  }
  return response;
}

await fs.mkdir(directory, { recursive: true, mode: 0o700 });
if (
  await fs
    .stat(target)
    .then((stat) => stat.isFile())
    .catch(() => false)
) {
  if ((await sha1(target)) === expectedSha1) {
    process.stdout.write(`Verified model already installed: ${target}\n`);
    process.exit(0);
  }
  throw new Error(`Existing model checksum differs; inspect or remove: ${target}`);
}

const temporary = `${target}.${process.pid}.download`;
try {
  const response = await responseAt(
    'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  );
  let bytes = 0;
  const limit = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      callback(bytes > maxBytes ? new Error('Model exceeds size limit') : null, chunk);
    },
  });
  await pipeline(response, limit, createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
  if ((await sha1(temporary)) !== expectedSha1) throw new Error('Model checksum mismatch');
  await fs.rename(temporary, target);
  process.stdout.write(`Verified multilingual Whisper model: ${target}\n`);
} finally {
  await fs.rm(temporary, { force: true }).catch(() => undefined);
}
