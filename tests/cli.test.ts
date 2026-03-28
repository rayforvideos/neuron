import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, existsSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { compile } from '../src/compiler';
import { scaffold } from '../src/scaffold';
import { run } from '../src/cli';

const TMP = join(__dirname, '.tmp-cli-test');

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('neuron build (via compiler)', () => {
  it('builds a project directory into dist/', () => {
    const projectDir = join(TMP, 'test-shop');
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(join(projectDir, 'pages'), { recursive: true });
    mkdirSync(join(projectDir, 'apis'), { recursive: true });
    mkdirSync(join(projectDir, 'themes'), { recursive: true });

    writeFileSync(join(projectDir, 'neuron.json'), JSON.stringify({ name: 'test-shop' }));
    writeFileSync(join(projectDir, 'app.neuron'), `STATE\n  cart: []\n  products: []\n\n---\n\nACTION add-to-cart\n  append: product -> cart`);
    writeFileSync(join(projectDir, 'pages', 'home.neuron'), `PAGE home "홈" /\n\n  header\n    title: "Test"\n\n  footer\n    text: "© 2026"`);
    writeFileSync(join(projectDir, 'apis', 'products.neuron'), `API products\n  GET /api/products\n  on_load: true`);
    writeFileSync(join(projectDir, 'themes', 'theme.json'), JSON.stringify({
      colors: { primary: '#000', secondary: '#111', danger: '#f00', bg: '#fff', text: '#000', border: '#ccc' },
      font: { family: 'Arial', size: { sm: 12, md: 14, lg: 18, xl: 24 } },
      radius: 4, shadow: 'none', spacing: { sm: 4, md: 8, lg: 16, xl: 32 },
    }));

    const result = compile({
      appFile: join(projectDir, 'app.neuron'),
      pageFiles: [join(projectDir, 'pages', 'home.neuron')],
      apiFiles: [join(projectDir, 'apis', 'products.neuron')],
      themeFile: join(projectDir, 'themes', 'theme.json'),
      appTitle: 'test-shop',
    });

    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.css).toContain('--color-primary');
    expect(result.js).toContain('_state');
    expect(result.errors).toEqual([]);
  });
});

describe('neuron new (via scaffold)', () => {
  it('neuron new creates logic/ directory', () => {
    scaffold('my-project', TMP);
    const logicDir = join(TMP, 'my-project', 'logic');
    expect(existsSync(logicDir)).toBe(true);
  });
});

describe('neuron dev (CLI help)', () => {
  it('shows dev command in help', () => {
    const originalLog = console.log;
    const output: string[] = [];
    console.log = (...args: any[]) => output.push(args.join(' '));
    run([]);
    console.log = originalLog;
    expect(output.some(line => line.includes('dev'))).toBe(true);
  });
});
