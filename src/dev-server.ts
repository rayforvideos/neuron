import { createServer, IncomingMessage, ServerResponse } from 'http';
import { createHash } from 'crypto';
import { readFileSync, existsSync, statSync, watch, mkdirSync, writeFileSync, readdirSync, copyFileSync } from 'fs';
import { join, extname, basename } from 'path';
import { compile } from './compiler';
import type { Socket } from 'net';

export interface DevServerOptions {
  port: number;
  projectDir: string;
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function encodeWSFrame(message: string): Buffer {
  const payload = Buffer.from(message, 'utf-8');
  const frame = Buffer.alloc(2 + payload.length);
  frame[0] = 0x81;
  frame[1] = payload.length;
  payload.copy(frame, 2);
  return frame;
}

export function startDevServer(options: DevServerOptions): void {
  const { port, projectDir } = options;
  const distDir = join(projectDir, 'dist');
  const clients = new Set<Socket>();

  function rebuild(): boolean {
    const appFile = join(projectDir, 'app.neuron');
    if (!existsSync(appFile)) {
      console.error('[NEURON DEV] app.neuron not found');
      return false;
    }

    const pagesDir = join(projectDir, 'pages');
    const pageFiles = existsSync(pagesDir)
      ? readdirSync(pagesDir).filter(f => f.endsWith('.neuron')).map(f => join(pagesDir, f))
      : [];

    const apisDir = join(projectDir, 'apis');
    const apiFiles = existsSync(apisDir)
      ? readdirSync(apisDir).filter(f => f.endsWith('.neuron')).map(f => join(apisDir, f))
      : [];

    const themeFile = join(projectDir, 'themes', 'theme.json');
    const themeArg = existsSync(themeFile) ? themeFile : null;

    let appTitle = basename(projectDir);
    const neuronJson = join(projectDir, 'neuron.json');
    if (existsSync(neuronJson)) {
      try {
        const config = JSON.parse(readFileSync(neuronJson, 'utf-8'));
        appTitle = config.name || appTitle;
      } catch {}
    }

    const result = compile({
      appFile,
      pageFiles,
      apiFiles,
      themeFile: themeArg,
      appTitle,
      devMode: true,
    });

    if (result.errors.length > 0) {
      result.errors.forEach(e => console.error(e));
    }

    mkdirSync(distDir, { recursive: true });
    mkdirSync(join(distDir, 'assets'), { recursive: true });
    writeFileSync(join(distDir, 'index.html'), result.html);
    writeFileSync(join(distDir, 'style.css'), result.css);
    writeFileSync(join(distDir, 'main.js'), result.js);

    const assetsDir = join(projectDir, 'assets');
    if (existsSync(assetsDir)) {
      for (const file of readdirSync(assetsDir)) {
        copyFileSync(join(assetsDir, file), join(distDir, 'assets', file));
      }
    }

    return result.errors.length === 0;
  }

  console.log('[NEURON DEV] Building...');
  rebuild();

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = (req.url || '/').split('?')[0];
    const filePath = join(distDir, url);

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const ext = extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(readFileSync(filePath));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(readFileSync(join(distDir, 'index.html')));
    }
  });

  server.on('upgrade', (req: IncomingMessage, socket: Socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }

    const accept = createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-5AB5DC85B178')
      .digest('base64');

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n` +
      '\r\n'
    );

    clients.add(socket);
    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function onFileChange(filename: string | null) {
    if (filename && (filename.includes('dist') || filename.includes('node_modules'))) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(`[NEURON DEV] File changed${filename ? ': ' + filename : ''}, rebuilding...`);
      const ok = rebuild();
      if (ok) {
        console.log('[NEURON DEV] Build complete, reloading browser...');
        const frame = encodeWSFrame('reload');
        for (const client of clients) {
          try { client.write(frame); } catch {}
        }
      } else {
        console.log('[NEURON DEV] Build had errors, skipping reload.');
      }
    }, 300);
  }

  try {
    watch(projectDir, { recursive: true }, (_event, filename) => {
      onFileChange(filename ? String(filename) : null);
    });
  } catch {
    const dirs = ['pages', 'apis', 'logic', 'themes', 'assets'];
    watch(join(projectDir, 'app.neuron'), () => onFileChange('app.neuron'));
    for (const dir of dirs) {
      const dirPath = join(projectDir, dir);
      if (existsSync(dirPath)) {
        watch(dirPath, { recursive: false }, (_event, filename) => {
          onFileChange(filename ? String(filename) : null);
        });
      }
    }
  }

  server.listen(port, () => {
    console.log(`[NEURON DEV] Dev server running at http://localhost:${port}`);
    console.log('[NEURON DEV] Watching for changes...');
  });
}
