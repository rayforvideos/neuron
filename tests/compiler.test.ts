import { describe, it, expect } from 'vitest';
import { compile } from '../src/compiler';
import { resolve, join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';

describe('compile', () => {
  it('compiles a project directory into HTML, CSS, and JS', () => {
    const fixtureDir = resolve(__dirname, 'fixtures');
    const result = compile({
      appFile: resolve(fixtureDir, 'app.neuron'),
      pageFiles: [resolve(fixtureDir, 'home.neuron')],
      apiFiles: [resolve(fixtureDir, 'products.neuron'), resolve(fixtureDir, 'orders.neuron')],
      themeFile: resolve(fixtureDir, 'theme.json'),
      appTitle: 'Test Shop',
    });

    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('Test Shop');
    expect(result.html).toContain('My Shop');
    expect(result.css).toContain(':root');
    expect(result.css).toContain('--color-primary');
    expect(result.js).toContain('_state');
    expect(result.js).toContain('add-to-cart');
    expect(result.js).toContain('/api/products');
  });

  it('compiles without errors for valid files with no theme', () => {
    const fixtureDir = resolve(__dirname, 'fixtures');
    const result = compile({
      appFile: resolve(fixtureDir, 'app.neuron'),
      pageFiles: [resolve(fixtureDir, 'home.neuron')],
      apiFiles: [],
      themeFile: null,
      appTitle: 'Test',
    });
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.errors).toEqual([]);
  });

  it('scans logic/ directory and passes files to generator', () => {
    const tmpDir = join(__dirname, '.tmp-compiler-logic');
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, 'pages'), { recursive: true });
    mkdirSync(join(tmpDir, 'logic'), { recursive: true });

    writeFileSync(join(tmpDir, 'app.neuron'), `STATE
  todos: []

---

ACTION add-todo
  use: logic/todos.addTodo`);

    writeFileSync(join(tmpDir, 'pages', 'home.neuron'), `PAGE home "Home" /

  text
    content: "Hello"`);

    writeFileSync(join(tmpDir, 'logic', 'todos.js'), `export function addTodo(state, text) {
  return { todos: [...state.todos, { id: Date.now(), text, done: false }] };
}`);

    const result = compile({
      appFile: join(tmpDir, 'app.neuron'),
      pageFiles: [join(tmpDir, 'pages', 'home.neuron')],
      apiFiles: [],
      themeFile: null,
      appTitle: 'Test',
    });

    expect(result.errors).toEqual([]);
    expect(result.js).toContain('_logic_todos');
    expect(result.js).toContain('addTodo');

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports error when use: references missing logic file', () => {
    const tmpDir = join(__dirname, '.tmp-compiler-missing');
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, 'pages'), { recursive: true });

    writeFileSync(join(tmpDir, 'app.neuron'), `STATE
  todos: []

---

ACTION add-todo
  use: logic/missing.addTodo`);

    writeFileSync(join(tmpDir, 'pages', 'home.neuron'), `PAGE home "Home" /

  text
    content: "Hello"`);

    const result = compile({
      appFile: join(tmpDir, 'app.neuron'),
      pageFiles: [join(tmpDir, 'pages', 'home.neuron')],
      apiFiles: [],
      themeFile: null,
      appTitle: 'Test',
    });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('logic/missing.js');

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads theme preset from neuron.json', () => {
    const tmpDir = join(__dirname, '.tmp-compiler-preset');
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, 'pages'), { recursive: true });

    writeFileSync(join(tmpDir, 'app.neuron'), `STATE
  items: []`);
    writeFileSync(join(tmpDir, 'pages', 'home.neuron'), `PAGE home "Home" /

  text
    content: "Hello"`);
    writeFileSync(join(tmpDir, 'neuron.json'), JSON.stringify({ name: 'Test', theme: 'dark' }));

    const result = compile({
      appFile: join(tmpDir, 'app.neuron'),
      pageFiles: [join(tmpDir, 'pages', 'home.neuron')],
      apiFiles: [],
      themeFile: null,
      appTitle: 'Test',
    });

    expect(result.errors).toEqual([]);
    expect(result.css).toContain('#121212');

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('scans components/ directory and renders custom components', () => {
    const tmpDir = join(__dirname, '.tmp-compiler-custom');
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, 'pages'), { recursive: true });
    mkdirSync(join(tmpDir, 'components'), { recursive: true });

    writeFileSync(join(tmpDir, 'app.neuron'), `STATE
  items: []`);
    writeFileSync(join(tmpDir, 'pages', 'home.neuron'), `PAGE home "Home" /

  rating
    label: "Score"
    value: "4.5"`);
    writeFileSync(join(tmpDir, 'components', 'rating.html'), `<div class="rating">{{label}} ★ {{value}}</div>`);
    writeFileSync(join(tmpDir, 'components', 'rating.css'), `.rating { color: gold; }`);

    const result = compile({
      appFile: join(tmpDir, 'app.neuron'),
      pageFiles: [join(tmpDir, 'pages', 'home.neuron')],
      apiFiles: [],
      themeFile: null,
      appTitle: 'Test',
    });

    expect(result.errors).toEqual([]);
    expect(result.html).toContain('Score');
    expect(result.html).toContain('4.5');
    expect(result.html).toContain('rating');
    expect(result.css).toContain('.rating { color: gold; }');

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports error when custom component conflicts with builtin', () => {
    const tmpDir = join(__dirname, '.tmp-compiler-conflict');
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, 'pages'), { recursive: true });
    mkdirSync(join(tmpDir, 'components'), { recursive: true });

    writeFileSync(join(tmpDir, 'app.neuron'), `STATE
  items: []`);
    writeFileSync(join(tmpDir, 'pages', 'home.neuron'), `PAGE home "Home" /

  text
    content: "Hello"`);
    writeFileSync(join(tmpDir, 'components', 'header.html'), `<header>{{title}}</header>`);

    const result = compile({
      appFile: join(tmpDir, 'app.neuron'),
      pageFiles: [join(tmpDir, 'pages', 'home.neuron')],
      apiFiles: [],
      themeFile: null,
      appTitle: 'Test',
    });

    expect(result.errors.some(e => e.includes('header') && e.includes('충돌'))).toBe(true);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports validation errors for undefined state references', () => {
    const tmpDir = join(__dirname, '.tmp-compiler-validate');
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, 'pages'), { recursive: true });

    writeFileSync(join(tmpDir, 'app.neuron'), `STATE
  items: []`);

    writeFileSync(join(tmpDir, 'pages', 'home.neuron'), `PAGE home "Home" /

  product-grid
    data: products
    on_click: nonexistent`);

    const result = compile({
      appFile: join(tmpDir, 'app.neuron'),
      pageFiles: [join(tmpDir, 'pages', 'home.neuron')],
      apiFiles: [],
      themeFile: null,
      appTitle: 'Test',
    });

    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.errors.some(e => e.includes('products'))).toBe(true);
    expect(result.errors.some(e => e.includes('nonexistent'))).toBe(true);

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
