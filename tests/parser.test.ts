import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser';

describe('parse', () => {
  it('parses STATE block', () => {
    const input = `STATE\n  cart: []\n  user: null\n  search_query: ""`;
    const ast = parse(input);
    expect(ast.states).toHaveLength(1);
    expect(ast.states[0].fields).toEqual([
      { name: 'cart', defaultValue: '[]' },
      { name: 'user', defaultValue: 'null' },
      { name: 'search_query', defaultValue: '""' },
    ]);
  });

  it('parses ACTION blocks', () => {
    const input = `ACTION add-to-cart\n  append: product -> cart\n\nACTION pay\n  call: orders\n  on_success: -> /complete\n  on_error: show-error`;
    const ast = parse(input);
    expect(ast.actions).toHaveLength(2);
    expect(ast.actions[0].name).toBe('add-to-cart');
    expect(ast.actions[0].steps).toEqual([{ key: 'append', value: 'product -> cart' }]);
    expect(ast.actions[1].name).toBe('pay');
    expect(ast.actions[1].steps).toHaveLength(3);
  });

  it('parses API block', () => {
    const input = `API products\n  GET /api/products\n  on_load: true\n  returns: Product[]`;
    const ast = parse(input);
    expect(ast.apis).toHaveLength(1);
    expect(ast.apis[0].name).toBe('products');
    expect(ast.apis[0].method).toBe('GET');
    expect(ast.apis[0].endpoint).toBe('/api/products');
    expect(ast.apis[0].options).toEqual({ on_load: 'true', returns: 'Product[]' });
  });

  it('parses PAGE with nested components', () => {
    const input = `PAGE home "홈" /\n\n  header\n    title: "My Shop"\n\n  hero\n    title: "최고의 쇼핑"\n    cta: "쇼핑하기" -> /products`;
    const ast = parse(input);
    expect(ast.pages).toHaveLength(1);
    const page = ast.pages[0];
    expect(page.name).toBe('home');
    expect(page.title).toBe('홈');
    expect(page.route).toBe('/');
    expect(page.components).toHaveLength(2);
    expect(page.components[0].componentType).toBe('header');
    expect(page.components[0].properties).toEqual([{ key: 'title', value: '"My Shop"' }]);
    expect(page.components[1].componentType).toBe('hero');
    expect(page.components[1].properties).toHaveLength(2);
  });

  it('parses inline button component', () => {
    const input = `PAGE cart "장바구니" /cart\n\n  button "결제하기" -> /checkout\n    variant: primary`;
    const ast = parse(input);
    const btn = ast.pages[0].components[0];
    expect(btn.componentType).toBe('button');
    expect(btn.inlineLabel).toBe('결제하기');
    expect(btn.inlineAction).toBe('/checkout');
    expect(btn.properties).toEqual([{ key: 'variant', value: 'primary' }]);
  });

  it('parses form with field list', () => {
    const input = `PAGE checkout "결제" /checkout\n\n  form\n    fields:\n      - name: "이름" type:text required\n      - email: "이메일" type:email required\n    submit: "결제하기" -> pay`;
    const ast = parse(input);
    const form = ast.pages[0].components[0];
    expect(form.componentType).toBe('form');
    const fieldsProps = form.properties.filter(p => p.key === 'fields' || p.key === 'fields_items');
    expect(fieldsProps.length).toBeGreaterThan(0);
    expect(form.properties.find(p => p.key === 'submit')?.value).toBe('"결제하기" -> pay');
  });

  describe('dynamic route params', () => {
    it('extracts single param from route', () => {
      const ast = parse(`PAGE detail "Detail" /item/:id\n`);
      expect(ast.pages[0].params).toEqual(['id']);
      expect(ast.pages[0].route).toBe('/item/:id');
    });

    it('extracts multiple params from route', () => {
      const ast = parse(`PAGE edit "Edit" /category/:catId/item/:itemId\n`);
      expect(ast.pages[0].params).toEqual(['catId', 'itemId']);
    });

    it('returns empty params for static route', () => {
      const ast = parse(`PAGE home "Home" /\n`);
      expect(ast.pages[0].params).toEqual([]);
    });
  });

  describe('show_if parsing', () => {
    it('parses show_if property on component', () => {
      const ast = parse(`PAGE home "Home" /

  button "Login" -> /login
    show_if: !user
`);
      const btn = ast.pages[0].components[0];
      expect(btn.showIf).toEqual({ field: 'user', negate: true });
    });

    it('parses show_if without negation', () => {
      const ast = parse(`PAGE home "Home" /

  button "Logout" -> logout
    show_if: user
`);
      const btn = ast.pages[0].components[0];
      expect(btn.showIf).toEqual({ field: 'user', negate: false });
    });

    it('component without show_if has undefined showIf', () => {
      const ast = parse(`PAGE home "Home" /

  text
    content: "Hello"
`);
      const txt = ast.pages[0].components[0];
      expect(txt.showIf).toBeUndefined();
    });
  });

  it('parses full app.neuron with mixed sections', () => {
    const input = `STATE\n  cart: []\n  products: []\n\n---\n\nACTION add-to-cart\n  append: product -> cart\n\nACTION remove-from-cart\n  remove: cart where id matches`;
    const ast = parse(input);
    expect(ast.states).toHaveLength(1);
    expect(ast.actions).toHaveLength(2);
  });
});
