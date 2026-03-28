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
      { type: 'PAGE', name: 'home', title: '홈', route: '/', params: [], components: [] },
      { type: 'PAGE', name: 'cart', title: '장바구니', route: '/cart', params: [], components: [] },
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
    expect(js).not.toContain('_renderGrid');
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
        type: 'PAGE', name: 'home', title: '홈', route: '/', params: [],
        components: [{
          type: 'COMPONENT', componentType: 'product-grid',
          properties: [
            { key: 'data', value: 'products' },
            { key: 'cols', value: '3' },
            { key: 'on_click', value: 'add-to-cart' },
            { key: 'image', value: 'photo' },
            { key: 'title', value: 'label' },
            { key: 'subtitle', value: 'type' },
            { key: 'price', value: 'cost' },
          ],
          children: [],
        }],
      }, {
        type: 'PAGE', name: 'cart', title: '장바구니', route: '/cart', params: [],
        components: [
          {
            type: 'COMPONENT', componentType: 'cart-list',
            properties: [
              { key: 'state', value: 'cart' },
              { key: 'on_remove', value: 'remove-from-cart' },
              { key: 'title', value: 'label' },
              { key: 'price', value: 'cost' },
              { key: 'empty_text', value: 'Nothing here' },
            ],
            children: [],
          },
          {
            type: 'COMPONENT', componentType: 'cart-summary',
            properties: [
              { key: 'state', value: 'cart' },
              { key: 'price', value: 'cost' },
              { key: 'total_label', value: 'Grand Total' },
            ],
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

    it('generates renderer functions for each bound component', () => {
      const js = generateJS(astWithComponents);
      expect(js).toContain('function _renderGrid0(items)');
      expect(js).toContain('function _renderList1(items)');
      expect(js).toContain('function _renderSummary2(items)');
      expect(js).toContain('function _renderIcon3(items)');
    });

    it('generates _initBindings with correct state bindings', () => {
      const js = generateJS(astWithComponents);
      expect(js).toContain("_bindings['products'].push(_renderGrid0)");
      expect(js).toContain("_bindings['cart'].push(_renderList1)");
      expect(js).toContain("_bindings['cart'].push(_renderSummary2)");
      expect(js).toContain("_bindings['cart'].push(_renderIcon3)");
    });

    it('product-grid uses configured field names instead of hardcoded ones', () => {
      const js = generateJS(astWithComponents);
      // Should use 'photo' not 'image', 'label' not 'name', 'cost' not 'price'
      expect(js).toContain("p['photo']");
      expect(js).toContain("p['label']");
      expect(js).toContain("p['type']");
      expect(js).toContain("p['cost']");
    });

    it('cart-list uses configured field names and empty text', () => {
      const js = generateJS(astWithComponents);
      expect(js).toContain("item['label']");
      expect(js).toContain("item['cost']");
      expect(js).toContain('Nothing here');
    });

    it('cart-summary uses configured price field and labels', () => {
      const js = generateJS(astWithComponents);
      expect(js).toContain("i['cost']");
      expect(js).toContain('Grand Total');
    });

    it('renders without field mappings using generic fallback', () => {
      const minimalAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [{ name: 'items', defaultValue: '[]' }] }],
        actions: [],
        apis: [],
        pages: [{
          type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [],
          components: [{
            type: 'COMPONENT', componentType: 'product-grid',
            properties: [{ key: 'data', value: 'items' }],
            children: [],
          }],
        }],
      };
      const js = generateJS(minimalAst);
      // Without field mappings, image/title/subtitle/price expressions should be empty strings
      expect(js).toContain('function _renderGrid0(items)');
      expect(js).toContain("_bindings['items'].push(_renderGrid0)");
      // Should not crash - empty field = empty string
      expect(js).not.toContain("p['undefined']");
    });
  });
});
