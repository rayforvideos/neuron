import { resolve, join, basename } from 'path';
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from 'fs';
import { compile } from './compiler';
import { scaffold } from './scaffold';

export function run(args: string[]): void {
  const command = args[0];

  if (command === 'new') {
    const projectName = args[1];
    if (!projectName) {
      console.error('Usage: neuron new <project-name>');
      process.exit(1);
    }
    scaffold(projectName, process.cwd());
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

    console.log(`Build complete → dist/`);
    console.log(`  index.html (${result.html.length} bytes)`);
    console.log(`  style.css  (${result.css.length} bytes)`);
    console.log(`  main.js    (${result.js.length} bytes)`);
    return;
  }

  console.log('Neuron DSL Compiler');
  console.log('');
  console.log('Commands:');
  console.log('  neuron new <name>   Create a new project');
  console.log('  neuron build        Build the current project');
}
