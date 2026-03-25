import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { compile } from '../src/compiler';

const TMP = join(__dirname, '.tmp-e2e');

beforeEach(() => mkdirSync(TMP, { recursive: true }));
afterEach(() => rmSync(TMP, { recursive: true, force: true }));

describe('end-to-end: my-shop example from spec', () => {
  it('compiles the full shop example', () => {
    // app.neuron
    writeFileSync(join(TMP, 'app.neuron'), `STATE
  cart: []
  products: []
  user: null
  search_query: ""
  modal_open: false

---

ACTION add-to-cart
  append: product -> cart

ACTION remove-from-cart
  remove: cart where id matches

ACTION pay
  call: orders
  on_success: -> /complete
  on_error: show-error

ACTION search-products
  call: products
  query: search_query
  target: products`);

    // pages/home.neuron
    mkdirSync(join(TMP, 'pages'), { recursive: true });
    writeFileSync(join(TMP, 'pages', 'home.neuron'), `PAGE home "홈" /

  header
    title: "My Shop"
    links: [상품>/products, 장바구니>/cart]

  hero
    title: "최고의 쇼핑"
    subtitle: "지금 시작하세요"
    cta: "쇼핑하기" -> /products

  product-grid
    data: products
    cols: 3
    on_click: add-to-cart

  footer
    text: "© 2026 My Shop"`);

    writeFileSync(join(TMP, 'pages', 'cart.neuron'), `PAGE cart "장바구니" /cart

  header
    title: "My Shop"

  cart-list
    state: cart
    on_remove: remove-from-cart

  cart-summary
    state: cart

  button "결제하기" -> /checkout
    variant: primary`);

    writeFileSync(join(TMP, 'pages', 'checkout.neuron'), `PAGE checkout "결제" /checkout

  header
    title: "My Shop"

  form
    fields:
      - name: "이름" type:text required
      - email: "이메일" type:email required
      - address: "주소" type:text required
    submit: "결제하기" -> pay`);

    // apis/
    mkdirSync(join(TMP, 'apis'), { recursive: true });
    writeFileSync(join(TMP, 'apis', 'products.neuron'), `API products
  GET /api/products
  on_load: true
  returns: Product[]`);

    writeFileSync(join(TMP, 'apis', 'orders.neuron'), `API orders
  POST /api/orders
  body: cart
  returns: Order`);

    // theme
    mkdirSync(join(TMP, 'themes'), { recursive: true });
    writeFileSync(join(TMP, 'themes', 'theme.json'), JSON.stringify({
      colors: { primary: '#2E86AB', secondary: '#A23B72', danger: '#E84855', bg: '#FFFFFF', text: '#1A1A2E', border: '#E0E0E0' },
      font: { family: 'Inter', size: { sm: 14, md: 16, lg: 20, xl: 28 } },
      radius: 8, shadow: '0 2px 8px rgba(0,0,0,0.1)', spacing: { sm: 8, md: 16, lg: 24, xl: 48 },
    }));

    const result = compile({
      appFile: join(TMP, 'app.neuron'),
      pageFiles: [
        join(TMP, 'pages', 'home.neuron'),
        join(TMP, 'pages', 'cart.neuron'),
        join(TMP, 'pages', 'checkout.neuron'),
      ],
      apiFiles: [
        join(TMP, 'apis', 'products.neuron'),
        join(TMP, 'apis', 'orders.neuron'),
      ],
      themeFile: join(TMP, 'themes', 'theme.json'),
      appTitle: 'My Shop',
    });

    expect(result.errors).toEqual([]);

    // HTML checks
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('<title>My Shop</title>');
    expect(result.html).toContain('data-page="home"');
    expect(result.html).toContain('data-page="cart"');
    expect(result.html).toContain('data-page="checkout"');
    expect(result.html).toContain('최고의 쇼핑');
    expect(result.html).toContain('결제하기');
    expect(result.html).toContain('/products');
    expect(result.html).toContain('/cart');

    // CSS checks
    expect(result.css).toContain('--color-primary: #2E86AB');
    expect(result.css).toContain("--font-family: 'Inter'");

    // JS checks
    expect(result.js).toContain('"cart": []');
    expect(result.js).toContain('"products": []');
    expect(result.js).toContain("'add-to-cart'");
    expect(result.js).toContain("'remove-from-cart'");
    expect(result.js).toContain("'pay'");
    expect(result.js).toContain('/api/products');
    expect(result.js).toContain('/api/orders');
    expect(result.js).toContain('_navigate');
    expect(result.js).toContain('"/": "home"');
    expect(result.js).toContain('"/cart": "cart"');
    expect(result.js).toContain('"/checkout": "checkout"');
  });
});
