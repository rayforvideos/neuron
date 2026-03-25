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

  it('generates _initBindings with empty body when no data-bound components', () => {
    const js = generateJS(ast);
    expect(js).toContain('function _initBindings()');
    expect(js).not.toContain('_renderProductGrid');
  });

  it('calls _initBindings in DOMContentLoaded', () => {
    const js = generateJS(ast);
    expect(js).toContain('_initBindings();');
  });

  describe('runtime renderers', () => {
    const astWithComponents: NeuronAST = {
      states: [{ type: 'STATE', fields: [
        { name: 'cart', defaultValue: '[]' },
        { name: 'products', defaultValue: '[]' },
      ]}],
      actions: [
        { type: 'ACTION', name: 'add-to-cart', steps: [{ key: 'append', value: 'product -> cart' }] },
        { type: 'ACTION', name: 'remove-from-cart', steps: [{ key: 'remove', value: 'cart where id matches' }] },
      ],
      apis: [
        { type: 'API', name: 'products', method: 'GET', endpoint: '/api/products', options: { on_load: 'true', returns: 'Product[]' } },
      ],
      pages: [{
        type: 'PAGE', name: 'home', title: '홈', route: '/',
        components: [{
          type: 'COMPONENT', componentType: 'product-grid',
          properties: [
            { key: 'data', value: 'products' },
            { key: 'cols', value: '3' },
            { key: 'on_click', value: 'add-to-cart' },
          ],
          children: [],
        }],
      }, {
        type: 'PAGE', name: 'cart', title: '장바구니', route: '/cart',
        components: [
          {
            type: 'COMPONENT', componentType: 'cart-list',
            properties: [
              { key: 'state', value: 'cart' },
              { key: 'on_remove', value: 'remove-from-cart' },
            ],
            children: [],
          },
          {
            type: 'COMPONENT', componentType: 'cart-summary',
            properties: [{ key: 'state', value: 'cart' }],
            children: [],
          },
          {
            type: 'COMPONENT', componentType: 'cart-icon',
            properties: [{ key: 'state', value: 'cart' }],
            children: [],
          },
        ],
      }],
    };

    it('generates all four renderer functions', () => {
      const js = generateJS(astWithComponents);
      expect(js).toContain('function _renderProductGrid(items)');
      expect(js).toContain('function _renderCartList(items)');
      expect(js).toContain('function _renderCartSummary(items)');
      expect(js).toContain('function _renderCartIcon(items)');
    });

    it('generates _initBindings with correct registrations', () => {
      const js = generateJS(astWithComponents);
      expect(js).toContain("_bindings['products'].push(_renderProductGrid)");
      expect(js).toContain("_bindings['cart'].push(_renderCartList)");
      expect(js).toContain("_bindings['cart'].push(_renderCartSummary)");
      expect(js).toContain("_bindings['cart'].push(_renderCartIcon)");
    });

    it('product-grid renderer references data-source and data-action', () => {
      const js = generateJS(astWithComponents);
      expect(js).toContain('data-source');
      expect(js).toContain('data-product-id');
      expect(js).toContain('neuron-product-card');
    });

    it('cart-list renderer handles empty state', () => {
      const js = generateJS(astWithComponents);
      expect(js).toContain('neuron-empty');
      expect(js).toContain('data-remove-id');
    });
  });
});
