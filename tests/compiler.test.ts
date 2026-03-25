import { describe, it, expect } from 'vitest';
import { compile } from '../src/compiler';
import { resolve } from 'path';

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
});
