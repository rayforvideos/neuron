import { describe, it, expect } from 'vitest';
import { tokenize, Token } from '../src/lexer';

describe('tokenize', () => {
  it('tokenizes STATE block', () => {
    const input = `STATE\n  cart: []\n  user: null`;
    const tokens = tokenize(input);
    expect(tokens).toEqual([
      { type: 'KEYWORD', value: 'STATE', indent: 0, line: 1 },
      { type: 'PROPERTY', key: 'cart', value: '[]', indent: 2, line: 2 },
      { type: 'PROPERTY', key: 'user', value: 'null', indent: 2, line: 3 },
    ]);
  });

  it('tokenizes ACTION block', () => {
    const input = `ACTION add-to-cart\n  append: product -> cart`;
    const tokens = tokenize(input);
    expect(tokens).toEqual([
      { type: 'KEYWORD', value: 'ACTION', name: 'add-to-cart', indent: 0, line: 1 },
      { type: 'PROPERTY', key: 'append', value: 'product -> cart', indent: 2, line: 2 },
    ]);
  });

  it('tokenizes PAGE with inline button syntax', () => {
    const input = `PAGE cart "장바구니" /cart\n\n  button "결제하기" -> /checkout\n    variant: primary`;
    const tokens = tokenize(input);
    expect(tokens[0]).toEqual({
      type: 'KEYWORD', value: 'PAGE', name: 'cart', title: '장바구니', route: '/cart', indent: 0, line: 1,
    });
    expect(tokens[1]).toEqual({
      type: 'COMPONENT', componentType: 'button', inlineLabel: '결제하기', inlineAction: '/checkout', indent: 2, line: 3,
    });
    expect(tokens[2]).toEqual({
      type: 'PROPERTY', key: 'variant', value: 'primary', indent: 4, line: 4,
    });
  });

  it('tokenizes API block', () => {
    const input = `API products\n  GET /api/products\n  on_load: true\n  returns: Product[]`;
    const tokens = tokenize(input);
    expect(tokens[0]).toEqual({
      type: 'KEYWORD', value: 'API', name: 'products', indent: 0, line: 1,
    });
    expect(tokens[1]).toEqual({
      type: 'HTTP_METHOD', method: 'GET', endpoint: '/api/products', indent: 2, line: 2,
    });
  });

  it('handles section separator ---', () => {
    const input = `STATE\n  cart: []\n\n---\n\nACTION add\n  append: x -> cart`;
    const tokens = tokenize(input);
    expect(tokens[0].type).toBe('KEYWORD');
    expect(tokens[0].value).toBe('STATE');
    expect(tokens[2].type).toBe('SEPARATOR');
    expect(tokens[3].type).toBe('KEYWORD');
    expect(tokens[3].value).toBe('ACTION');
  });

  it('skips blank lines', () => {
    const input = `STATE\n\n  cart: []\n\n  user: null`;
    const tokens = tokenize(input);
    expect(tokens).toHaveLength(3);
  });

  it('tokenizes component with links array', () => {
    const input = `  header\n    title: "My Shop"\n    links: [상품>/products, 장바구니>/cart]`;
    const tokens = tokenize(input);
    expect(tokens[0]).toEqual({ type: 'COMPONENT', componentType: 'header', indent: 2, line: 1 });
    expect(tokens[1]).toEqual({ type: 'PROPERTY', key: 'title', value: '"My Shop"', indent: 4, line: 2 });
    expect(tokens[2]).toEqual({ type: 'PROPERTY', key: 'links', value: '[상품>/products, 장바구니>/cart]', indent: 4, line: 3 });
  });

  it('tokenizes form fields with list syntax', () => {
    const input = `  form\n    fields:\n      - name: "이름" type:text required\n      - email: "이메일" type:email required`;
    const tokens = tokenize(input);
    expect(tokens[0]).toEqual({ type: 'COMPONENT', componentType: 'form', indent: 2, line: 1 });
    expect(tokens[1]).toEqual({ type: 'PROPERTY', key: 'fields', value: '', indent: 4, line: 2 });
    expect(tokens[2]).toEqual({ type: 'LIST_ITEM', value: 'name: "이름" type:text required', indent: 6, line: 3 });
    expect(tokens[3]).toEqual({ type: 'LIST_ITEM', value: 'email: "이메일" type:email required', indent: 6, line: 4 });
  });
});
