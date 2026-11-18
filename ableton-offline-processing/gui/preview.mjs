import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { mockSession } from './mock.mjs';

const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/editor.js', ['editor.js', 'text/javascript; charset=utf-8']],
  ['/editor.css', ['editor.css', 'text/css; charset=utf-8']],
]);

export function startPreview({ port = 0 } = {}) {
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const file = staticFiles.get(request.url);
    try {
      if (request.method === 'GET' && file) {
        const [name, contentType] = file;
        const body = await readFile(new URL(name, import.meta.url));
        response.setHeader('Content-Type', contentType);
        response.end(body);
      } else if (request.method === 'GET' && request.url === '/api/session') {
        sendJson(response, 200, mockSession);
      } else {
        sendJson(response, 404, { message: 'Page unavailable' });
      }
    } catch {
      sendJson(response, 500, { message: 'Preview files unavailable' });
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

function sendJson(response, code, payload) {
  response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { url } = await startPreview({ port: 8048 });
  console.log(`Offline Processing Suite preview: ${url}`);
}
