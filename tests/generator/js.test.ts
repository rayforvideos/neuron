import { describe, it, expect } from 'vitest';
import { generateJS } from '../../src/generator/js';
import type { NeuronAST } from '../../src/ast';

describe('generateJS', () => {
  const ast: NeuronAST = {
    states: [{
      type: 'STATE',
      fields: [
        { name: 'cart', defaultValue: '[]' },
        { name: 'products', defaultValue: '[]' },
        { name: 'user', defaultValue: 'null' },
      ],
    }],
    actions: [
      { type: 'ACTION', name: 'add-to-cart', steps: [{ key: 'append', value: 'product -> cart' }] },
      { type: 'ACTION', name: 'remove-from-cart', steps: [{ key: 'remove', value: 'cart where id matches' }] },
      { type: 'ACTION', name: 'pay', steps: [
        { key: 'call', value: 'orders' },
        { key: 'on_success', value: '-> /complete' },
        { key: 'on_error', value: 'show-error' },
      ]},
    ],
    apis: [
      { type: 'API', name: 'products', method: 'GET', endpoint: '/api/products', options: { on_load: 'true', returns: 'Product[]' } },
      { type: 'API', name: 'orders', method: 'POST', endpoint: '/api/orders', options: { body: 'cart', returns: 'Order' } },
    ],
    pages: [
      { type: 'PAGE', name: 'home', title: '홈', route: '/', components: [] },
      { type: 'PAGE', name: 'cart', title: '장바구니', route: '/cart', components: [] },
    ],
  };

  it('generates state initialization', () => {
    const js = generateJS(ast);
    expect(js).toContain('const _state =');
    expect(js).toContain('"cart": []');
    expect(js).toContain('"products": []');
    expect(js).toContain('"user": null');
  });

  it('generates _setState function', () => {
    const js = generateJS(ast);
    expect(js).toContain('function _setState(');
    expect(js).toContain('_bindings');
  });

  it('generates router with all page routes', () => {
    const js = generateJS(ast);
    expect(js).toContain('function _navigate(');
    expect(js).toContain('"/": "home"');
    expect(js).toContain('"/cart": "cart"');
    expect(js).toContain('data-link');
  });

  it('generates action handlers', () => {
    const js = generateJS(ast);
    expect(js).toContain("'add-to-cart'");
    expect(js).toContain("'remove-from-cart'");
    expect(js).toContain("'pay'");
  });

  it('generates API auto-load calls', () => {
    const js = generateJS(ast);
    expect(js).toContain('/api/products');
    expect(js).toContain('fetch');
  });

  it('generates update functions for state-bound components', () => {
    const js = generateJS(ast);
    expect(js).toContain('_bindings');
  });
});
