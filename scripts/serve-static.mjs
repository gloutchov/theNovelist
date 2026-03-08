import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const [, , rootArg = 'out/renderer', portArg = '4173'] = process.argv;
const cwd = process.cwd();
const rootDir = path.resolve(cwd, rootArg);
const port = Number(portArg);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function resolveFilePath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  const safePath = decodedPath === '/' ? '/index.html' : decodedPath;
  const candidate = path.resolve(rootDir, `.${safePath}`);

  if (!candidate.startsWith(rootDir)) {
    return null;
  }

  return candidate;
}

const server = createServer(async (req, res) => {
  const requestPath = req.url ?? '/';
  const resolvedPath = resolveFilePath(requestPath);

  if (!resolvedPath) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  try {
    const file = await readFile(resolvedPath);
    const extension = path.extname(resolvedPath);
    res.setHeader('Content-Type', mimeTypes[extension] ?? 'application/octet-stream');
    res.statusCode = 200;
    res.end(file);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Serving ${rootDir} on http://127.0.0.1:${port}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
