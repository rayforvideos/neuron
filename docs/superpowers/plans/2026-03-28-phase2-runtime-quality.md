# Phase 2: Runtime Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve generated SPA runtime quality with page transitions, state persistence, responsive layout, and automatic loading/error UI.

**Architecture:** Each feature is mostly independent and primarily modifies the CSS/JS generators. State persistence requires a small AST/parser change (`persist:` keyword). Page transitions require a theme type extension. Responsive layout and loading/error UI are pure generator additions with no DSL changes.

**Tech Stack:** TypeScript, Vitest, tsup

---

## File Structure

| File | Responsibility | Change Type |
|------|---------------|-------------|
| `src/ast.ts` | AST type definitions | Modify: add `persist: string[]` to StateNode |
| `src/theme.ts` | Theme loading | Modify: add `transition` field to Theme interface |
| `src/parser.ts` | AST generation | Modify: parse `persist:` property in STATE block |
| `src/generator/js.ts` | JS code generation | Modify: persist logic, transition-aware router, loading/error state wrapping |
| `src/generator/css.ts` | CSS generation | Modify: transition styles, responsive media queries, loading/error styles |
| `src/compiler.ts` | Compile pipeline | Modify: pass theme to CSS generator (already done, may need transition pass-through) |
| `tests/parser.test.ts` | Parser tests | Modify |
| `tests/theme.test.ts` | Theme tests | Modify |
| `tests/generator/js.test.ts` | JS generator tests | Modify |
| `tests/generator/css.test.ts` | CSS generator tests | Modify |
| `tests/e2e.test.ts` | End-to-end tests | Modify |

---

### Task 1: Extend Theme with Transition

**Files:**
- Modify: `src/theme.ts`
- Modify: `tests/theme.test.ts`

- [ ] **Step 1: Write failing test for transition in theme**

Add to `tests/theme.test.ts`:
```typescript
describe('theme transition', () => {
  it('loads transition from theme file', () => {
    const theme = loadTheme(null);
    expect(theme.transition).toBe('none');
  });

  it('defaults to none when transition not specified', () => {
    const theme = loadTheme(null);
    expect(theme.transition).toBe('none');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/theme.test.ts`
Expected: FAIL — `transition` property doesn't exist on Theme

- [ ] **Step 3: Add transition to Theme interface and loadTheme**

In `src/theme.ts`, update the `Theme` interface:
```typescript
export interface Theme {
  colors: Record<string, string>;
  font: { family: string; size: Record<string, number> };
  radius: number;
  shadow: string;
  spacing: Record<string, number>;
  transition: 'fade' | 'slide' | 'none';
}
```

Update `DEFAULT_THEME`:
```typescript
export const DEFAULT_THEME: Theme = {
  colors: {
    primary: '#2E86AB',
    secondary: '#A23B72',
    danger: '#E84855',
    bg: '#FFFFFF',
    text: '#1A1A2E',
    border: '#E0E0E0',
  },
  font: {
    family: 'Inter',
    size: { sm: 14, md: 16, lg: 20, xl: 28 },
  },
  radius: 8,
  shadow: '0 2px 8px rgba(0,0,0,0.1)',
  spacing: { sm: 8, md: 16, lg: 24, xl: 48 },
  transition: 'none',
};
```

Update `loadTheme` to apply default:
```typescript
export function loadTheme(path: string | null): Theme {
  if (!path) return { ...DEFAULT_THEME };
  const raw = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(raw);
  return { ...DEFAULT_THEME, ...parsed, transition: parsed.transition || 'none' };
}
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/theme.ts tests/theme.test.ts
git commit -m "feat: add transition field to Theme interface"
```

---

### Task 2: State Persistence (AST + Parser)

**Files:**
- Modify: `src/ast.ts`
- Modify: `src/parser.ts`
- Modify: `tests/parser.test.ts`

- [ ] **Step 1: Write failing parser test for persist**

Add to `tests/parser.test.ts`:
```typescript
  describe('state persistence', () => {
    it('parses persist field list', () => {
      const ast = parse(`STATE persist: cart, user
  cart: []
  user: null
  temp: ""
`);
      expect(ast.states[0].persist).toEqual(['cart', 'user']);
    });

    it('defaults to empty persist when not specified', () => {
      const ast = parse(`STATE
  count: 0
`);
      expect(ast.states[0].persist).toEqual([]);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parser.test.ts`
Expected: FAIL — `persist` not on StateNode

- [ ] **Step 3: Add persist to StateNode in ast.ts**

In `src/ast.ts`, update StateNode:
```typescript
export interface StateNode {
  type: 'STATE';
  fields: StateField[];
  persist: string[];
}
```

- [ ] **Step 4: Update parser to handle persist**

In `src/parser.ts`, update `parseState`. The `persist:` can come in two forms:
1. On the STATE keyword line itself: `STATE persist: cart, user`
2. As a property inside the STATE block: `  persist: cart, user`

For form 1, we need to update the lexer handling. But looking at the current lexer, `STATE` is matched by `trimmed === 'STATE'` (exact match). So `STATE persist: cart, user` won't match.

The simpler approach: treat `persist:` as a PROPERTY inside the STATE block (form 2, indented). But the spec says `STATE persist: cart, user` on the same line.

Let's support both. First update the lexer to handle `STATE persist: ...`:

In `src/lexer.ts`, update the STATE keyword matching:
```typescript
    // STATE keyword (with optional persist)
    if (trimmed === 'STATE' || trimmed.startsWith('STATE persist:')) {
      tokens.push({ type: 'KEYWORD', value: 'STATE', indent, line: lineNum });
      // If persist is on the same line, add it as a property token
      if (trimmed.startsWith('STATE persist:')) {
        const persistValue = trimmed.slice('STATE persist:'.length).trim();
        tokens.push({ type: 'PROPERTY', key: 'persist', value: persistValue, indent: indent + 2, line: lineNum });
      }
      continue;
    }
```

In `src/parser.ts`, update `parseState`:
```typescript
function parseState(tokens: Token[], start: number): [StateNode, number] {
  const baseIndent = tokens[start].indent;
  const node: StateNode = { type: 'STATE', fields: [], persist: [] };
  let i = start + 1;

  while (i < tokens.length) {
    const t = tokens[i];
    if (t.type === 'KEYWORD' || t.type === 'SEPARATOR' || t.indent <= baseIndent) break;
    if (t.type === 'PROPERTY') {
      if (t.key === 'persist') {
        node.persist = t.value.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        node.fields.push({ name: t.key, defaultValue: t.value });
      }
    }
    i++;
  }

  return [node, i];
}
```

- [ ] **Step 5: Fix existing tests that construct StateNode without persist**

Search all test files for `type: 'STATE'` and add `persist: []` to each StateNode literal. Files to update:
- `tests/generator/js.test.ts` — all StateNode literals
- `tests/e2e.test.ts` — uses `compile()` so no change needed

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/ast.ts src/lexer.ts src/parser.ts tests/parser.test.ts tests/generator/js.test.ts
git commit -m "feat: add persist field to STATE for localStorage persistence"
```

---

### Task 3: Generate Persist JS Code

**Files:**
- Modify: `src/generator/js.ts`
- Modify: `tests/generator/js.test.ts`

- [ ] **Step 1: Write failing test for persist JS generation**

Add to `tests/generator/js.test.ts`:
```typescript
  describe('state persistence', () => {
    it('generates _persistFields and _initPersist when persist is specified', () => {
      const persistAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [
          { name: 'cart', defaultValue: '[]' },
          { name: 'user', defaultValue: 'null' },
          { name: 'temp', defaultValue: '""' },
        ], persist: ['cart', 'user'] }],
        actions: [],
        apis: [],
        pages: [{ type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] }],
      };
      const js = generateJS(persistAst);
      expect(js).toContain("_persistFields");
      expect(js).toContain("'cart'");
      expect(js).toContain("'user'");
      expect(js).toContain("_initPersist");
      expect(js).toContain("localStorage");
      expect(js).toContain("neuron:");
    });

    it('does not generate persist code when no persist fields', () => {
      const noPersistAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [
          { name: 'count', defaultValue: '0' },
        ], persist: [] }],
        actions: [],
        apis: [],
        pages: [{ type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] }],
      };
      const js = generateJS(noPersistAst);
      expect(js).not.toContain('_persistFields');
      expect(js).not.toContain('localStorage');
    });

    it('_setState includes localStorage save for persist fields', () => {
      const persistAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [
          { name: 'cart', defaultValue: '[]' },
        ], persist: ['cart'] }],
        actions: [],
        apis: [],
        pages: [{ type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] }],
      };
      const js = generateJS(persistAst);
      expect(js).toContain('localStorage.setItem');
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/generator/js.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement persist code generation**

In `src/generator/js.ts`:

**a)** Update `generateSetState` to accept persist fields:
```typescript
function generateSetState(persistFields: string[]): string {
  if (persistFields.length === 0) {
    return `function _setState(key, val) {
  _state[key] = val;
  (_bindings[key] || []).forEach(fn => fn(val));
}`;
  }
  return `var _persistFields = [${persistFields.map(f => `'${f}'`).join(', ')}];

function _setState(key, val) {
  _state[key] = val;
  (_bindings[key] || []).forEach(fn => fn(val));
  if (_persistFields.indexOf(key) !== -1) {
    try { localStorage.setItem('neuron:' + key, JSON.stringify(val)); } catch(e) {}
  }
}`;
}
```

**b)** Add `generatePersist` function:
```typescript
function generatePersist(persistFields: string[]): string {
  if (persistFields.length === 0) return '';
  return `function _initPersist() {
  _persistFields.forEach(function(key) {
    try {
      var stored = localStorage.getItem('neuron:' + key);
      if (stored !== null) {
        _state[key] = JSON.parse(stored);
        (_bindings[key] || []).forEach(function(fn) { fn(_state[key]); });
      }
    } catch(e) {}
  });
}`;
}
```

**c)** Update the main `generateJS` function:

Extract persist fields:
```typescript
  const persistFields = ast.states.flatMap(s => s.persist || []);
```

Update the setState call:
```typescript
  // 3. _setState function
  lines.push(generateSetState(persistFields));
```

Add persist section after show-if:
```typescript
  // 6.6 Persist
  const persistCode = generatePersist(persistFields);
  if (persistCode) lines.push(persistCode);
```

Update `generateInit` to call `_initPersist`:
```typescript
function generateInit(ast: NeuronAST): string {
  const hasShowIf = collectShowIfComponents(ast).length > 0;
  const persistFields = ast.states.flatMap(s => s.persist || []);
  const showIfCall = hasShowIf ? '\n  _initShowIf();' : '';
  const persistCall = persistFields.length > 0 ? '\n  _initPersist();' : '';
  return `document.addEventListener('DOMContentLoaded', function() {
  _initBindings();${showIfCall}${persistCall}
  _initRouter();
  _autoLoad();
});`;
}
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/generator/js.ts tests/generator/js.test.ts
git commit -m "feat: generate localStorage persistence for STATE persist fields"
```

---

### Task 4: Page Transitions (CSS + Router)

**Files:**
- Modify: `src/generator/css.ts`
- Modify: `src/generator/js.ts`
- Modify: `tests/generator/css.test.ts`
- Modify: `tests/generator/js.test.ts`

- [ ] **Step 1: Write failing CSS test for transitions**

Add to `tests/generator/css.test.ts`:
```typescript
  it('generates fade transition CSS when theme.transition is fade', () => {
    const fadeTheme = { ...theme, transition: 'fade' as const };
    const css = generateCSS(fadeTheme);
    expect(css).toContain('neuron-page-active');
    expect(css).toContain('opacity');
    expect(css).toContain('transition');
  });

  it('generates slide transition CSS when theme.transition is slide', () => {
    const slideTheme = { ...theme, transition: 'slide' as const };
    const css = generateCSS(slideTheme);
    expect(css).toContain('neuron-page-active');
    expect(css).toContain('translateX');
  });

  it('does not generate transition CSS when theme.transition is none', () => {
    const noneTheme = { ...theme, transition: 'none' as const };
    const css = generateCSS(noneTheme);
    expect(css).not.toContain('neuron-page-active');
  });
```

Check the existing test file to see what variable name they use for theme. Use the same one.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/generator/css.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement transition CSS generation**

In `src/generator/css.ts`, add transition style constants:

```typescript
const FADE_TRANSITION = `
[data-page] {
  opacity: 0;
  transition: opacity 0.3s ease;
  position: absolute;
  width: 100%;
}
[data-page].neuron-page-active {
  opacity: 1;
  position: relative;
}
`;

const SLIDE_TRANSITION = `
[data-page] {
  transform: translateX(20px);
  opacity: 0;
  transition: transform 0.3s ease, opacity 0.3s ease;
  position: absolute;
  width: 100%;
}
[data-page].neuron-page-active {
  transform: translateX(0);
  opacity: 1;
  position: relative;
}
`;
```

Update `generateCSS`:
```typescript
export function generateCSS(theme: Theme): string {
  let css = themeToCSS(theme) + '\n' + BASE_STYLES;
  if (theme.transition === 'fade') {
    css += '\n' + FADE_TRANSITION;
  } else if (theme.transition === 'slide') {
    css += '\n' + SLIDE_TRANSITION;
  }
  return css;
}
```

- [ ] **Step 4: Run CSS tests**

Run: `npx vitest run tests/generator/css.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Write failing JS test for transition-aware router**

Add to `tests/generator/js.test.ts`:
```typescript
  describe('page transitions', () => {
    it('generates class-based render when transition mode is set', () => {
      const transAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [], persist: [] }],
        actions: [],
        apis: [],
        pages: [
          { type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] },
        ],
      };
      const js = generateJS(transAst, undefined, 'fade');
      expect(js).toContain('neuron-page-active');
      expect(js).toContain('requestAnimationFrame');
    });

    it('generates display-based render when transition is none', () => {
      const transAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [], persist: [] }],
        actions: [],
        apis: [],
        pages: [
          { type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] },
        ],
      };
      const js = generateJS(transAst, undefined, 'none');
      expect(js).not.toContain('neuron-page-active');
    });
  });
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/generator/js.test.ts`
Expected: FAIL — `generateJS` doesn't accept transition parameter

- [ ] **Step 7: Add transition parameter to generateJS and update router**

In `src/generator/js.ts`, update the signature:
```typescript
export function generateJS(ast: NeuronAST, logicFiles?: Record<string, string>, transition?: string): string {
```

Pass transition to generateRouter:
```typescript
  // 4. Router
  lines.push(generateRouter(ast, transition || 'none'));
```

Update `generateRouter` to accept and use transition mode:
```typescript
function generateRouter(ast: NeuronAST, transition: string): string {
```

Replace the `render` function inside `generateRouter` based on transition:

```typescript
  let render: string;
  if (transition === 'none') {
    render = `function _render(route) {
  var pageName = _matchRoute(route);
  document.querySelectorAll('[data-page]').forEach(function(el) {
    el.style.display = el.getAttribute('data-page') === pageName ? '' : 'none';
  });
}`;
  } else {
    render = `function _render(route) {
  var pageName = _matchRoute(route);
  document.querySelectorAll('[data-page]').forEach(function(el) {
    if (el.getAttribute('data-page') === pageName) {
      el.style.display = '';
      requestAnimationFrame(function() {
        el.classList.add('neuron-page-active');
      });
    } else {
      el.classList.remove('neuron-page-active');
      el.addEventListener('transitionend', function handler() {
        if (!el.classList.contains('neuron-page-active')) {
          el.style.display = 'none';
        }
        el.removeEventListener('transitionend', handler);
      });
    }
  });
}`;
  }
```

- [ ] **Step 8: Update compiler to pass transition to generateJS**

In `src/compiler.ts`, update the JS generation call:
```typescript
  const js = generateJS(ast, logicFiles, theme.transition || 'none');
```

- [ ] **Step 9: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 10: Commit**

```bash
git add src/generator/css.ts src/generator/js.ts src/compiler.ts tests/generator/css.test.ts tests/generator/js.test.ts
git commit -m "feat: implement page transitions (fade/slide) via theme config"
```

---

### Task 5: Responsive Layout CSS

**Files:**
- Modify: `src/generator/css.ts`
- Modify: `tests/generator/css.test.ts`

- [ ] **Step 1: Write failing test for responsive CSS**

Add to `tests/generator/css.test.ts`:
```typescript
  it('includes responsive media queries', () => {
    const css = generateCSS(theme);
    expect(css).toContain('@media (max-width: 768px)');
    expect(css).toContain('grid-template-columns: 1fr');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/generator/css.test.ts`
Expected: FAIL

- [ ] **Step 3: Add responsive CSS to BASE_STYLES**

In `src/generator/css.ts`, add before the closing backtick of `BASE_STYLES`:

```css

@media (max-width: 768px) {
  .neuron-product-grid,
  .neuron-grid {
    grid-template-columns: 1fr !important;
  }

  .neuron-header {
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  .neuron-header nav {
    flex-wrap: wrap;
    justify-content: center;
  }

  .neuron-hero {
    padding: var(--spacing-lg) var(--spacing-md);
  }
  .neuron-hero h2 {
    font-size: var(--font-size-lg);
  }

  .neuron-form {
    padding: var(--spacing-md);
    max-width: 100%;
  }

  .neuron-cart-item {
    flex-wrap: wrap;
  }
  .neuron-cart-item__img {
    width: 60px;
    height: 60px;
  }

  .neuron-modal-body {
    min-width: auto;
    margin: var(--spacing-md);
    max-width: calc(100vw - 48px);
  }
}
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/generator/css.ts tests/generator/css.test.ts
git commit -m "feat: add responsive layout CSS with mobile breakpoint"
```

---

### Task 6: Loading/Error Internal State and CSS

**Files:**
- Modify: `src/generator/js.ts`
- Modify: `src/generator/css.ts`
- Modify: `tests/generator/js.test.ts`
- Modify: `tests/generator/css.test.ts`

- [ ] **Step 1: Write failing test for loading/error state initialization**

Add to `tests/generator/js.test.ts`:
```typescript
  describe('loading and error state', () => {
    it('generates _loading and _error in state when APIs exist', () => {
      const apiAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [{ name: 'products', defaultValue: '[]' }], persist: [] }],
        actions: [],
        apis: [{ type: 'API', name: 'products', method: 'GET', endpoint: '/api/products', options: { on_load: 'true' } }],
        pages: [{ type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] }],
      };
      const js = generateJS(apiAst);
      expect(js).toContain('"_loading": {}');
      expect(js).toContain('"_error": {}');
    });

    it('does not generate _loading/_error when no APIs', () => {
      const noApiAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [{ name: 'count', defaultValue: '0' }], persist: [] }],
        actions: [],
        apis: [],
        pages: [{ type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] }],
      };
      const js = generateJS(noApiAst);
      expect(js).not.toContain('"_loading"');
      expect(js).not.toContain('"_error"');
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/generator/js.test.ts`
Expected: FAIL

- [ ] **Step 3: Add _loading/_error to state and bindings when APIs exist**

In `src/generator/js.ts`, update `generateState`:
```typescript
function generateState(ast: NeuronAST): string {
  const fields = ast.states.flatMap(s => s.fields);
  const entries = fields.map(f => `  "${f.name}": ${f.defaultValue}`);
  entries.push('  "_params": {}');
  if (ast.apis.length > 0) {
    entries.push('  "_loading": {}');
    entries.push('  "_error": {}');
  }
  return `const _state = {\n${entries.join(',\n')}\n};`;
}
```

Update `generateBindings`:
```typescript
function generateBindings(ast: NeuronAST): string {
  const fields = ast.states.flatMap(s => s.fields);
  const entries = fields.map(f => `  "${f.name}": []`);
  entries.push('  "_params": []');
  if (ast.apis.length > 0) {
    entries.push('  "_loading": []');
    entries.push('  "_error": []');
  }
  return `const _bindings = {\n${entries.join(',\n')}\n};`;
}
```

- [ ] **Step 4: Write failing test for loading/error CSS**

Add to `tests/generator/css.test.ts`:
```typescript
  it('includes loading spinner and error styles', () => {
    const css = generateCSS(theme);
    expect(css).toContain('.neuron-loading');
    expect(css).toContain('neuron-spin');
    expect(css).toContain('.neuron-error');
  });
```

- [ ] **Step 5: Add loading/error CSS to BASE_STYLES**

In `src/generator/css.ts`, add to `BASE_STYLES` before the responsive media query:

```css

.neuron-loading {
  text-align: center;
  padding: var(--spacing-xl);
}
.neuron-loading::after {
  content: '';
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: neuron-spin 0.6s linear infinite;
}
@keyframes neuron-spin {
  to { transform: rotate(360deg); }
}

.neuron-error {
  padding: var(--spacing-md);
  background: #fef2f2;
  color: var(--color-danger);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius);
  margin: var(--spacing-md) 0;
}
```

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/generator/js.ts src/generator/css.ts tests/generator/js.test.ts tests/generator/css.test.ts
git commit -m "feat: add loading/error internal state and CSS styles"
```

---

### Task 7: Loading/Error Wrapping in API Calls

**Files:**
- Modify: `src/generator/js.ts`
- Modify: `tests/generator/js.test.ts`

- [ ] **Step 1: Write failing test for autoLoad with loading/error wrapping**

Add to `tests/generator/js.test.ts`:
```typescript
  describe('API loading/error wrapping', () => {
    it('wraps autoLoad with loading/error state updates', () => {
      const apiAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [{ name: 'products', defaultValue: '[]' }], persist: [] }],
        actions: [],
        apis: [{ type: 'API', name: 'products', method: 'GET', endpoint: '/api/products', options: { on_load: 'true' } }],
        pages: [{ type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] }],
      };
      const js = generateJS(apiAst);
      // Should set _loading.products = true before fetch
      expect(js).toContain("products: true");
      // Should set _loading.products = false after fetch
      expect(js).toContain("products: false");
      // Should set _error on catch
      expect(js).toContain("_error");
      expect(js).toContain("err.message");
    });

    it('wraps call action with loading/error state updates', () => {
      const callAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [{ name: 'cart', defaultValue: '[]' }], persist: [] }],
        actions: [{ type: 'ACTION', name: 'pay', steps: [
          { key: 'call', value: 'orders' },
          { key: 'on_success', value: '-> /complete' },
        ]}],
        apis: [{ type: 'API', name: 'orders', method: 'POST', endpoint: '/api/orders', options: { body: 'cart' } }],
        pages: [{ type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] }],
      };
      const js = generateJS(callAst);
      expect(js).toContain("orders: true");
      expect(js).toContain("orders: false");
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/generator/js.test.ts`
Expected: FAIL

- [ ] **Step 3: Update generateAutoLoad with loading/error wrapping**

In `src/generator/js.ts`, replace `generateAutoLoad`:
```typescript
function generateAutoLoad(ast: NeuronAST): string {
  const autoApis = ast.apis.filter(a => a.options.on_load === 'true');
  if (autoApis.length === 0) return 'function _autoLoad() {}';

  const calls = autoApis.map(api => {
    return `  _setState('_loading', Object.assign({}, _state._loading, { ${api.name}: true }));
  fetch('${api.endpoint}')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      _setState('${api.name}', data);
      _setState('_loading', Object.assign({}, _state._loading, { ${api.name}: false }));
      _setState('_error', Object.assign({}, _state._error, { ${api.name}: null }));
    })
    .catch(function(err) {
      _setState('_loading', Object.assign({}, _state._loading, { ${api.name}: false }));
      _setState('_error', Object.assign({}, _state._error, { ${api.name}: err.message }));
    });`;
  });

  return `function _autoLoad() {\n${calls.join('\n')}\n}`;
}
```

- [ ] **Step 4: Update call action pattern with loading/error wrapping**

In `src/generator/js.ts`, in the `generateActionBody` function, update the `call` pattern. Replace the entire `if (stepMap.has('call'))` block:

```typescript
  // call pattern: call an API
  if (stepMap.has('call')) {
    const apiName = stepMap.get('call')!;
    const api = apiMap.get(apiName);
    if (!api) {
      return `function() { console.warn('API ${apiName} not found'); }`;
    }

    const onSuccess = stepMap.get('on_success');
    const onError = stepMap.get('on_error');
    const queryState = stepMap.get('query');
    const targetState = stepMap.get('target');

    let urlExpr: string;
    if (queryState) {
      urlExpr = `\`${api.endpoint}?q=\${encodeURIComponent(_state.${queryState})}\``;
    } else {
      urlExpr = `'${api.endpoint}'`;
    }

    const fetchOptions: string[] = [];
    fetchOptions.push(`method: '${api.method}'`);
    fetchOptions.push(`headers: { 'Content-Type': 'application/json' }`);
    if (api.options.body) {
      fetchOptions.push(`body: JSON.stringify(_state.${api.options.body})`);
    }

    let successCode = '';
    if (onSuccess) {
      if (onSuccess.startsWith('->')) {
        const route = onSuccess.replace('->', '').trim();
        successCode = `_navigate('${route}');`;
      } else {
        successCode = `_setState('${onSuccess}', data);`;
      }
    }
    if (targetState) {
      successCode = `_setState('${targetState}', data);`;
    }

    const errorLabel = onError ? `'${onError}', ` : '';

    return `async function() {
      _setState('_loading', Object.assign({}, _state._loading, { ${apiName}: true }));
      try {
        var res = await fetch(${urlExpr}, {
          ${fetchOptions.join(',\n          ')}
        });
        var data = await res.json();
        ${successCode}
        _setState('_loading', Object.assign({}, _state._loading, { ${apiName}: false }));
        _setState('_error', Object.assign({}, _state._error, { ${apiName}: null }));
      } catch(err) {
        console.error(${errorLabel}err);
        _setState('_loading', Object.assign({}, _state._loading, { ${apiName}: false }));
        _setState('_error', Object.assign({}, _state._error, { ${apiName}: err.message }));
      }
    }`;
  }
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/generator/js.ts tests/generator/js.test.ts
git commit -m "feat: wrap API calls with loading/error state management"
```

---

### Task 8: Loading/Error in Runtime Renderers

**Files:**
- Modify: `src/generator/js.ts`
- Modify: `tests/generator/js.test.ts`

- [ ] **Step 1: Write failing test for loading indicator in product-grid renderer**

Add to `tests/generator/js.test.ts`:
```typescript
  describe('loading/error in renderers', () => {
    it('product-grid renderer checks _loading state', () => {
      const gridAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [{ name: 'products', defaultValue: '[]' }], persist: [] }],
        actions: [],
        apis: [{ type: 'API', name: 'products', method: 'GET', endpoint: '/api/products', options: { on_load: 'true' } }],
        pages: [{
          type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [],
          components: [{
            type: 'COMPONENT', componentType: 'product-grid',
            properties: [{ key: 'data', value: 'products' }],
            children: [],
          }],
        }],
      };
      const js = generateJS(gridAst);
      expect(js).toContain('_state._loading');
      expect(js).toContain('neuron-loading');
      expect(js).toContain('_state._error');
      expect(js).toContain('neuron-error');
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/generator/js.test.ts`
Expected: FAIL

- [ ] **Step 3: Update product-grid runtime renderer**

In `src/generator/js.ts`, in `generateRuntimeRenderers`, update the `product-grid` renderer. After the line `grid.style.gridTemplateColumns = ...`, add loading/error checks:

Find the product-grid section and insert loading/error before the empty check:
```typescript
      parts.push(`function ${bc.rendererId}(items) {
  document.querySelectorAll('.neuron-product-grid').forEach(function(grid) {
    var cols = grid.getAttribute('data-cols') || '3';
    var action = grid.getAttribute('data-action');
    var source = grid.getAttribute('data-source');
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
    if (_state._loading && _state._loading[source]) {
      grid.innerHTML = '<div class="neuron-loading"></div>';
      return;
    }
    if (_state._error && _state._error[source]) {
      grid.innerHTML = '<div class="neuron-error">' + _state._error[source] + '</div>';
      return;
    }
    if (!items || items.length === 0) {
```

Do the same for `cart-list` and `list` renderers — add loading/error checks at the beginning of each renderer function body. For `cart-list`, use the `state` attribute as the source:
```typescript
    var stateField = list.getAttribute('data-state');
    if (_state._loading && _state._loading[stateField]) {
      list.innerHTML = '<div class="neuron-loading"></div>';
      return;
    }
    if (_state._error && _state._error[stateField]) {
      list.innerHTML = '<div class="neuron-error">' + _state._error[stateField] + '</div>';
      return;
    }
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/generator/js.ts tests/generator/js.test.ts
git commit -m "feat: add loading/error indicators to data-bound component renderers"
```

---

### Task 9: End-to-End Integration Test

**Files:**
- Modify: `tests/e2e.test.ts`

- [ ] **Step 1: Add Phase 2 e2e test**

Add to `tests/e2e.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e.test.ts
git commit -m "test: add Phase 2 runtime features e2e test"
```

---

### Task 10: Update Documentation

**Files:**
- Modify: `REFERENCE.md`
- Modify: `README.md`

- [ ] **Step 1: Update REFERENCE.md**

Add these sections:

**State persistence** — in the STATE section:
```markdown
### State Persistence

```
STATE persist: cart, user
  cart: []
  user: null
  temp: ""
```

Fields listed after `persist:` are automatically saved to localStorage and restored on page load. Key format: `neuron:{fieldName}`.
```

**Transitions** — in the Theme section:
```markdown
### Transitions

Add `transition` to theme.json:

```json
{
  "transition": "fade"
}
```

Values: `"fade"` (opacity), `"slide"` (translateX + opacity), `"none"` (default, instant)
```

**Loading/Error** — new section:
```markdown
## Loading & Error States

API calls automatically track loading and error states:

- `_state._loading.apiName` — `true` while fetching, `false` when done
- `_state._error.apiName` — error message string or `null`

Data components (`product-grid`, `cart-list`) automatically display:
- Spinner while loading
- Error message on failure

Use `show_if` for custom loading/error UI:
```
text
  content: "Loading..."
  show_if: _loading
```
```

- [ ] **Step 2: Update README.md**

Add Phase 2 features to the "새 기능" section.

- [ ] **Step 3: Commit**

```bash
git add REFERENCE.md README.md
git commit -m "docs: update docs with Phase 2 runtime quality features"
```

---

### Task 11: Build Verification

**Files:** None

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Build the project**

Run: `npm run build`
Expected: Success

- [ ] **Step 3: Test the built CLI**

```bash
cd /tmp && rm -rf neuron-p2-test && mkdir neuron-p2-test && cd neuron-p2-test
node /Users/guest-user/workspace/neuron/dist/index.js new my-app
cd my-app
node /Users/guest-user/workspace/neuron/dist/index.js build
ls dist/
```

Expected: `index.html`, `style.css`, `main.js`, `serve.js`, `assets/`

- [ ] **Step 4: Clean up**

```bash
rm -rf /tmp/neuron-p2-test
```
