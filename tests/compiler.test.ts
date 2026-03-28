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
});
