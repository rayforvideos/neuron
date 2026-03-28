# Phase 3: Developer Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `neuron dev` command with live reload dev server, and build-time AST validation that catches undefined state/action/API references, duplicate routes, and invalid persist fields.

**Architecture:** Two new modules: `validator.ts` (pure function that checks AST and returns errors) and `dev-server.ts` (HTTP + WebSocket server with file watching). The validator integrates into the existing compile pipeline. The dev server reuses the compile function and adds file watching + browser notification. WebSocket is implemented with raw Node.js (no external dependencies).

**Tech Stack:** TypeScript, Vitest, Node.js http/fs/crypto modules (zero external dependencies)

---

## File Structure

| File | Responsibility | Change Type |
|------|---------------|-------------|
| `src/validator.ts` | AST validation (undefined refs, duplicates, persist) | Create |
| `src/dev-server.ts` | HTTP server + WebSocket + file watch + rebuild | Create |
| `src/compiler.ts` | Integrate validator, add devMode option | Modify |
| `src/generator/html.ts` | Dev mode WebSocket client injection | Modify |
| `src/cli.ts` | Add `dev` command | Modify |
| `src/errors.ts` | Add validation error codes | Modify |
| `tests/validator.test.ts` | Validator tests | Create |
| `tests/generator/html.test.ts` | Dev mode injection tests | Modify |
| `tests/compiler.test.ts` | Validator integration test | Modify |
| `tests/e2e.test.ts` | E2E test with validation | Modify |

---

### Task 1: New Error Codes for Validation

**Files:**
- Modify: `src/errors.ts`
- Modify: `tests/errors.test.ts`

- [ ] **Step 1: Write failing tests for new error codes**

Add to `tests/errors.test.ts`:
```typescript
  it('formats duplicate_route error', () => {
    const err = new NeuronError('duplicate_route', '/home', {});
    expect(formatError(err)).toContain('/home');
    expect(formatError(err)).toContain('중복');
  });

  it('formats duplicate_page error', () => {
    const err = new NeuronError('duplicate_page', 'home', {});
    expect(formatError(err)).toContain('home');
    expect(formatError(err)).toContain('중복');
  });

  it('formats undefined_persist_field error', () => {
    const err = new NeuronError('undefined_persist_field', 'wishlist', {});
    expect(formatError(err)).toContain('wishlist');
    expect(formatError(err)).toContain('STATE');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/errors.test.ts`
Expected: FAIL

- [ ] **Step 3: Add new error codes**

In `src/errors.ts`, update `ErrorCode` type:
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
  | 'invalid_route_param'
  | 'duplicate_route'
  | 'duplicate_page'
  | 'undefined_persist_field';
```

Add messages:
```typescript
  duplicate_route: (target) =>
    `[NEURON ERROR] 중복 라우트: "${target}"\n→ 각 PAGE는 고유한 라우트를 가져야 합니다`,
  duplicate_page: (target) =>
    `[NEURON ERROR] 중복 페이지 이름: "${target}"\n→ 각 PAGE는 고유한 이름을 가져야 합니다`,
  undefined_persist_field: (target) =>
    `[NEURON ERROR] persist 필드 "${target}"가 STATE에 정의되지 않음\n→ STATE 섹션에 "${target}" 를 추가하세요`,
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/errors.ts tests/errors.test.ts
git commit -m "feat: add validation error codes (duplicate_route, duplicate_page, undefined_persist_field)"
```

---

### Task 2: AST Validator

**Files:**
- Create: `src/validator.ts`
- Create: `tests/validator.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/validator.test.ts`:
```typescript
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
    const errors = validate(ast);
    expect(errors).toEqual([]);
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
    const errors = validate(ast);
    expect(errors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/validator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement validator**

Create `src/validator.ts`:
```typescript
import type { NeuronAST, ComponentNode } from './ast';
import { NeuronError, formatError } from './errors';

const INTERNAL_STATES = new Set(['_params', '_loading', '_error']);

export function validate(ast: NeuronAST): string[] {
  const errors: string[] = [];

  const stateNames = new Set(ast.states.flatMap(s => s.fields.map(f => f.name)));
  const actionNames = new Set(ast.actions.map(a => a.name));
  const apiNames = new Set(ast.apis.map(a => a.name));

  // Duplicate routes
  const routes = new Set<string>();
  for (const page of ast.pages) {
    if (routes.has(page.route)) {
      errors.push(formatError(new NeuronError('duplicate_route', page.route, {})));
    }
    routes.add(page.route);
  }

  // Duplicate page names
  const pageNames = new Set<string>();
  for (const page of ast.pages) {
    if (pageNames.has(page.name)) {
      errors.push(formatError(new NeuronError('duplicate_page', page.name, {})));
    }
    pageNames.add(page.name);
  }

  // Persist field validation
  for (const state of ast.states) {
    const fieldNames = new Set(state.fields.map(f => f.name));
    for (const persistField of state.persist) {
      if (!fieldNames.has(persistField)) {
        errors.push(formatError(new NeuronError('undefined_persist_field', persistField, {})));
      }
    }
  }

  // Action call: API references
  for (const action of ast.actions) {
    for (const step of action.steps) {
      if (step.key === 'call' && !apiNames.has(step.value)) {
        errors.push(formatError(new NeuronError('undefined_api', step.value, {})));
      }
    }
  }

  // Component references
  function walkComponents(components: ComponentNode[]) {
    for (const comp of components) {
      // State references via data: and state:
      for (const prop of comp.properties) {
        if ((prop.key === 'data' || prop.key === 'state') && !stateNames.has(prop.value) && !INTERNAL_STATES.has(prop.value)) {
          errors.push(formatError(new NeuronError('undefined_state', prop.value, {})));
        }
        // Action references via on_click, on_remove
        if ((prop.key === 'on_click' || prop.key === 'on_remove') && !actionNames.has(prop.value)) {
          errors.push(formatError(new NeuronError('undefined_action', prop.value, {})));
        }
      }

      // show_if state reference
      if (comp.showIf && !stateNames.has(comp.showIf.field) && !INTERNAL_STATES.has(comp.showIf.field)) {
        errors.push(formatError(new NeuronError('undefined_state', comp.showIf.field, {})));
      }

      // Inline action reference (not routes)
      if (comp.inlineAction && !comp.inlineAction.startsWith('/') && !actionNames.has(comp.inlineAction)) {
        errors.push(formatError(new NeuronError('undefined_action', comp.inlineAction, {})));
      }

      walkComponents(comp.children);
    }
  }

  for (const page of ast.pages) {
    walkComponents(page.components);
  }

  return errors;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/validator.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/validator.ts tests/validator.test.ts
git commit -m "feat: implement AST validator for state/action/API/route/persist checks"
```

---

### Task 3: Integrate Validator into Compiler

**Files:**
- Modify: `src/compiler.ts`
- Modify: `tests/compiler.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/compiler.test.ts`:
```typescript
  it('reports validation errors for undefined state references', () => {
    const tmpDir = join(__dirname, '.tmp-compiler-validate');
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, 'pages'), { recursive: true });

    writeFileSync(join(tmpDir, 'app.neuron'), `STATE
  items: []`);

    writeFileSync(join(tmpDir, 'pages', 'home.neuron'), `PAGE home "Home" /

  product-grid
    data: products
    on_click: nonexistent`);

    const result = compile({
      appFile: join(tmpDir, 'app.neuron'),
      pageFiles: [join(tmpDir, 'pages', 'home.neuron')],
      apiFiles: [],
      themeFile: null,
      appTitle: 'Test',
    });

    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.errors.some(e => e.includes('products'))).toBe(true);
    expect(result.errors.some(e => e.includes('nonexistent'))).toBe(true);

    rmSync(tmpDir, { recursive: true, force: true });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/compiler.test.ts`
Expected: FAIL — no validation errors reported

- [ ] **Step 3: Integrate validator**

In `src/compiler.ts`, add import:
```typescript
import { validate } from './validator';
```

After the logic file validation block (after line ~88) and before `// Generate outputs`, add:
```typescript
  // Validate AST
  const validationErrors = validate(ast);
  errors.push(...validationErrors);
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/compiler.ts tests/compiler.test.ts
git commit -m "feat: integrate AST validator into compile pipeline"
```

---

### Task 4: Dev Mode HTML Injection

**Files:**
- Modify: `src/generator/html.ts`
- Modify: `src/compiler.ts`
- Modify: `tests/generator/html.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/generator/html.test.ts`:
```typescript
  it('injects WebSocket client script in dev mode', () => {
    const pages: PageNode[] = [{
      type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [],
      components: [],
    }];
    const html = generateHTML(pages, 'Test', true);
    expect(html).toContain('WebSocket');
    expect(html).toContain('reload');
  });

  it('does not inject WebSocket script in production mode', () => {
    const pages: PageNode[] = [{
      type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [],
      components: [],
    }];
    const html = generateHTML(pages, 'Test', false);
    expect(html).not.toContain('WebSocket');
  });

  it('does not inject WebSocket script by default', () => {
    const pages: PageNode[] = [{
      type: 'PAGE', name: 'home', title: 'Home', route: '/', params: [],
      components: [],
    }];
    const html = generateHTML(pages, 'Test');
    expect(html).not.toContain('WebSocket');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/generator/html.test.ts`
Expected: FAIL

- [ ] **Step 3: Add devMode parameter to generateHTML**

In `src/generator/html.ts`, update the function signature and add WS client injection:

```typescript
export function generateHTML(pages: PageNode[], appTitle: string, devMode?: boolean): string {
  _showIfCounter = 0;
  const pagesSections = pages.map(page => {
    const componentsHtml = page.components.map(c => {
      const html = renderComponent(c);
      return wrapWithShowIf(html, c);
    }).join('\n    ');
    return `  <div class="neuron-page" data-page="${page.name}" data-route="${page.route}" style="display:none">
    ${componentsHtml}
  </div>`;
  }).join('\n');

  const devScript = devMode ? `
  <script>
  (function() {
    var ws = new WebSocket('ws://' + location.host);
    ws.onmessage = function(e) {
      if (e.data === 'reload') location.reload();
    };
    ws.onclose = function() {
      setTimeout(function() { location.reload(); }, 1000);
    };
  })();
  </script>` : '';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appTitle}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
${pagesSections}
  </div>
  <script src="main.js"></script>${devScript}
</body>
</html>`;
}
```

- [ ] **Step 4: Update CompileInput and compile function**

In `src/compiler.ts`, add `devMode` to `CompileInput`:
```typescript
export interface CompileInput {
  appFile: string;
  pageFiles: string[];
  apiFiles: string[];
  themeFile: string | null;
  appTitle: string;
  devMode?: boolean;
}
```

Update the HTML generation call:
```typescript
  const html = generateHTML(ast.pages, input.appTitle, input.devMode);
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/generator/html.ts src/compiler.ts tests/generator/html.test.ts
git commit -m "feat: inject WebSocket live-reload client in dev mode"
```

---

### Task 5: Dev Server Implementation

**Files:**
- Create: `src/dev-server.ts`

- [ ] **Step 1: Implement the dev server**

Create `src/dev-server.ts`:
```typescript
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { createHash } from 'crypto';
import { readFileSync, existsSync, statSync, watch, mkdirSync, writeFileSync, readdirSync, copyFileSync } from 'fs';
import { join, extname, resolve, basename } from 'path';
import { compile } from './compiler';
import type { Socket } from 'net';

export interface DevServerOptions {
  port: number;
  projectDir: string;
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Minimal WebSocket frame encoder (text only, <126 bytes)
function encodeWSFrame(message: string): Buffer {
  const payload = Buffer.from(message, 'utf-8');
  const frame = Buffer.alloc(2 + payload.length);
  frame[0] = 0x81; // FIN + text opcode
  frame[1] = payload.length;
  payload.copy(frame, 2);
  return frame;
}

export function startDevServer(options: DevServerOptions): void {
  const { port, projectDir } = options;
  const distDir = join(projectDir, 'dist');
  const clients = new Set<Socket>();

  // --- Build ---
  function rebuild(): boolean {
    const appFile = join(projectDir, 'app.neuron');
    if (!existsSync(appFile)) {
      console.error('[NEURON DEV] app.neuron not found');
      return false;
    }

    const pagesDir = join(projectDir, 'pages');
    const pageFiles = existsSync(pagesDir)
      ? readdirSync(pagesDir).filter(f => f.endsWith('.neuron')).map(f => join(pagesDir, f))
      : [];

    const apisDir = join(projectDir, 'apis');
    const apiFiles = existsSync(apisDir)
      ? readdirSync(apisDir).filter(f => f.endsWith('.neuron')).map(f => join(apisDir, f))
      : [];

    const themeFile = join(projectDir, 'themes', 'theme.json');
    const themeArg = existsSync(themeFile) ? themeFile : null;

    let appTitle = basename(projectDir);
    const neuronJson = join(projectDir, 'neuron.json');
    if (existsSync(neuronJson)) {
      try {
        const config = JSON.parse(readFileSync(neuronJson, 'utf-8'));
        appTitle = config.name || appTitle;
      } catch {}
    }

    const result = compile({
      appFile,
      pageFiles,
      apiFiles,
      themeFile: themeArg,
      appTitle,
      devMode: true,
    });

    if (result.errors.length > 0) {
      result.errors.forEach(e => console.error(e));
    }

    mkdirSync(distDir, { recursive: true });
    mkdirSync(join(distDir, 'assets'), { recursive: true });
    writeFileSync(join(distDir, 'index.html'), result.html);
    writeFileSync(join(distDir, 'style.css'), result.css);
    writeFileSync(join(distDir, 'main.js'), result.js);

    // Copy assets
    const assetsDir = join(projectDir, 'assets');
    if (existsSync(assetsDir)) {
      for (const file of readdirSync(assetsDir)) {
        copyFileSync(join(assetsDir, file), join(distDir, 'assets', file));
      }
    }

    return result.errors.length === 0;
  }

  // --- Initial build ---
  console.log('[NEURON DEV] Building...');
  rebuild();

  // --- HTTP Server ---
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = (req.url || '/').split('?')[0];
    const filePath = join(distDir, url);

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const ext = extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(readFileSync(filePath));
    } else {
      // SPA fallback
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(readFileSync(join(distDir, 'index.html')));
    }
  });

  // --- WebSocket upgrade ---
  server.on('upgrade', (req: IncomingMessage, socket: Socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }

    const accept = createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-5AB5DC85B178')
      .digest('base64');

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n` +
      '\r\n'
    );

    clients.add(socket);
    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));
  });

  // --- File Watcher ---
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function onFileChange(filename: string | null) {
    if (filename && (filename.includes('dist') || filename.includes('node_modules'))) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(`[NEURON DEV] File changed${filename ? ': ' + filename : ''}, rebuilding...`);
      const ok = rebuild();
      if (ok) {
        console.log('[NEURON DEV] Build complete, reloading browser...');
        const frame = encodeWSFrame('reload');
        for (const client of clients) {
          try { client.write(frame); } catch {}
        }
      } else {
        console.log('[NEURON DEV] Build had errors, skipping reload.');
      }
    }, 300);
  }

  try {
    watch(projectDir, { recursive: true }, (_event, filename) => {
      onFileChange(filename ? String(filename) : null);
    });
  } catch {
    // Fallback: watch individual directories
    const dirs = ['pages', 'apis', 'logic', 'themes', 'assets'];
    watch(join(projectDir, 'app.neuron'), () => onFileChange('app.neuron'));
    for (const dir of dirs) {
      const dirPath = join(projectDir, dir);
      if (existsSync(dirPath)) {
        watch(dirPath, { recursive: false }, (_event, filename) => {
          onFileChange(filename ? String(filename) : null);
        });
      }
    }
  }

  // --- Start ---
  server.listen(port, () => {
    console.log(`[NEURON DEV] Dev server running at http://localhost:${port}`);
    console.log('[NEURON DEV] Watching for changes...');
  });
}
```

- [ ] **Step 2: Run all tests to verify nothing breaks**

Run: `npx vitest run`
Expected: ALL PASS (dev-server has no unit tests — it's an integration module)

- [ ] **Step 3: Commit**

```bash
git add src/dev-server.ts
git commit -m "feat: implement dev server with HTTP, WebSocket, and file watching"
```

---

### Task 6: CLI `dev` Command

**Files:**
- Modify: `src/cli.ts`
- Modify: `tests/cli.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/cli.test.ts`:
```typescript
  it('shows dev command in help', () => {
    // Capture console output by calling run with no args
    const originalLog = console.log;
    const output: string[] = [];
    console.log = (...args: any[]) => output.push(args.join(' '));
    run([]);
    console.log = originalLog;
    expect(output.some(line => line.includes('dev'))).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cli.test.ts`
Expected: FAIL

- [ ] **Step 3: Add dev command to CLI**

In `src/cli.ts`, add import at top:
```typescript
import { startDevServer } from './dev-server';
```

Add the `dev` command handler after the `build` command block:
```typescript
  if (command === 'dev') {
    const projectDir = resolve(process.cwd());
    const appFile = join(projectDir, 'app.neuron');

    if (!existsSync(appFile)) {
      console.error('[NEURON ERROR] app.neuron not found in current directory');
      process.exit(1);
    }

    let port = 3000;
    const portIdx = args.indexOf('--port');
    if (portIdx !== -1 && args[portIdx + 1]) {
      port = parseInt(args[portIdx + 1], 10);
    }

    startDevServer({ port, projectDir });
    return;
  }
```

Update the help text at the bottom of the `run` function:
```typescript
  console.log('Neuron DSL Compiler');
  console.log('');
  console.log('Commands:');
  console.log('  neuron new <name>   Create a new project');
  console.log('  neuron build        Build the current project');
  console.log('  neuron dev          Start dev server with live reload');
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts tests/cli.test.ts
git commit -m "feat: add neuron dev command to CLI"
```

---

### Task 7: E2E Validation Test

**Files:**
- Modify: `tests/e2e.test.ts`

- [ ] **Step 1: Add e2e test for validation**

Add to `tests/e2e.test.ts`:
```typescript
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

    // Should have multiple validation errors
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
    // Undefined persist field
    expect(result.errors.some(e => e.includes('wishlist'))).toBe(true);
    // Undefined API
    expect(result.errors.some(e => e.includes('missing-api'))).toBe(true);
    // Undefined state
    expect(result.errors.some(e => e.includes('nonexistent'))).toBe(true);
    // Undefined action
    expect(result.errors.some(e => e.includes('missing-action'))).toBe(true);
    // Duplicate page name
    expect(result.errors.some(e => e.includes('home') && e.includes('중복'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e.test.ts
git commit -m "test: add e2e test for build-time validation"
```

---

### Task 8: Update Documentation

**Files:**
- Modify: `REFERENCE.md`
- Modify: `README.md`

- [ ] **Step 1: Update REFERENCE.md**

Add to the end (before Key Constraints):

```markdown
## Dev Server

```bash
neuron dev              # Start dev server (port 3000)
neuron dev --port 8080  # Custom port
```

Watches `.neuron`, `logic/*.js`, `themes/theme.json`, and `assets/` for changes. Auto-rebuilds and reloads browser via WebSocket.

## Build Validation

`neuron build` automatically validates:

| Check | Description |
|-------|-------------|
| Undefined state | `data:`, `state:`, `show_if:` referencing undeclared STATE fields |
| Undefined action | `on_click:`, `on_remove:`, inline actions referencing undeclared ACTIONs |
| Undefined API | `call:` referencing undeclared APIs |
| Duplicate routes | Multiple PAGEs with the same route |
| Duplicate page names | Multiple PAGEs with the same name |
| Invalid persist | `persist:` fields not declared in STATE |

Validation errors appear in build output but do not block code generation.
```

- [ ] **Step 2: Update README.md**

Add to the features section:
```markdown
### 개발자 경험 (v2.2)

- **`neuron dev`**: 파일 감시 + 자동 리빌드 + 라이브 리로드 dev server
- **빌드 검증**: 미정의 state/action/API 참조, 중복 라우트 자동 검출
```

- [ ] **Step 3: Commit**

```bash
git add REFERENCE.md README.md
git commit -m "docs: update docs with Phase 3 dev server and validation features"
```

---

### Task 9: Build Verification

**Files:** None

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Build the project**

Run: `npm run build`
Expected: Success

- [ ] **Step 3: Test the built CLI**

```bash
cd /tmp && rm -rf neuron-p3-test && mkdir neuron-p3-test && cd neuron-p3-test
node /Users/guest-user/workspace/neuron/dist/index.js new my-app
cd my-app
node /Users/guest-user/workspace/neuron/dist/index.js build
ls dist/
```

Expected: dist/ with index.html, style.css, main.js, serve.js, assets/

- [ ] **Step 4: Clean up**

```bash
rm -rf /tmp/neuron-p3-test
```
