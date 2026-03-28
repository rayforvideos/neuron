# Phase 1: DSL Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Neuron DSL with 5 new action patterns, external JS logic delegation (`use:`), dynamic routing, conditional rendering (`show_if`), and form validation.

**Architecture:** Each feature extends the existing Lexer → Parser → Generator pipeline. AST types are extended first, then parser changes, then generator changes. The `use:` feature adds a new `logic/` directory concept and inline JS bundling in the compiler. All features maintain the existing `key: value` property pattern — no new keywords.

**Tech Stack:** TypeScript, Vitest, tsup

---

## File Structure

| File | Responsibility | Change Type |
|------|---------------|-------------|
| `src/ast.ts` | AST type definitions | Modify: add `params` to PageNode, `showIf` to ComponentNode, `FormFieldValidation` type |
| `src/lexer.ts` | Tokenization | Modify: add FIELD_PROPERTY token for 6-space indent form sub-properties |
| `src/parser.ts` | AST generation | Modify: parse dynamic route params, show_if, form field sub-properties, use: steps |
| `src/generator/js.ts` | JS code generation | Modify: 5 new action patterns, use: bundling, pattern-based router, show_if bindings, form validation |
| `src/components/registry.ts` | Component HTML renderers | Modify: form renderer with type/required/min/max attributes |
| `src/generator/css.ts` | CSS generation | Modify: add form validation styles |
| `src/compiler.ts` | Compile pipeline orchestration | Modify: scan logic/ directory, pass logicFiles to generator |
| `src/errors.ts` | Error messages | Modify: add new error codes for new features |
| `src/cli.ts` | CLI commands | Modify: scaffold logic/ directory in `neuron new` |
| `src/scaffold.ts` | Project scaffolding | Modify: create logic/ directory |
| `tests/ast-types.test.ts` | AST type tests | Create |
| `tests/lexer.test.ts` | Lexer tests | Modify: add form field sub-property tests |
| `tests/parser.test.ts` | Parser tests | Modify: add tests for all new parse features |
| `tests/generator/js.test.ts` | JS generator tests | Modify: add tests for new actions, router, show_if, form validation, use: |
| `tests/components/registry.test.ts` | Component renderer tests | Modify: add form validation attribute tests |
| `tests/generator/css.test.ts` | CSS generator tests | Modify: add form validation style tests |
| `tests/compiler.test.ts` | Compiler tests | Modify: add logic/ file scanning test |
| `tests/errors.test.ts` | Error message tests | Modify: add new error code tests |
| `tests/e2e.test.ts` | End-to-end tests | Modify: add todo app e2e test using new features |
| `templates/logic/example.js` | Template logic file | Create |

---

### Task 1: Extend AST Types

**Files:**
- Modify: `src/ast.ts`
- Create: `tests/ast-types.test.ts`

- [ ] **Step 1: Write failing test for new AST types**

```typescript
// tests/ast-types.test.ts
import { describe, it, expect } from 'vitest';
import type {
  PageNode,
  ComponentNode,
  FormFieldValidation,
} from '../src/ast';

describe('AST types', () => {
  it('PageNode supports params field', () => {
    const page: PageNode = {
      type: 'PAGE',
      name: 'detail',
      title: 'Detail',
      route: '/item/:id',
      params: ['id'],
      components: [],
    };
    expect(page.params).toEqual(['id']);
  });

  it('ComponentNode supports showIf field', () => {
    const comp: ComponentNode = {
      type: 'COMPONENT',
      componentType: 'button',
      properties: [],
      children: [],
      showIf: { field: 'user', negate: false },
    };
    expect(comp.showIf).toEqual({ field: 'user', negate: false });
  });

  it('ComponentNode showIf supports negation', () => {
    const comp: ComponentNode = {
      type: 'COMPONENT',
      componentType: 'button',
      properties: [],
      children: [],
      showIf: { field: 'user', negate: true },
    };
    expect(comp.showIf!.negate).toBe(true);
  });

  it('FormFieldValidation type works', () => {
    const validation: FormFieldValidation = {
      type: 'email',
      required: true,
      min: 5,
      max: 100,
    };
    expect(validation.type).toBe('email');
    expect(validation.required).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ast-types.test.ts`
Expected: FAIL — `FormFieldValidation` not exported, `params` not in PageNode, `showIf` not in ComponentNode

- [ ] **Step 3: Update AST types**

In `src/ast.ts`, make these changes:

Add `FormFieldValidation` interface after `ComponentProperty`:
```typescript
export interface FormFieldValidation {
  type?: string;        // 'text' | 'email' | 'password' | 'number' | 'tel' | 'url'
  required?: boolean;
  min?: number;
  max?: number;
}
```

Add `params` to `PageNode`:
```typescript
export interface PageNode {
  type: 'PAGE';
  name: string;
  title: string;
  route: string;
  params: string[];     // NEW: dynamic route params e.g. ['id']
  components: ComponentNode[];
}
```

Add `showIf` to `ComponentNode`:
```typescript
export interface ComponentNode {
  type: 'COMPONENT';
  componentType: string;
  inlineLabel?: string;
  inlineAction?: string;
  properties: ComponentProperty[];
  children: ComponentNode[];
  showIf?: { field: string; negate: boolean };  // NEW
}
```

- [ ] **Step 4: Fix existing tests that construct PageNode without params**

The parser's `parsePage` function creates PageNode without `params`. Update it to include `params: []`:

In `src/parser.ts`, in the `parsePage` function, change the PageNode construction:
```typescript
  const node: PageNode = {
    type: 'PAGE',
    name: keyword.name,
    title: keyword.title,
    route: keyword.route,
    params: [],           // NEW: default empty, populated by Task 4
    components: [],
  };
```

Also update every test file that constructs a `PageNode` literal to include `params: []`:
- `tests/generator/js.test.ts` — all PageNode literals (lines 29-31, 99, 113, 127, 139, 191)
- `tests/e2e.test.ts` — no change needed (uses compile() which handles it)

- [ ] **Step 5: Run all tests to verify nothing breaks**

Run: `npx vitest run`
Expected: ALL PASS (56 existing + 4 new = 60 tests)

- [ ] **Step 6: Commit**

```bash
git add src/ast.ts src/parser.ts tests/ast-types.test.ts tests/generator/js.test.ts
git commit -m "feat: extend AST types for Phase 1 (params, showIf, FormFieldValidation)"
```

---

### Task 2: New Error Codes

**Files:**
- Modify: `src/errors.ts`
- Modify: `tests/errors.test.ts`

- [ ] **Step 1: Write failing tests for new error codes**

Add to `tests/errors.test.ts`:
```typescript
  it('formats unknown_action_pattern error', () => {
    const err = new NeuronError('unknown_action_pattern', 'push', {});
    expect(formatError(err)).toContain('push');
    expect(formatError(err)).toContain('append, remove, call, set, toggle, increment, decrement, navigate, use');
  });

  it('formats logic_file_not_found error', () => {
    const err = new NeuronError('logic_file_not_found', 'logic/todos.js', {});
    expect(formatError(err)).toContain('logic/todos.js');
  });

  it('formats logic_function_not_found error', () => {
    const err = new NeuronError('logic_function_not_found', 'addTodo', { file: 'logic/todos.js' });
    expect(formatError(err)).toContain('addTodo');
    expect(formatError(err)).toContain('logic/todos.js');
  });

  it('formats invalid_show_if error', () => {
    const err = new NeuronError('invalid_show_if', 'user && admin', {});
    expect(formatError(err)).toContain('user && admin');
  });

  it('formats invalid_form_field_type error', () => {
    const err = new NeuronError('invalid_form_field_type', 'date', {});
    expect(formatError(err)).toContain('date');
    expect(formatError(err)).toContain('text, email, password, number, tel, url');
  });

  it('formats invalid_route_param error', () => {
    const err = new NeuronError('invalid_route_param', '/product/:', {});
    expect(formatError(err)).toContain('/product/:');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/errors.test.ts`
Expected: FAIL — new error codes not in ErrorCode type

- [ ] **Step 3: Add new error codes and messages**

In `src/errors.ts`:

Update the `ErrorCode` type:
```typescript
export type ErrorCode =
  | 'unknown_component'
  | 'undefined_state'
  | 'undefined_action'
  | 'undefined_api'
  | 'parse_error'
  | 'unknown_action_pattern'
  | 'logic_file_not_found'
  | 'logic_function_not_found'
  | 'invalid_show_if'
  | 'invalid_form_field_type'
  | 'invalid_route_param';
```

Add new messages to the `messages` record:
```typescript
  unknown_action_pattern: (target) =>
    `[NEURON ERROR] 알 수 없는 액션 패턴: "${target}"\n→ 사용 가능: append, remove, call, set, toggle, increment, decrement, navigate, use`,
  logic_file_not_found: (target) =>
    `[NEURON ERROR] ${target} 파일을 찾을 수 없습니다\n→ logic/ 디렉토리에 해당 파일을 생성하세요`,
  logic_function_not_found: (target, meta) =>
    `[NEURON ERROR] ${meta.file}에서 "${target}" 함수를 찾을 수 없습니다\n→ export function ${target}(state, payload) { ... } 형태로 내보내세요`,
  invalid_show_if: (target) =>
    `[NEURON ERROR] show_if 조건이 잘못되었습니다: "${target}"\n→ show_if는 단일 필드만 지원합니다: show_if: user 또는 show_if: !user`,
  invalid_form_field_type: (target) =>
    `[NEURON ERROR] 폼 필드 타입이 잘못되었습니다: "${target}"\n→ 사용 가능: text, email, password, number, tel, url`,
  invalid_route_param: (target) =>
    `[NEURON ERROR] 동적 라우트 파라미터 이름이 비어 있습니다: ${target}\n→ /product/:id 형태로 파라미터 이름을 지정하세요`,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/errors.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/errors.ts tests/errors.test.ts
git commit -m "feat: add error codes for new DSL features"
```

---

### Task 3: New Action Patterns (set, toggle, increment, decrement, navigate)

**Files:**
- Modify: `src/generator/js.ts`
- Modify: `tests/generator/js.test.ts`

- [ ] **Step 1: Write failing tests for new action patterns**

Add to `tests/generator/js.test.ts` inside the top-level `describe('generateJS')`:
```typescript
  describe('new action patterns', () => {
    it('generates set action', () => {
      const setAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [{ name: 'query', defaultValue: '""' }] }],
        actions: [{ type: 'ACTION', name: 'clear-search', steps: [{ key: 'set', value: 'query -> ""' }] }],
        apis: [],
        pages: [{ type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] }],
      };
      const js = generateJS(setAst);
      expect(js).toContain("'clear-search'");
      expect(js).toContain("_setState('query'");
    });

    it('generates set action with null value', () => {
      const setAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [{ name: 'user', defaultValue: 'null' }] }],
        actions: [{ type: 'ACTION', name: 'logout', steps: [{ key: 'set', value: 'user -> null' }] }],
        apis: [],
        pages: [{ type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] }],
      };
      const js = generateJS(setAst);
      expect(js).toContain("_setState('user', null)");
    });

    it('generates toggle action', () => {
      const toggleAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [{ name: 'darkMode', defaultValue: 'false' }] }],
        actions: [{ type: 'ACTION', name: 'toggle-dark', steps: [{ key: 'toggle', value: 'darkMode' }] }],
        apis: [],
        pages: [{ type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] }],
      };
      const js = generateJS(toggleAst);
      expect(js).toContain("'toggle-dark'");
      expect(js).toContain("!_state.darkMode");
    });

    it('generates increment action', () => {
      const incAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [{ name: 'count', defaultValue: '0' }] }],
        actions: [{ type: 'ACTION', name: 'increase', steps: [{ key: 'increment', value: 'count' }] }],
        apis: [],
        pages: [{ type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] }],
      };
      const js = generateJS(incAst);
      expect(js).toContain("'increase'");
      expect(js).toContain("_state.count + 1");
    });

    it('generates decrement action', () => {
      const decAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [{ name: 'count', defaultValue: '0' }] }],
        actions: [{ type: 'ACTION', name: 'decrease', steps: [{ key: 'decrement', value: 'count' }] }],
        apis: [],
        pages: [{ type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] }],
      };
      const js = generateJS(decAst);
      expect(js).toContain("'decrease'");
      expect(js).toContain("_state.count - 1");
    });

    it('generates navigate action', () => {
      const navAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [] }],
        actions: [{ type: 'ACTION', name: 'go-home', steps: [{ key: 'navigate', value: '/' }] }],
        apis: [],
        pages: [{ type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] }],
      };
      const js = generateJS(navAst);
      expect(js).toContain("'go-home'");
      expect(js).toContain("_navigate('/')");
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/generator/js.test.ts`
Expected: FAIL — new patterns not generating expected code

- [ ] **Step 3: Implement new action patterns in generateActionBody**

In `src/generator/js.ts`, in the `generateActionBody` function, add these patterns after the existing `call` pattern block (before the final `return 'function() {}'`):

```typescript
  // set pattern: "field -> value"
  if (stepMap.has('set')) {
    const val = stepMap.get('set')!;
    const parts = val.split('->').map(s => s.trim());
    const field = parts[0];
    const rawValue = parts[1];
    // Parse value: "string" stays quoted, null/true/false/numbers are bare
    let jsValue: string;
    if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
      jsValue = rawValue;
    } else if (rawValue === 'null' || rawValue === 'true' || rawValue === 'false') {
      jsValue = rawValue;
    } else if (rawValue === '[]') {
      jsValue = '[]';
    } else if (!isNaN(Number(rawValue))) {
      jsValue = rawValue;
    } else {
      jsValue = `'${rawValue}'`;
    }
    return `function() {\n    _setState('${field}', ${jsValue});\n  }`;
  }

  // toggle pattern: "field"
  if (stepMap.has('toggle')) {
    const field = stepMap.get('toggle')!.trim();
    return `function() {\n    _setState('${field}', !_state.${field});\n  }`;
  }

  // increment pattern: "field"
  if (stepMap.has('increment')) {
    const field = stepMap.get('increment')!.trim();
    return `function() {\n    _setState('${field}', _state.${field} + 1);\n  }`;
  }

  // decrement pattern: "field"
  if (stepMap.has('decrement')) {
    const field = stepMap.get('decrement')!.trim();
    return `function() {\n    _setState('${field}', _state.${field} - 1);\n  }`;
  }

  // navigate pattern: "/route"
  if (stepMap.has('navigate')) {
    const route = stepMap.get('navigate')!.trim();
    return `function() {\n    _navigate('${route}');\n  }`;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/generator/js.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/generator/js.ts tests/generator/js.test.ts
git commit -m "feat: add set, toggle, increment, decrement, navigate action patterns"
```

---

### Task 4: Dynamic Routing

**Files:**
- Modify: `src/parser.ts`
- Modify: `src/generator/js.ts`
- Modify: `tests/parser.test.ts`
- Modify: `tests/generator/js.test.ts`

- [ ] **Step 1: Write failing parser test for dynamic route params**

Add to `tests/parser.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parser.test.ts`
Expected: FAIL — params not extracted (all empty arrays)

- [ ] **Step 3: Implement param extraction in parsePage**

In `src/parser.ts`, in the `parsePage` function, after constructing the `node`, extract params from the route:

```typescript
  // Extract dynamic route params
  const paramMatches = keyword.route.matchAll(/:(\w+)/g);
  for (const match of paramMatches) {
    node.params.push(match[1]);
  }
```

Place this right after the `const node: PageNode = { ... }` block, before the `while` loop.

- [ ] **Step 4: Run parser tests to verify they pass**

Run: `npx vitest run tests/parser.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Write failing test for dynamic router generation**

Add to `tests/generator/js.test.ts`:
```typescript
  describe('dynamic routing', () => {
    it('generates pattern-based router for dynamic routes', () => {
      const dynAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [] }],
        actions: [],
        apis: [],
        pages: [
          { type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] },
          { type: 'PAGE', name: 'detail', title: 'Detail', route: '/item/:id', params: ['id'], components: [] },
        ],
      };
      const js = generateJS(dynAst);
      // Should generate pattern-based routes array instead of simple object
      expect(js).toContain('const _routes = [');
      expect(js).toContain("params: ['id']");
      expect(js).toContain('_setState');
      expect(js).toContain('_params');
    });

    it('generates static-only router when no dynamic routes', () => {
      const staticAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [] }],
        actions: [],
        apis: [],
        pages: [
          { type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] },
          { type: 'PAGE', name: 'about', title: 'About', route: '/about', params: [], components: [] },
        ],
      };
      const js = generateJS(staticAst);
      // Even static routes should use the new pattern-based array format for consistency
      expect(js).toContain('const _routes = [');
    });

    it('generates multi-param route matching', () => {
      const multiAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [] }],
        actions: [],
        apis: [],
        pages: [
          { type: 'PAGE', name: 'edit', title: 'Edit', route: '/cat/:catId/item/:itemId', params: ['catId', 'itemId'], components: [] },
        ],
      };
      const js = generateJS(multiAst);
      expect(js).toContain("params: ['catId', 'itemId']");
    });
  });
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/generator/js.test.ts`
Expected: FAIL — still generating old `const _routes = {` format

- [ ] **Step 7: Rewrite generateRouter for pattern-based matching**

In `src/generator/js.ts`, replace the entire `generateRouter` function:

```typescript
function generateRouter(ast: NeuronAST): string {
  // Build route entries as pattern-based array
  const routeEntries = ast.pages.map(p => {
    // Convert route like "/item/:id" to regex pattern /^\/item\/([^/]+)$/
    const regexStr = p.route
      .replace(/:[a-zA-Z_]\w*/g, '([^/]+)')
      .replace(/\//g, '\\/');
    const paramsArr = p.params.map(param => `'${param}'`).join(', ');
    return `  { pattern: /^${regexStr}$/, page: '${p.name}', params: [${paramsArr}] }`;
  });
  const routeArray = `const _routes = [\n${routeEntries.join(',\n')}\n];`;

  const matchRoute = `function _matchRoute(path) {
  for (var i = 0; i < _routes.length; i++) {
    var route = _routes[i];
    var match = path.match(route.pattern);
    if (match) {
      var paramValues = {};
      route.params.forEach(function(name, idx) {
        paramValues[name] = match[idx + 1];
      });
      _setState('_params', paramValues);
      return route.page;
    }
  }
  return _routes[0] ? _routes[0].page : null;
}`;

  const navigate = `function _navigate(route) {
  history.pushState(null, '', route);
  _render(route);
}`;

  const render = `function _render(route) {
  var pageName = _matchRoute(route);
  document.querySelectorAll('[data-page]').forEach(function(el) {
    el.style.display = el.getAttribute('data-page') === pageName ? '' : 'none';
  });
}`;

  const initRouter = `function _initRouter() {
  document.addEventListener('click', function(e) {
    var link = e.target.closest('[data-link]');
    if (link) {
      e.preventDefault();
      _navigate(link.getAttribute('data-link') || link.getAttribute('href'));
    }
    var actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      e.preventDefault();
      var name = actionEl.getAttribute('data-action');
      if (_actions[name]) _actions[name]();
    }
  });
  window.addEventListener('popstate', function() {
    _render(location.pathname);
  });
  _render(location.pathname);
}`;

  return [routeArray, matchRoute, navigate, render, initRouter].join('\n\n');
}
```

- [ ] **Step 8: Update generateBindings to include _params**

In `src/generator/js.ts`, update the `generateBindings` function to always include `_params`:

```typescript
function generateBindings(ast: NeuronAST): string {
  const fields = ast.states.flatMap(s => s.fields);
  const entries = fields.map(f => `  "${f.name}": []`);
  entries.push(`  "_params": []`);
  return `const _bindings = {\n${entries.join(',\n')}\n};`;
}
```

Also update `generateState` to include `_params`:
```typescript
function generateState(ast: NeuronAST): string {
  const fields = ast.states.flatMap(s => s.fields);
  const entries = fields.map(f => `  "${f.name}": ${f.defaultValue}`);
  entries.push(`  "_params": {}`);
  return `const _state = {\n${entries.join(',\n')}\n};`;
}
```

- [ ] **Step 9: Fix existing router tests**

The existing test `generates router with all page routes` checks for `"/": "home"` (old object format). Update it:

In `tests/generator/js.test.ts`, update the router test:
```typescript
  it('generates router with all page routes', () => {
    const js = generateJS(ast);
    expect(js).toContain('function _navigate(');
    expect(js).toContain("page: 'home'");
    expect(js).toContain("page: 'cart'");
    expect(js).toContain('data-link');
  });
```

Also update the e2e test in `tests/e2e.test.ts` — change route checks from:
```typescript
    expect(result.js).toContain('"/": "home"');
    expect(result.js).toContain('"/cart": "cart"');
    expect(result.js).toContain('"/checkout": "checkout"');
```
to:
```typescript
    expect(result.js).toContain("page: 'home'");
    expect(result.js).toContain("page: 'cart'");
    expect(result.js).toContain("page: 'checkout'");
```

- [ ] **Step 10: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 11: Commit**

```bash
git add src/parser.ts src/generator/js.ts tests/parser.test.ts tests/generator/js.test.ts tests/e2e.test.ts
git commit -m "feat: implement dynamic routing with pattern-based router"
```

---

### Task 5: Conditional Rendering (show_if)

**Files:**
- Modify: `src/parser.ts`
- Modify: `src/generator/js.ts`
- Modify: `src/generator/html.ts`
- Modify: `src/components/registry.ts`
- Modify: `tests/parser.test.ts`
- Modify: `tests/generator/js.test.ts`

- [ ] **Step 1: Write failing parser test for show_if**

Add to `tests/parser.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parser.test.ts`
Expected: FAIL — show_if goes into properties, not showIf field

- [ ] **Step 3: Implement show_if parsing**

In `src/parser.ts`, in the `parseComponent` function, when processing PROPERTY tokens, intercept `show_if`:

Replace the property handling block:
```typescript
    if (cur.type === 'PROPERTY') {
      if (cur.key === 'show_if') {
        const raw = cur.value.trim();
        if (raw.startsWith('!')) {
          node.showIf = { field: raw.slice(1).trim(), negate: true };
        } else {
          node.showIf = { field: raw, negate: false };
        }
      } else {
        node.properties.push({ key: cur.key, value: cur.value });
      }
      i++;
```

- [ ] **Step 4: Run parser tests**

Run: `npx vitest run tests/parser.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Write failing test for show_if HTML generation**

Add component IDs for show_if elements. In `tests/generator/js.test.ts`:
```typescript
  describe('show_if rendering', () => {
    it('generates show_if bindings for components', () => {
      const showIfAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [{ name: 'user', defaultValue: 'null' }] }],
        actions: [],
        apis: [],
        pages: [{
          type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [],
          components: [{
            type: 'COMPONENT', componentType: 'button',
            inlineLabel: 'Logout', inlineAction: 'logout',
            properties: [],
            children: [],
            showIf: { field: 'user', negate: false },
          }, {
            type: 'COMPONENT', componentType: 'button',
            inlineLabel: 'Login', inlineAction: '/login',
            properties: [],
            children: [],
            showIf: { field: 'user', negate: true },
          }],
        }],
      };
      const js = generateJS(showIfAst);
      expect(js).toContain("_bindings['user']");
      expect(js).toContain('display');
    });
  });
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/generator/js.test.ts`
Expected: FAIL — no show_if binding code generated

- [ ] **Step 7: Implement show_if in HTML generator**

In `src/generator/html.ts`, update `generateHTML` to assign IDs to components with showIf. We need to wrap rendered components with a container that has an ID.

Update the import to include ComponentNode:
```typescript
import type { PageNode, ComponentNode } from '../ast';
```

Add a counter and a wrapper function:
```typescript
let _showIfCounter = 0;

function wrapWithShowIf(html: string, comp: ComponentNode): string {
  if (!comp.showIf) return html;
  const id = `neuron-sf-${_showIfCounter++}`;
  return `<div id="${id}" data-show-if="${comp.showIf.negate ? '!' : ''}${comp.showIf.field}">${html}</div>`;
}
```

Update the `generateHTML` function to use it:
```typescript
export function generateHTML(pages: PageNode[], appTitle: string): string {
  _showIfCounter = 0; // Reset counter per build
  const pagesSections = pages.map(page => {
    const componentsHtml = page.components.map(c => {
      const html = renderComponent(c);
      return wrapWithShowIf(html, c);
    }).join('\n    ');
```

- [ ] **Step 8: Implement show_if bindings in JS generator**

In `src/generator/js.ts`, add a new function `generateShowIfBindings` and call it.

Add a helper to collect show_if components:
```typescript
interface ShowIfComponent {
  elementId: string;
  stateField: string;
  negate: boolean;
}

function collectShowIfComponents(ast: NeuronAST): ShowIfComponent[] {
  const results: ShowIfComponent[] = [];
  let counter = 0;

  function walk(components: ComponentNode[]) {
    for (const comp of components) {
      if (comp.showIf) {
        results.push({
          elementId: `neuron-sf-${counter}`,
          stateField: comp.showIf.field,
          negate: comp.showIf.negate,
        });
      }
      counter++; // Always increment to stay in sync with HTML counter
      walk(comp.children);
    }
  }

  for (const page of ast.pages) {
    walk(page.components);
  }
  return results;
}
```

Add the binding generator:
```typescript
function generateShowIfBindings(ast: NeuronAST): string {
  const components = collectShowIfComponents(ast);
  if (components.length === 0) return '';

  const lines: string[] = ['function _initShowIf() {'];
  for (const comp of components) {
    const condition = comp.negate
      ? `!val || (Array.isArray(val) && val.length === 0)`
      : `val && (!Array.isArray(val) || val.length > 0)`;
    lines.push(`  (function() {`);
    lines.push(`    var el = document.getElementById('${comp.elementId}');`);
    lines.push(`    if (!el) return;`);
    lines.push(`    _bindings['${comp.stateField}'].push(function(val) {`);
    lines.push(`      el.style.display = ${condition} ? '' : 'none';`);
    lines.push(`    });`);
    lines.push(`    var initVal = _state['${comp.stateField}'];`);
    lines.push(`    el.style.display = ${condition.replace(/val/g, 'initVal')} ? '' : 'none';`);
    lines.push(`  })();`);
  }
  lines.push('}');
  return lines.join('\n');
}
```

In the main `generateJS` function, add the show_if section between form handling and auto-load:
```typescript
  // 6.5 Show-if bindings
  const showIfCode = generateShowIfBindings(ast);
  if (showIfCode) lines.push(showIfCode);
```

Update `generateInit` to call `_initShowIf`:
```typescript
function generateInit(ast: NeuronAST): string {
  const hasShowIf = collectShowIfComponents(ast).length > 0;
  const showIfCall = hasShowIf ? '\n  _initShowIf();' : '';
  return `document.addEventListener('DOMContentLoaded', function() {
  _initBindings();${showIfCall}
  _initRouter();
  _autoLoad();
});`;
}
```

Note: `generateInit` now needs `ast` parameter. Update the call in `generateJS`:
```typescript
  // 10. DOMContentLoaded init
  lines.push(generateInit(ast));
```

- [ ] **Step 9: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 10: Commit**

```bash
git add src/parser.ts src/generator/js.ts src/generator/html.ts tests/parser.test.ts tests/generator/js.test.ts
git commit -m "feat: implement conditional rendering with show_if"
```

---

### Task 6: Form Validation

**Files:**
- Modify: `src/lexer.ts`
- Modify: `src/parser.ts`
- Modify: `src/components/registry.ts`
- Modify: `src/generator/js.ts`
- Modify: `src/generator/css.ts`
- Modify: `tests/lexer.test.ts`
- Modify: `tests/parser.test.ts`
- Modify: `tests/components/registry.test.ts`
- Modify: `tests/generator/css.test.ts`

- [ ] **Step 1: Write failing lexer test for form field sub-properties**

Add to `tests/lexer.test.ts`:
```typescript
  it('tokenizes form field sub-properties at 6-space indent', () => {
    const tokens = tokenize(`PAGE home "Home" /

  form
    field_email: "Email"
      type: email
      required: true
    submit: "Go" -> register`);
    // Find the type and required tokens — they should be PROPERTY tokens at indent 6
    const typeProp = tokens.find(t => t.type === 'PROPERTY' && t.key === 'type' && t.value === 'email');
    const requiredProp = tokens.find(t => t.type === 'PROPERTY' && t.key === 'required' && t.value === 'true');
    expect(typeProp).toBeDefined();
    expect(typeProp!.indent).toBe(6);
    expect(requiredProp).toBeDefined();
    expect(requiredProp!.indent).toBe(6);
  });
```

- [ ] **Step 2: Run test to verify it passes (or fails)**

Run: `npx vitest run tests/lexer.test.ts`

The lexer already tokenizes any `key: value` line as PROPERTY regardless of indent. This test should PASS without changes because the existing PROPERTY regex handles all indentation levels. Verify this.

- [ ] **Step 3: Write failing parser test for form field validation**

Add to `tests/parser.test.ts`:
```typescript
  describe('form field validation parsing', () => {
    it('parses form field with validation sub-properties', () => {
      const ast = parse(`PAGE home "Home" /

  form
    field_email: "Email"
      type: email
      required: true
    field_age: "Age"
      type: number
      min: 1
      max: 200
    submit: "Save" -> save
`);
      const form = ast.pages[0].components[0];
      // field_email should have validation properties attached
      const emailProp = form.properties.find(p => p.key === 'field_email');
      expect(emailProp).toBeDefined();
      expect(emailProp!.validation).toEqual({ type: 'email', required: true });

      const ageProp = form.properties.find(p => p.key === 'field_age');
      expect(ageProp).toBeDefined();
      expect(ageProp!.validation).toEqual({ type: 'number', min: 1, max: 200 });
    });

    it('form fields without validation have undefined validation', () => {
      const ast = parse(`PAGE home "Home" /

  form
    field_name: "Name"
    submit: "Go" -> save
`);
      const form = ast.pages[0].components[0];
      const nameProp = form.properties.find(p => p.key === 'field_name');
      expect(nameProp).toBeDefined();
      expect(nameProp!.validation).toBeUndefined();
    });
  });
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run tests/parser.test.ts`
Expected: FAIL — `validation` property doesn't exist on `ComponentProperty`

- [ ] **Step 5: Extend ComponentProperty in AST and implement parser logic**

In `src/ast.ts`, update `ComponentProperty`:
```typescript
export interface ComponentProperty {
  key: string;
  value: string;
  validation?: FormFieldValidation;
}
```

In `src/parser.ts`, update `parseComponent` to handle form field sub-properties.

The key insight: when we encounter a `field_*` property inside a form component, the next properties at a deeper indent level are validation sub-properties for that field.

Replace the entire `parseComponent` function:
```typescript
function parseComponent(tokens: Token[], start: number): [ComponentNode, number] {
  const t = tokens[start] as Extract<Token, { type: 'COMPONENT' }>;
  const baseIndent = t.indent;
  const node: ComponentNode = {
    type: 'COMPONENT',
    componentType: t.componentType,
    inlineLabel: t.inlineLabel,
    inlineAction: t.inlineAction,
    properties: [],
    children: [],
  };
  let i = start + 1;

  while (i < tokens.length) {
    const cur = tokens[i];
    if (cur.indent <= baseIndent || cur.type === 'KEYWORD' || cur.type === 'SEPARATOR') break;

    if (cur.type === 'PROPERTY') {
      if (cur.key === 'show_if') {
        const raw = cur.value.trim();
        if (raw.startsWith('!')) {
          node.showIf = { field: raw.slice(1).trim(), negate: true };
        } else {
          node.showIf = { field: raw, negate: false };
        }
        i++;
      } else if (cur.key.startsWith('field_') && node.componentType === 'form') {
        // Form field — check for sub-properties at deeper indent
        const prop: ComponentProperty = { key: cur.key, value: cur.value };
        const fieldIndent = cur.indent;
        i++;
        // Collect sub-properties (type, required, min, max) at deeper indent
        const validation: Record<string, string | boolean | number> = {};
        let hasValidation = false;
        while (i < tokens.length) {
          const sub = tokens[i];
          if (sub.type !== 'PROPERTY' || sub.indent <= fieldIndent) break;
          hasValidation = true;
          if (sub.key === 'required') {
            validation.required = sub.value === 'true';
          } else if (sub.key === 'min') {
            validation.min = Number(sub.value);
          } else if (sub.key === 'max') {
            validation.max = Number(sub.value);
          } else if (sub.key === 'type') {
            validation.type = sub.value;
          }
          i++;
        }
        if (hasValidation) {
          prop.validation = validation as any;
        }
        node.properties.push(prop);
      } else {
        node.properties.push({ key: cur.key, value: cur.value });
        i++;
      }
    } else if (cur.type === 'LIST_ITEM') {
      node.properties.push({ key: 'fields_items', value: cur.value });
      i++;
    } else if (cur.type === 'COMPONENT') {
      const [child, next] = parseComponent(tokens, i);
      node.children.push(child);
      i = next;
    } else {
      i++;
    }
  }

  return [node, i];
}
```

- [ ] **Step 6: Run parser tests**

Run: `npx vitest run tests/parser.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Write failing test for form HTML rendering with validation attributes**

Add to `tests/components/registry.test.ts`:
```typescript
  it('renders form fields with validation attributes', () => {
    const node: ComponentNode = {
      type: 'COMPONENT',
      componentType: 'form',
      properties: [
        { key: 'field_email', value: '"Email"', validation: { type: 'email', required: true } },
        { key: 'field_age', value: '"Age"', validation: { type: 'number', min: 1, max: 200 } },
        { key: 'submit', value: '"Save" -> save' },
      ],
      children: [],
    };
    const html = renderComponent(node);
    expect(html).toContain('type="email"');
    expect(html).toContain('required');
    expect(html).toContain('type="number"');
    expect(html).toContain('min="1"');
    expect(html).toContain('max="200"');
  });

  it('renders form fields without validation as plain inputs', () => {
    const node: ComponentNode = {
      type: 'COMPONENT',
      componentType: 'form',
      properties: [
        { key: 'field_name', value: '"Name"' },
        { key: 'submit', value: '"Go" -> go' },
      ],
      children: [],
    };
    const html = renderComponent(node);
    expect(html).toContain('placeholder="Name"');
    expect(html).not.toContain('required');
  });
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npx vitest run tests/components/registry.test.ts`
Expected: FAIL — validation attributes not rendered

- [ ] **Step 9: Update form renderer in registry**

In `src/components/registry.ts`, update the `form` renderer:
```typescript
  form(node) {
    const submitRaw = getProp(node, 'submit');
    let submitHtml = '';
    if (submitRaw) {
      const submit = parseCta(submitRaw);
      submitHtml = `<button type="submit" class="neuron-btn" data-action="${submit.action}">${submit.label}</button>`;
    }
    // Collect field properties (field_*)
    const fields = node.properties
      .filter((p) => p.key.startsWith('field'))
      .map((p) => {
        const val = unquote(p.value);
        let attrs = `class="neuron-input" name="${p.key}" placeholder="${val}"`;
        if (p.validation) {
          if (p.validation.type) attrs += ` type="${p.validation.type}"`;
          if (p.validation.required) attrs += ` required`;
          if (p.validation.min !== undefined) {
            attrs += p.validation.type === 'number' ? ` min="${p.validation.min}"` : ` minlength="${p.validation.min}"`;
          }
          if (p.validation.max !== undefined) {
            attrs += p.validation.type === 'number' ? ` max="${p.validation.max}"` : ` maxlength="${p.validation.max}"`;
          }
        }
        return `<input ${attrs}>`;
      })
      .join('');
    return `<form class="neuron-form">${fields}${submitHtml}</form>`;
  },
```

- [ ] **Step 10: Run component tests**

Run: `npx vitest run tests/components/registry.test.ts`
Expected: ALL PASS

- [ ] **Step 11: Update form submit handler in JS generator**

In `src/generator/js.ts`, update `generateFormHandling` to add `checkValidity`:
```typescript
function generateFormHandling(): string {
  return `document.addEventListener('submit', function(e) {
  var form = e.target.closest('form[data-action]');
  if (!form) {
    form = e.target.closest('form');
  }
  if (form) {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    var actionName = form.querySelector('[data-action]');
    var name = actionName ? actionName.getAttribute('data-action') : null;
    var formData = Object.fromEntries(new FormData(form));
    if (name && _actions[name]) _actions[name](formData);
  }
});`;
}
```

- [ ] **Step 12: Write failing CSS test for form validation styles**

Add to `tests/generator/css.test.ts`:
```typescript
  it('includes form validation styles', () => {
    const css = generateCSS(defaultTheme);
    expect(css).toContain('input:invalid');
    expect(css).toContain('border-color');
  });
```

Where `defaultTheme` is the theme object already used in the test file. Check the test to find the variable name.

- [ ] **Step 13: Run test to verify it fails**

Run: `npx vitest run tests/generator/css.test.ts`
Expected: FAIL — no validation styles

- [ ] **Step 14: Add form validation CSS**

In `src/generator/css.ts`, add to the end of `BASE_STYLES`:
```css
input:invalid:not(:placeholder-shown) {
  border-color: var(--color-danger);
}

input:valid:not(:placeholder-shown) {
  border-color: var(--color-primary);
}
```

- [ ] **Step 15: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 16: Commit**

```bash
git add src/ast.ts src/lexer.ts src/parser.ts src/components/registry.ts src/generator/js.ts src/generator/css.ts tests/lexer.test.ts tests/parser.test.ts tests/components/registry.test.ts tests/generator/css.test.ts
git commit -m "feat: implement form validation with HTML5 native attributes"
```

---

### Task 7: External JS Logic (`use:`)

**Files:**
- Modify: `src/compiler.ts`
- Modify: `src/generator/js.ts`
- Modify: `tests/compiler.test.ts`
- Modify: `tests/generator/js.test.ts`

- [ ] **Step 1: Write failing test for `use:` action generation**

Add to `tests/generator/js.test.ts`:
```typescript
  describe('use: external JS delegation', () => {
    it('generates action that calls external logic function', () => {
      const useAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [{ name: 'todos', defaultValue: '[]' }] }],
        actions: [{ type: 'ACTION', name: 'add-todo', steps: [{ key: 'use', value: 'logic/todos.addTodo' }] }],
        apis: [],
        pages: [{ type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] }],
      };
      const logicFiles: Record<string, string> = {
        'logic/todos.js': `export function addTodo(state, text) {
  return { todos: [...state.todos, { id: Date.now(), text, done: false }] };
}`,
      };
      const js = generateJS(useAst, logicFiles);
      expect(js).toContain('_logic_todos');
      expect(js).toContain('addTodo');
      expect(js).toContain("'add-todo'");
      expect(js).toContain('_setState');
    });

    it('generates JS without logic section when no use: actions', () => {
      const basicAst: NeuronAST = {
        states: [{ type: 'STATE', fields: [{ name: 'count', defaultValue: '0' }] }],
        actions: [{ type: 'ACTION', name: 'inc', steps: [{ key: 'increment', value: 'count' }] }],
        apis: [],
        pages: [{ type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [], components: [] }],
      };
      const js = generateJS(basicAst);
      expect(js).not.toContain('_logic_');
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/generator/js.test.ts`
Expected: FAIL — `generateJS` doesn't accept `logicFiles` parameter

- [ ] **Step 3: Update generateJS signature and add logic bundling**

In `src/generator/js.ts`, update the function signature:
```typescript
export function generateJS(ast: NeuronAST, logicFiles?: Record<string, string>): string {
```

Add a new function for bundling logic files:
```typescript
function bundleLogicFiles(logicFiles: Record<string, string>): string {
  if (!logicFiles || Object.keys(logicFiles).length === 0) return '';

  const parts: string[] = ['// -- External Logic --'];
  for (const [filePath, content] of Object.entries(logicFiles)) {
    // Convert "logic/todos.js" to "_logic_todos"
    const varName = '_logic_' + filePath
      .replace(/^logic\//, '')
      .replace(/\.js$/, '')
      .replace(/[^a-zA-Z0-9]/g, '_');

    // Extract exported functions
    const exportRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
    const functions: string[] = [];
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      functions.push(match[1]);
    }

    parts.push(`var ${varName} = {};`);
    for (const fnName of functions) {
      // Extract the function body
      const fnRegex = new RegExp(`export\\s+(async\\s+)?function\\s+${fnName}\\s*\\([^)]*\\)\\s*\\{`, 'g');
      const fnMatch = fnRegex.exec(content);
      if (fnMatch) {
        const startIdx = fnMatch.index;
        // Find the matching closing brace
        let braceCount = 0;
        let endIdx = startIdx;
        for (let j = content.indexOf('{', startIdx); j < content.length; j++) {
          if (content[j] === '{') braceCount++;
          if (content[j] === '}') braceCount--;
          if (braceCount === 0) { endIdx = j; break; }
        }
        const fnBody = content.slice(startIdx, endIdx + 1)
          .replace(/^export\s+/, '');
        parts.push(`${varName}.${fnName} = ${fnBody.replace(/^(async\s+)?function\s+\w+/, '$1function')};`);
      }
    }
  }
  return parts.join('\n');
}
```

Update `generateActionBody` to handle `use:`:

Add this before the final `return 'function() {}'`:
```typescript
  // use pattern: "logic/file.functionName"
  if (stepMap.has('use')) {
    const val = stepMap.get('use')!.trim();
    const lastDot = val.lastIndexOf('.');
    const filePath = val.slice(0, lastDot);
    const fnName = val.slice(lastDot + 1);
    const varName = '_logic_' + filePath
      .replace(/^logic\//, '')
      .replace(/\.js$/, '')
      .replace(/[^a-zA-Z0-9]/g, '_');
    return `async function(payload) {
    var result = await ${varName}.${fnName}(Object.assign({}, _state), payload);
    if (result && typeof result === 'object') {
      Object.keys(result).forEach(function(k) { _setState(k, result[k]); });
    }
  }`;
  }
```

In the `generateJS` function, add logic bundling at the top:
```typescript
  // 0. Bundle external logic files
  const logicBundle = bundleLogicFiles(logicFiles || {});
  if (logicBundle) lines.push(logicBundle);
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/generator/js.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Write failing compiler test for logic/ scanning**

Add to `tests/compiler.test.ts`:
```typescript
  it('scans logic/ directory and passes files to generator', () => {
    // Create a project with logic/ dir
    const tmpDir = join(__dirname, '.tmp-compiler-logic');
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, 'pages'), { recursive: true });
    mkdirSync(join(tmpDir, 'logic'), { recursive: true });

    writeFileSync(join(tmpDir, 'app.neuron'), `STATE
  todos: []

---

ACTION add-todo
  use: logic/todos.addTodo`);

    writeFileSync(join(tmpDir, 'pages', 'home.neuron'), `PAGE home "Home" /

  text
    content: "Hello"`);

    writeFileSync(join(tmpDir, 'logic', 'todos.js'), `export function addTodo(state, text) {
  return { todos: [...state.todos, { id: Date.now(), text, done: false }] };
}`);

    const result = compile({
      appFile: join(tmpDir, 'app.neuron'),
      pageFiles: [join(tmpDir, 'pages', 'home.neuron')],
      apiFiles: [],
      themeFile: null,
      appTitle: 'Test',
    });

    expect(result.errors).toEqual([]);
    expect(result.js).toContain('_logic_todos');
    expect(result.js).toContain('addTodo');

    rmSync(tmpDir, { recursive: true, force: true });
  });
```

Add necessary imports at top of `tests/compiler.test.ts` if not present:
```typescript
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/compiler.test.ts`
Expected: FAIL — compiler doesn't scan logic/ directory

- [ ] **Step 7: Update compiler to scan logic/ and pass to generator**

In `src/compiler.ts`, add logic directory scanning. Update the compile function:

Add imports at top:
```typescript
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
```

In the `compile` function, before `// Generate outputs`:
```typescript
  // Scan logic/ directory
  const logicFiles: Record<string, string> = {};
  const projectDir = dirname(input.appFile);
  const logicDir = join(projectDir, 'logic');
  if (existsSync(logicDir)) {
    const files = readdirSync(logicDir).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const filePath = join(logicDir, file);
      logicFiles[`logic/${file}`] = readFileSync(filePath, 'utf-8');
    }
  }
```

Update the JS generation call:
```typescript
  const js = generateJS(ast, logicFiles);
```

- [ ] **Step 8: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add src/compiler.ts src/generator/js.ts tests/compiler.test.ts tests/generator/js.test.ts
git commit -m "feat: implement use: external JS logic delegation"
```

---

### Task 8: Update Scaffold and Templates

**Files:**
- Modify: `src/scaffold.ts`
- Create: `templates/logic/example.js`
- Modify: `tests/cli.test.ts`

- [ ] **Step 1: Read current scaffold code**

Read `src/scaffold.ts` to understand the current scaffolding logic.

- [ ] **Step 2: Write failing test for logic/ directory in scaffold**

Add to `tests/cli.test.ts` (or create a new test if the scaffold test is separate):
```typescript
  it('neuron new creates logic/ directory', () => {
    const tmpDir = join(__dirname, '.tmp-scaffold');
    mkdirSync(tmpDir, { recursive: true });
    scaffold('test-project', tmpDir);
    const logicDir = join(tmpDir, 'test-project', 'logic');
    expect(existsSync(logicDir)).toBe(true);
    rmSync(join(tmpDir, 'test-project'), { recursive: true, force: true });
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/cli.test.ts`
Expected: FAIL — logic/ directory not created

- [ ] **Step 4: Create template logic file**

```javascript
// templates/logic/example.js
// Example: external logic function for Neuron actions.
// Use with: ACTION my-action
//             use: logic/example.myFunction
//
// Function signature: (state, payload) => partial state object
// Return only the state fields you want to update.

export function myFunction(state, payload) {
  return {};
}
```

- [ ] **Step 5: Update scaffold to create logic/ directory**

In `src/scaffold.ts`, add logic to copy the logic/ directory. Read the file first to understand the exact pattern, then add:

```typescript
// Create logic/ directory
const logicDir = join(projectDir, 'logic');
mkdirSync(logicDir, { recursive: true });
```

Copy the example.js template if it exists, following the same pattern as other template files.

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/cli.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add src/scaffold.ts templates/logic/example.js tests/cli.test.ts
git commit -m "feat: add logic/ directory to project scaffold"
```

---

### Task 9: End-to-End Integration Test

**Files:**
- Modify: `tests/e2e.test.ts`

- [ ] **Step 1: Write a new e2e test for a todo app using all new features**

Add to `tests/e2e.test.ts`:
```typescript
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
    expect(result.html).toContain('data-show-if="!todos"');
    expect(result.html).toContain('data-show-if="darkMode"');
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
```

- [ ] **Step 2: Run the e2e test**

Run: `npx vitest run tests/e2e.test.ts`
Expected: ALL PASS (if all previous tasks are complete)

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add tests/e2e.test.ts
git commit -m "test: add todo app e2e test covering all Phase 1 features"
```

---

### Task 10: Update REFERENCE.md and README.md

**Files:**
- Modify: `REFERENCE.md`
- Modify: `README.md`

- [ ] **Step 1: Update REFERENCE.md with new action patterns**

Add to the ACTION patterns section in `REFERENCE.md`:

```markdown
**set** - Set state to a specific value:
```
ACTION clear-search
  set: query -> ""
```
Generated: `function() { _setState('query', ''); }`

**toggle** - Toggle boolean state:
```
ACTION toggle-dark
  toggle: darkMode
```
Generated: `function() { _setState('darkMode', !_state.darkMode); }`

**increment** - Increment number state:
```
ACTION increase
  increment: count
```
Generated: `function() { _setState('count', _state.count + 1); }`

**decrement** - Decrement number state:
```
ACTION decrease
  decrement: count
```
Generated: `function() { _setState('count', _state.count - 1); }`

**navigate** - Programmatic navigation:
```
ACTION go-home
  navigate: /
```
Generated: `function() { _navigate('/'); }`

**use** - Delegate to external JS function:
```
ACTION add-todo
  use: logic/todos.addTodo
```
JS function convention: `(state, payload) => partialState`
```

- [ ] **Step 2: Update REFERENCE.md with dynamic routing**

Add to the PAGE section:
```markdown
### Dynamic Routes

```
PAGE detail "Detail" /item/:id
PAGE edit "Edit" /category/:catId/item/:itemId
```

Route parameters are available as `_state._params` (e.g., `_state._params.id`).
```

- [ ] **Step 3: Update REFERENCE.md with show_if**

Add a new section:
```markdown
## Conditional Rendering

```
button "Logout" -> logout
  show_if: user

button "Login" -> /login
  show_if: !user
```

| Syntax | Meaning |
|--------|---------|
| `show_if: field` | Show when `_state.field` is truthy |
| `show_if: !field` | Show when `_state.field` is falsy |
```

- [ ] **Step 4: Update REFERENCE.md with form validation**

Update the form component section:
```markdown
**form** with validation
```
form
  field_email: "Email"
    type: email
    required: true
  field_age: "Age"
    type: number
    min: 1
    max: 200
  submit: "Save" -> save
```

Validation attributes: `type` (text/email/password/number/tel/url), `required` (true), `min`, `max`
```

- [ ] **Step 5: Update REFERENCE.md with logic/ directory**

Update the Project Structure section:
```markdown
project/
├── neuron.json
├── app.neuron
├── pages/
│   └── *.neuron
├── apis/
│   └── *.neuron
├── logic/              # External JS logic (optional)
│   └── *.js
├── themes/
│   └── theme.json
└── assets/
```

- [ ] **Step 6: Update README.md with key new features**

Add a brief section in README.md about the new features (dynamic routing, show_if, form validation, use: actions, new action patterns). Keep it concise — point to REFERENCE.md for full details.

- [ ] **Step 7: Commit**

```bash
git add REFERENCE.md README.md
git commit -m "docs: update REFERENCE.md and README.md with Phase 1 features"
```

---

### Task 11: Build Verification

**Files:** None new

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Build the project**

Run: `npm run build`
Expected: Build succeeds, dist/index.js generated

- [ ] **Step 3: Verify the built CLI works**

Create a temporary project and build it:
```bash
cd /tmp && mkdir neuron-test && cd neuron-test
node /Users/guest-user/workspace/neuron/dist/index.js new my-todo
cd my-todo
# Verify logic/ directory exists
ls logic/
# Build the project
node /Users/guest-user/workspace/neuron/dist/index.js build
# Verify output
ls dist/
```

- [ ] **Step 4: Clean up and final commit**

```bash
rm -rf /tmp/neuron-test
```

Run: `npx vitest run`
Expected: ALL PASS — final verification

- [ ] **Step 5: Commit if any fixes were needed**

Only commit if fixes were needed during verification. Otherwise skip.
