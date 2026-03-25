import { describe, it, expect } from 'vitest';
import { renderComponent, KNOWN_COMPONENTS } from '../../src/components/registry';
import type { ComponentNode } from '../../src/ast';

function makeComponent(type: string, props: Record<string, string> = {}, opts: Partial<ComponentNode> = {}): ComponentNode {
  return {
    type: 'COMPONENT',
    componentType: type,
    properties: Object.entries(props).map(([key, value]) => ({ key, value })),
    children: [],
    ...opts,
  };
}

describe('KNOWN_COMPONENTS', () => {
  it('contains all built-in component types', () => {
    expect(KNOWN_COMPONENTS).toContain('header');
    expect(KNOWN_COMPONENTS).toContain('footer');
    expect(KNOWN_COMPONENTS).toContain('hero');
    expect(KNOWN_COMPONENTS).toContain('button');
    expect(KNOWN_COMPONENTS).toContain('form');
    expect(KNOWN_COMPONENTS).toContain('product-grid');
    expect(KNOWN_COMPONENTS).toContain('cart-list');
    expect(KNOWN_COMPONENTS).toContain('cart-summary');
  });
});

describe('renderComponent', () => {
  it('renders header with title and links', () => {
    const html = renderComponent(makeComponent('header', {
      title: '"My Shop"',
      links: '[상품>/products, 장바구니>/cart]',
    }));
    expect(html).toContain('My Shop');
    expect(html).toContain('header');
    expect(html).toContain('/products');
    expect(html).toContain('/cart');
  });

  it('renders hero with title, subtitle, cta', () => {
    const html = renderComponent(makeComponent('hero', {
      title: '"최고의 쇼핑"',
      subtitle: '"지금 시작하세요"',
      cta: '"쇼핑하기" -> /products',
    }));
    expect(html).toContain('최고의 쇼핑');
    expect(html).toContain('지금 시작하세요');
    expect(html).toContain('쇼핑하기');
    expect(html).toContain('/products');
  });

  it('renders footer', () => {
    const html = renderComponent(makeComponent('footer', { text: '"© 2026 My Shop"' }));
    expect(html).toContain('© 2026 My Shop');
    expect(html).toContain('footer');
  });

  it('renders product-grid', () => {
    const html = renderComponent(makeComponent('product-grid', {
      data: 'products', cols: '3', on_click: 'add-to-cart',
    }));
    expect(html).toContain('product-grid');
    expect(html).toContain('data-source="products"');
    expect(html).toContain('data-action="add-to-cart"');
  });

  it('renders button with inline label and action', () => {
    const html = renderComponent(makeComponent('button', { variant: 'primary' }, {
      inlineLabel: '결제하기', inlineAction: '/checkout',
    }));
    expect(html).toContain('결제하기');
    expect(html).toContain('/checkout');
    expect(html).toContain('primary');
  });

  it('renders form with fields and submit', () => {
    const html = renderComponent(makeComponent('form', {
      submit: '"결제하기" -> pay',
    }));
    expect(html).toContain('form');
    expect(html).toContain('결제하기');
  });

  it('renders cart-list', () => {
    const html = renderComponent(makeComponent('cart-list', {
      state: 'cart', on_remove: 'remove-from-cart',
    }));
    expect(html).toContain('cart-list');
    expect(html).toContain('data-state="cart"');
  });

  it('renders cart-summary', () => {
    const html = renderComponent(makeComponent('cart-summary', { state: 'cart' }));
    expect(html).toContain('cart-summary');
  });

  it('renders section with children', () => {
    const child = makeComponent('text', { content: '"Hello"' });
    const html = renderComponent(makeComponent('section', {}, { children: [child] }));
    expect(html).toContain('neuron-section');
    expect(html).toContain('Hello');
  });
});
