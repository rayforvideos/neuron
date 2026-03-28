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
    expect(result.js).toContain("page: 'home'");
    expect(result.js).toContain("page: 'cart'");
    expect(result.js).toContain("page: 'checkout'");
  });
});

describe('end-to-end: todo app with new features', () => {
  it('compiles a todo app with dynamic routing, show_if, form validation, and new actions', () => {
    // app.neuron
    writeFileSync(join(TMP, 'app.neuron'), `STATE
  todos: []
  count: 0
  darkMode: false
  filter: "all"

---

ACTION toggle-dark
  toggle: darkMode

ACTION increase
  increment: count

ACTION decrease
  decrement: count

ACTION clear-filter
  set: filter -> "all"

ACTION go-home
  navigate: /

ACTION add-todo
  use: logic/todos.addTodo

ACTION toggle-todo
  use: logic/todos.toggleTodo`);

    // pages/
    mkdirSync(join(TMP, 'pages'), { recursive: true });
    writeFileSync(join(TMP, 'pages', 'home.neuron'), `PAGE home "Home" /

  header
    title: "Todo App"
    links: [Todos>/todos, About>/about]

  hero
    title: "Welcome"
    subtitle: "A simple todo app"
    cta: "Get Started" -> /todos

  text
    content: "No todos yet"
    show_if: !todos

  footer
    text: "Built with Neuron"`);

    writeFileSync(join(TMP, 'pages', 'todos.neuron'), `PAGE todos "Todos" /todos

  header
    title: "Todos"

  form
    field_title: "What needs to be done?"
      type: text
      required: true
    submit: "Add" -> add-todo

  button "Toggle Dark Mode" -> toggle-dark
    show_if: darkMode

  footer
    text: "Built with Neuron"`);

    writeFileSync(join(TMP, 'pages', 'detail.neuron'), `PAGE detail "Detail" /todo/:id

  header
    title: "Todo Detail"

  text
    content: "Todo detail page"

  button "Back" -> /todos`);

    // logic/
    mkdirSync(join(TMP, 'logic'), { recursive: true });
    writeFileSync(join(TMP, 'logic', 'todos.js'), `export function addTodo(state, payload) {
  return {
    todos: [...state.todos, { id: Date.now(), text: payload.field_title, done: false }],
    count: state.count + 1
  };
}

export function toggleTodo(state, id) {
  return {
    todos: state.todos.map(function(t) {
      return t.id === id ? Object.assign({}, t, { done: !t.done }) : t;
    })
  };
}`);

    const result = compile({
      appFile: join(TMP, 'app.neuron'),
      pageFiles: [
        join(TMP, 'pages', 'home.neuron'),
        join(TMP, 'pages', 'todos.neuron'),
        join(TMP, 'pages', 'detail.neuron'),
      ],
      apiFiles: [],
      themeFile: null,
      appTitle: 'Todo App',
    });

    expect(result.errors).toEqual([]);

    // HTML checks
    expect(result.html).toContain('<title>Todo App</title>');
    expect(result.html).toContain('data-page="home"');
    expect(result.html).toContain('data-page="todos"');
    expect(result.html).toContain('data-page="detail"');
    // show_if wrapper
    expect(result.html).toContain('data-show-if');
    // Form validation
    expect(result.html).toContain('type="text"');
    expect(result.html).toContain('required');

    // JS checks — new action patterns
    expect(result.js).toContain("'toggle-dark'");
    expect(result.js).toContain('!_state.darkMode');
    expect(result.js).toContain("'increase'");
    expect(result.js).toContain('_state.count + 1');
    expect(result.js).toContain("'decrease'");
    expect(result.js).toContain('_state.count - 1');
    expect(result.js).toContain("'clear-filter'");
    expect(result.js).toContain("_setState('filter'");
    expect(result.js).toContain("'go-home'");
    expect(result.js).toContain("_navigate('/')");

    // JS checks — use: external logic
    expect(result.js).toContain('_logic_todos');
    expect(result.js).toContain('addTodo');
    expect(result.js).toContain('toggleTodo');

    // JS checks — dynamic routing
    expect(result.js).toContain("params: ['id']");
    expect(result.js).toContain('_matchRoute');
    expect(result.js).toContain('_params');

    // JS checks — show_if
    expect(result.js).toContain('_initShowIf');
    expect(result.js).toContain('display');

    // JS checks — form validation
    expect(result.js).toContain('checkValidity');

    // CSS checks — form validation
    expect(result.css).toContain('input:invalid');
  });
});

describe('end-to-end: app with Phase 2 runtime features', () => {
  it('compiles an app with persistence, transitions, responsive, and loading/error', () => {
    writeFileSync(join(TMP, 'app.neuron'), `STATE persist: todos
  todos: []
  query: ""

---

ACTION search
  call: todos
  query: query
  target: todos`);

    mkdirSync(join(TMP, 'pages'), { recursive: true });
    writeFileSync(join(TMP, 'pages', 'home.neuron'), `PAGE home "Home" /

  header
    title: "My App"

  product-grid
    data: todos
    cols: 2

  footer
    text: "Built with Neuron"`);

    mkdirSync(join(TMP, 'apis'), { recursive: true });
    writeFileSync(join(TMP, 'apis', 'todos.neuron'), `API todos
  GET /api/todos
  on_load: true
  returns: Todo[]`);

    mkdirSync(join(TMP, 'themes'), { recursive: true });
    writeFileSync(join(TMP, 'themes', 'theme.json'), JSON.stringify({
      colors: { primary: '#2E86AB', secondary: '#A23B72', danger: '#E84855', bg: '#FFFFFF', text: '#1A1A2E', border: '#E0E0E0' },
      font: { family: 'Inter', size: { sm: 14, md: 16, lg: 20, xl: 28 } },
      radius: 8, shadow: '0 2px 8px rgba(0,0,0,0.1)', spacing: { sm: 8, md: 16, lg: 24, xl: 48 },
      transition: 'fade',
    }));

    const result = compile({
      appFile: join(TMP, 'app.neuron'),
      pageFiles: [join(TMP, 'pages', 'home.neuron')],
      apiFiles: [join(TMP, 'apis', 'todos.neuron')],
      themeFile: join(TMP, 'themes', 'theme.json'),
      appTitle: 'Phase 2 App',
    });

    expect(result.errors).toEqual([]);

    // Persistence
    expect(result.js).toContain('_persistFields');
    expect(result.js).toContain("'todos'");
    expect(result.js).toContain('localStorage');
    expect(result.js).toContain('_initPersist');

    // Transitions
    expect(result.css).toContain('neuron-page-active');
    expect(result.css).toContain('opacity');
    expect(result.js).toContain('neuron-page-active');

    // Responsive
    expect(result.css).toContain('@media (max-width: 768px)');

    // Loading/Error
    expect(result.js).toContain('"_loading": {}');
    expect(result.js).toContain('"_error": {}');
    expect(result.js).toContain('todos: true');
    expect(result.js).toContain('neuron-loading');
    expect(result.js).toContain('neuron-error');
    expect(result.css).toContain('.neuron-loading');
    expect(result.css).toContain('neuron-spin');
  });
});

describe('end-to-end: custom components and theme presets', () => {
  it('compiles app with custom components and dark preset', () => {
    writeFileSync(join(TMP, 'app.neuron'), `STATE
  items: []`);

    writeFileSync(join(TMP, 'neuron.json'), JSON.stringify({ name: 'Custom App', theme: 'dark' }));

    mkdirSync(join(TMP, 'pages'), { recursive: true });
    writeFileSync(join(TMP, 'pages', 'home.neuron'), `PAGE home "Home" /

  header
    title: "Custom App"

  rating
    label: "Score"
    value: "4.5"

  badge
    text: "NEW"

  footer
    text: "Built with Neuron"`);

    mkdirSync(join(TMP, 'components'), { recursive: true });
    writeFileSync(join(TMP, 'components', 'rating.html'), `<div class="rating"><span>{{label}}</span> ★ {{value}}</div>`);
    writeFileSync(join(TMP, 'components', 'rating.css'), `.rating { display: flex; gap: 8px; }\n.rating span { color: #f59e0b; }`);
    writeFileSync(join(TMP, 'components', 'badge.html'), `<span class="badge badge--{{variant}}">{{text}}</span>`);

    const result = compile({
      appFile: join(TMP, 'app.neuron'),
      pageFiles: [join(TMP, 'pages', 'home.neuron')],
      apiFiles: [],
      themeFile: null,
      appTitle: 'Custom App',
    });

    expect(result.errors).toEqual([]);

    expect(result.html).toContain('Score');
    expect(result.html).toContain('4.5');
    expect(result.html).toContain('rating');
    expect(result.html).toContain('NEW');
    expect(result.html).toContain('badge');

    expect(result.css).toContain('.rating');
    expect(result.css).toContain('#f59e0b');

    expect(result.css).toContain('#121212');
    expect(result.css).toContain('#00D4AA');

    expect(result.html).not.toContain('{{variant}}');
  });
});

describe('end-to-end: build-time validation', () => {
  it('reports validation errors for invalid references', () => {
    writeFileSync(join(TMP, 'app.neuron'), `STATE persist: todos, wishlist
  todos: []

---

ACTION fetch
  call: missing-api`);

    mkdirSync(join(TMP, 'pages'), { recursive: true });
    writeFileSync(join(TMP, 'pages', 'home.neuron'), `PAGE home "Home" /

  product-grid
    data: nonexistent
    on_click: missing-action`);

    writeFileSync(join(TMP, 'pages', 'dupe.neuron'), `PAGE home "Duplicate" /other`);

    const result = compile({
      appFile: join(TMP, 'app.neuron'),
      pageFiles: [
        join(TMP, 'pages', 'home.neuron'),
        join(TMP, 'pages', 'dupe.neuron'),
      ],
      apiFiles: [],
      themeFile: null,
      appTitle: 'Test',
    });

    expect(result.errors.length).toBeGreaterThanOrEqual(4);
    expect(result.errors.some(e => e.includes('wishlist'))).toBe(true);
    expect(result.errors.some(e => e.includes('missing-api'))).toBe(true);
    expect(result.errors.some(e => e.includes('nonexistent'))).toBe(true);
    expect(result.errors.some(e => e.includes('missing-action'))).toBe(true);
    expect(result.errors.some(e => e.includes('home') && e.includes('중복'))).toBe(true);
  });
});
