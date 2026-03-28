import { describe, it, expect } from 'vitest';
import { generateHTML } from '../../src/generator/html';
import type { PageNode } from '../../src/ast';

describe('generateHTML', () => {
  it('generates full HTML document with pages', () => {
    const pages: PageNode[] = [
      {
        type: 'PAGE', name: 'home', title: '홈', route: '/', params: [],
        components: [
          { type: 'COMPONENT', componentType: 'header', properties: [{ key: 'title', value: '"My Shop"' }], children: [] },
          { type: 'COMPONENT', componentType: 'footer', properties: [{ key: 'text', value: '"© 2026"' }], children: [] },
        ],
      },
      {
        type: 'PAGE', name: 'cart', title: '장바구니', route: '/cart', params: [],
        components: [
          { type: 'COMPONENT', componentType: 'header', properties: [{ key: 'title', value: '"My Shop"' }], children: [] },
        ],
      },
    ];
    const html = generateHTML(pages, 'Test App');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Test App</title>');
    expect(html).toContain('data-page="home"');
    expect(html).toContain('data-route="/"');
    expect(html).toContain('data-page="cart"');
    expect(html).toContain('data-route="/cart"');
    expect(html).toContain('My Shop');
    expect(html).toContain('style.css');
    expect(html).toContain('main.js');
  });
});
