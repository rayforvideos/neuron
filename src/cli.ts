import { resolve, join, basename } from 'path';
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync, copyFileSync } from 'fs';
import { compile } from './compiler';
import { scaffold } from './scaffold';
import { startDevServer } from './dev-server';

export function run(args: string[]): void {
  const command = args[0];

  if (command === 'new') {
    const projectName = args[1];
    if (!projectName) {
      console.error('Usage: neuron new <project-name>');
      process.exit(1);
    }
    const themeIdx = args.indexOf('--theme');
    const themePreset = themeIdx !== -1 && args[themeIdx + 1] ? args[themeIdx + 1] : undefined;
    scaffold(projectName, process.cwd(), themePreset);
    console.log(`Created project: ${projectName}/`);
    return;
  }

  if (command === 'build') {
    const projectDir = resolve(process.cwd());
    const appFile = join(projectDir, 'app.neuron');

    if (!existsSync(appFile)) {
      console.error('[NEURON ERROR] app.neuron not found in current directory');
      process.exit(1);
    }

    // Discover page files
    const pagesDir = join(projectDir, 'pages');
    const pageFiles = existsSync(pagesDir)
      ? readdirSync(pagesDir).filter(f => f.endsWith('.neuron')).map(f => join(pagesDir, f))
      : [];

    // Discover API files
    const apisDir = join(projectDir, 'apis');
    const apiFiles = existsSync(apisDir)
      ? readdirSync(apisDir).filter(f => f.endsWith('.neuron')).map(f => join(apisDir, f))
      : [];

    // Find theme
    const themeFile = join(projectDir, 'themes', 'theme.json');
    const themeArg = existsSync(themeFile) ? themeFile : null;

    // Read project name from neuron.json (using readFileSync, NOT require)
    let appTitle = basename(projectDir);
    const neuronJson = join(projectDir, 'neuron.json');
    if (existsSync(neuronJson)) {
      try {
        const config = JSON.parse(readFileSync(neuronJson, 'utf-8'));
        appTitle = config.name || appTitle;
      } catch {}
    }

    const result = compile({ appFile, pageFiles, apiFiles, themeFile: themeArg, appTitle });

    if (result.errors.length > 0) {
      result.errors.forEach(e => console.error(e));
    }

    // Write dist/
    const distDir = join(projectDir, 'dist');
    mkdirSync(distDir, { recursive: true });
    mkdirSync(join(distDir, 'assets'), { recursive: true });
    writeFileSync(join(distDir, 'index.html'), result.html);
    writeFileSync(join(distDir, 'style.css'), result.css);
    writeFileSync(join(distDir, 'main.js'), result.js);

    // Copy assets/ to dist/assets/
    const assetsDir = join(projectDir, 'assets');
    if (existsSync(assetsDir)) {
      const assetFiles = readdirSync(assetsDir);
      for (const file of assetFiles) {
        copyFileSync(join(assetsDir, file), join(distDir, 'assets', file));
      }
    }

    // Generate serve.js for SPA routing
    const serveJs = `const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DIST = __dirname;

const MIME = {
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

http.createServer(function(req, res) {
  var url = req.url.split('?')[0];
  var filePath = path.join(DIST, url);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    var ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(path.join(DIST, 'index.html')).pipe(res);
  }
}).listen(PORT, function() {
  console.log('Neuron app running at http://localhost:' + PORT);
});
`;
    writeFileSync(join(distDir, 'serve.js'), serveJs);

    console.log(`Build complete → dist/`);
    console.log(`  index.html (${result.html.length} bytes)`);
    console.log(`  style.css  (${result.css.length} bytes)`);
    console.log(`  main.js    (${result.js.length} bytes)`);
    console.log(`  serve.js   (SPA server)`);
    console.log(`\nRun: node dist/serve.js`);
    return;
  }

  if (command === 'dev') {
    const projectDir = resolve(process.cwd());
    const appFile = join(projectDir, 'app.neuron');

    if (!existsSync(appFile)) {
      console.error('[NEURON ERROR] app.neuron not found in current directory');
      process.exit(1);
    }

    let port = 3000;
    const portIdx = args.indexOf('--port');
    if (portIdx !== -1 && args[portIdx + 1]) {
      port = parseInt(args[portIdx + 1], 10);
    }

    startDevServer({ port, projectDir });
    return;
  }

  console.log('Neuron DSL Compiler');
  console.log('');
  console.log('Commands:');
  console.log('  neuron new <name>   Create a new project');
  console.log('  neuron build        Build the current project');
  console.log('  neuron dev          Start dev server with live reload');
}
