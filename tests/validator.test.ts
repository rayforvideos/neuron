import { describe, it, expect } from 'vitest';
import { validate } from '../src/validator';
import type { NeuronAST } from '../src/ast';

describe('validate', () => {
  const validAst: NeuronAST = {
    states: [{ type: 'STATE', fields: [
      { name: 'items', defaultValue: '[]' },
      { name: 'user', defaultValue: 'null' },
    ], persist: ['items'] }],
    actions: [
      { type: 'ACTION', name: 'add', steps: [{ key: 'append', value: 'item -> items' }] },
      { type: 'ACTION', name: 'fetch-items', steps: [{ key: 'call', value: 'items' }] },
    ],
    apis: [{ type: 'API', name: 'items', method: 'GET', endpoint: '/api/items', options: { on_load: 'true' } }],
    pages: [{
      type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [],
      components: [{
        type: 'COMPONENT', componentType: 'product-grid',
        properties: [{ key: 'data', value: 'items' }, { key: 'on_click', value: 'add' }],
        children: [],
      }],
    }],
  };

  it('returns no errors for valid AST', () => {
    expect(validate(validAst)).toEqual([]);
  });

  it('detects undefined state reference in component data', () => {
    const ast: NeuronAST = {
      states: [{ type: 'STATE', fields: [], persist: [] }],
      actions: [],
      apis: [],
      pages: [{
        type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [],
        components: [{
          type: 'COMPONENT', componentType: 'product-grid',
          properties: [{ key: 'data', value: 'products' }],
          children: [],
        }],
      }],
    };
    const errors = validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('products');
  });

  it('detects undefined action reference in component', () => {
    const ast: NeuronAST = {
      states: [{ type: 'STATE', fields: [{ name: 'items', defaultValue: '[]' }], persist: [] }],
      actions: [],
      apis: [],
      pages: [{
        type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [],
        components: [{
          type: 'COMPONENT', componentType: 'product-grid',
          properties: [{ key: 'data', value: 'items' }, { key: 'on_click', value: 'add-to-cart' }],
          children: [],
        }],
      }],
    };
    const errors = validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('add-to-cart');
  });

  it('detects undefined API reference in call action', () => {
    const ast: NeuronAST = {
      states: [{ type: 'STATE', fields: [], persist: [] }],
      actions: [{ type: 'ACTION', name: 'fetch', steps: [{ key: 'call', value: 'missing-api' }] }],
      apis: [],
      pages: [{ type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] }],
    };
    const errors = validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('missing-api');
  });

  it('detects duplicate routes', () => {
    const ast: NeuronAST = {
      states: [{ type: 'STATE', fields: [], persist: [] }],
      actions: [],
      apis: [],
      pages: [
        { type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] },
        { type: 'PAGE', name: 'home2', title: 'Home 2', route: '/', params: [], components: [] },
      ],
    };
    const errors = validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('/');
  });

  it('detects duplicate page names', () => {
    const ast: NeuronAST = {
      states: [{ type: 'STATE', fields: [], persist: [] }],
      actions: [],
      apis: [],
      pages: [
        { type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] },
        { type: 'PAGE', name: 'home', title: 'Home', route: '/other', params: [], components: [] },
      ],
    };
    const errors = validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('home');
  });

  it('detects undefined persist field', () => {
    const ast: NeuronAST = {
      states: [{ type: 'STATE', fields: [{ name: 'cart', defaultValue: '[]' }], persist: ['cart', 'wishlist'] }],
      actions: [],
      apis: [],
      pages: [{ type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] }],
    };
    const errors = validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('wishlist');
  });

  it('allows internal state references (_params, _loading, _error)', () => {
    const ast: NeuronAST = {
      states: [{ type: 'STATE', fields: [], persist: [] }],
      actions: [],
      apis: [],
      pages: [{
        type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [],
        components: [{
          type: 'COMPONENT', componentType: 'text',
          properties: [{ key: 'content', value: 'hello' }],
          children: [],
          showIf: { field: '_loading', negate: false },
        }],
      }],
    };
    expect(validate(ast)).toEqual([]);
  });

  it('ignores route-style actions (starting with /)', () => {
    const ast: NeuronAST = {
      states: [{ type: 'STATE', fields: [], persist: [] }],
      actions: [],
      apis: [],
      pages: [{
        type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [],
        components: [{
          type: 'COMPONENT', componentType: 'button',
          inlineLabel: 'Go', inlineAction: '/about',
          properties: [],
          children: [],
        }],
      }],
    };
    expect(validate(ast)).toEqual([]);
  });
});
