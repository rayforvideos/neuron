# Phase 4: Ecosystem/Extensibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add custom HTML component support via `components/` directory and theme presets (default, dark, minimal, vibrant) selectable from `neuron.json`.

**Architecture:** Custom components use HTML templates with `{{prop}}` placeholders, scanned from `components/` at compile time. Theme presets are hardcoded Theme objects in a new `theme-presets.ts` file, loaded via `neuron.json`'s `theme` field. Both features integrate into the existing compile pipeline with minimal changes to existing modules.

**Tech Stack:** TypeScript, Vitest, tsup

---

## File Structure

| File | Responsibility | Change Type |
|------|---------------|-------------|
| `src/theme-presets.ts` | Hardcoded theme preset objects | Create |
| `src/theme.ts` | Theme loading with preset support | Modify |
| `src/components/registry.ts` | Custom component rendering fallback | Modify |
| `src/compiler.ts` | Scan components/, load presets from neuron.json, pass custom CSS | Modify |
| `src/generator/css.ts` | Accept and append custom component CSS | Modify |
| `src/errors.ts` | Add component_name_conflict error code | Modify |
| `src/cli.ts` | Add --theme option to neuron new | Modify |
| `src/scaffold.ts` | Handle --theme option | Modify |
| `tests/theme-presets.test.ts` | Preset tests | Create |
| `tests/theme.test.ts` | Preset loading tests | Modify |
| `tests/components/registry.test.ts` | Custom renderer tests | Modify |
| `tests/compiler.test.ts` | Custom component + preset integration | Modify |
| `tests/generator/css.test.ts` | Custom CSS inclusion | Modify |
| `tests/e2e.test.ts` | Full pipeline e2e | Modify |

---

### Task 1: Theme Presets

**Files:**
- Create: `src/theme-presets.ts`
- Create: `tests/theme-presets.test.ts`
- Modify: `src/theme.ts`
- Modify: `tests/theme.test.ts`

- [ ] **Step 1: Write failing test for presets**

Create `tests/theme-presets.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { PRESETS } from '../src/theme-presets';

describe('theme presets', () => {
  it('has 4 presets: default, dark, minimal, vibrant', () => {
    expect(Object.keys(PRESETS)).toEqual(['default', 'dark', 'minimal', 'vibrant']);
  });

  it('each preset has required theme fields', () => {
    for (const [name, theme] of Object.entries(PRESETS)) {
      expect(theme.colors.primary, `${name}.colors.primary`).toBeDefined();
      expect(theme.colors.bg, `${name}.colors.bg`).toBeDefined();
      expect(theme.colors.text, `${name}.colors.text`).toBeDefined();
      expect(theme.font.family, `${name}.font.family`).toBeDefined();
      expect(theme.radius, `${name}.radius`).toBeDefined();
      expect(theme.transition, `${name}.transition`).toBeDefined();
    }
  });

  it('dark preset has dark background', () => {
    expect(PRESETS.dark.colors.bg).toBe('#121212');
  });

  it('minimal preset has zero radius', () => {
    expect(PRESETS.minimal.radius).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/theme-presets.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create theme-presets.ts**

Create `src/theme-presets.ts`:
```typescript
import type { Theme } from './theme';

export const PRESETS: Record<string, Theme> = {
  default: {
    colors: { primary: '#2E86AB', secondary: '#A23B72', danger: '#E84855', bg: '#FFFFFF', text: '#1A1A2E', border: '#E0E0E0' },
    font: { family: 'Inter', size: { sm: 14, md: 16, lg: 20, xl: 28 } },
    radius: 8,
    shadow: '0 2px 8px rgba(0,0,0,0.1)',
    spacing: { sm: 8, md: 16, lg: 24, xl: 48 },
    transition: 'none',
  },
  dark: {
    colors: { primary: '#00D4AA', secondary: '#BB86FC', danger: '#CF6679', bg: '#121212', text: '#E0E0E0', border: '#333333' },
    font: { family: 'Inter', size: { sm: 14, md: 16, lg: 20, xl: 28 } },
    radius: 8,
    shadow: '0 2px 8px rgba(0,0,0,0.3)',
    spacing: { sm: 8, md: 16, lg: 24, xl: 48 },
    transition: 'none',
  },
  minimal: {
    colors: { primary: '#000000', secondary: '#666666', danger: '#CC0000', bg: '#FFFFFF', text: '#000000', border: '#CCCCCC' },
    font: { family: 'Georgia', size: { sm: 14, md: 16, lg: 20, xl: 28 } },
    radius: 0,
    shadow: 'none',
    spacing: { sm: 8, md: 16, lg: 24, xl: 48 },
    transition: 'none',
  },
  vibrant: {
    colors: { primary: '#FF6B6B', secondary: '#4ECDC4', danger: '#FF4757', bg: '#FAFAFA', text: '#2D3436', border: '#DFE6E9' },
    font: { family: 'Poppins', size: { sm: 14, md: 16, lg: 20, xl: 28 } },
    radius: 12,
    shadow: '0 4px 16px rgba(0,0,0,0.08)',
    spacing: { sm: 8, md: 16, lg: 24, xl: 48 },
    transition: 'fade',
  },
};
```

- [ ] **Step 4: Run preset tests**

Run: `npx vitest run tests/theme-presets.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Write failing test for loadTheme with preset**

Add to `tests/theme.test.ts`:
```typescript
  it('loads theme from preset name', () => {
    const theme = loadTheme(null, 'dark');
    expect(theme.colors.bg).toBe('#121212');
    expect(theme.colors.primary).toBe('#00D4AA');
  });

  it('file takes priority over preset', () => {
    const path = resolve(__dirname, 'fixtures/theme.json');
    const theme = loadTheme(path, 'dark');
    // File should win — fixture has primary #2E86AB, not dark's #00D4AA
    expect(theme.colors.primary).toBe('#2E86AB');
  });

  it('falls back to default when preset name is unknown', () => {
    const theme = loadTheme(null, 'nonexistent');
    expect(theme.colors.primary).toBe('#2E86AB');
  });
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/theme.test.ts`
Expected: FAIL — loadTheme doesn't accept preset parameter

- [ ] **Step 7: Update loadTheme to accept preset**

In `src/theme.ts`, add import and update function:
```typescript
import { PRESETS } from './theme-presets';
```

Update `loadTheme`:
```typescript
export function loadTheme(path: string | null, presetName?: string): Theme {
  if (path) {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_THEME, ...parsed, transition: parsed.transition || 'none' };
  }
  if (presetName && PRESETS[presetName]) {
    return { ...PRESETS[presetName] };
  }
  return { ...DEFAULT_THEME };
}
```

- [ ] **Step 8: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add src/theme-presets.ts src/theme.ts tests/theme-presets.test.ts tests/theme.test.ts
git commit -m "feat: add theme presets (default, dark, minimal, vibrant)"
```

---

### Task 2: Compiler Preset Integration

**Files:**
- Modify: `src/compiler.ts`
- Modify: `tests/compiler.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/compiler.test.ts`:
```typescript
  it('loads theme preset from neuron.json', () => {
    const tmpDir = join(__dirname, '.tmp-compiler-preset');
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, 'pages'), { recursive: true });

    writeFileSync(join(tmpDir, 'app.neuron'), `STATE
  items: []`);
    writeFileSync(join(tmpDir, 'pages', 'home.neuron'), `PAGE home "Home" /

  text
    content: "Hello"`);
    writeFileSync(join(tmpDir, 'neuron.json'), JSON.stringify({ name: 'Test', theme: 'dark' }));

    const result = compile({
      appFile: join(tmpDir, 'app.neuron'),
      pageFiles: [join(tmpDir, 'pages', 'home.neuron')],
      apiFiles: [],
      themeFile: null,
      appTitle: 'Test',
    });

    expect(result.errors).toEqual([]);
    // Dark theme has #121212 bg
    expect(result.css).toContain('#121212');

    rmSync(tmpDir, { recursive: true, force: true });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/compiler.test.ts`
Expected: FAIL — compiler doesn't read neuron.json for theme preset

- [ ] **Step 3: Update compiler to read preset from neuron.json**

In `src/compiler.ts`, update the theme loading section. After parsing, before loading theme:

```typescript
  // Load theme (preset or file)
  let presetName: string | undefined;
  const neuronJsonPath = join(projectDir, 'neuron.json');
  if (existsSync(neuronJsonPath)) {
    try {
      const config = JSON.parse(readFileSync(neuronJsonPath, 'utf-8'));
      if (config.theme) presetName = config.theme;
    } catch {}
  }
  const theme = loadTheme(input.themeFile, presetName);
```

Replace the existing `const theme = loadTheme(input.themeFile);` line with the above block.

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/compiler.ts tests/compiler.test.ts
git commit -m "feat: load theme preset from neuron.json config"
```

---

### Task 3: Error Code for Component Name Conflict

**Files:**
- Modify: `src/errors.ts`
- Modify: `tests/errors.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/errors.test.ts`:
```typescript
  it('formats component_name_conflict error', () => {
    const err = new NeuronError('component_name_conflict', 'header', {});
    expect(formatError(err)).toContain('header');
    expect(formatError(err)).toContain('충돌');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/errors.test.ts`
Expected: FAIL

- [ ] **Step 3: Add error code**

In `src/errors.ts`, add to `ErrorCode`:
```typescript
  | 'component_name_conflict';
```

Add to `messages`:
```typescript
  component_name_conflict: (target) =>
    `[NEURON ERROR] 커스텀 컴포넌트 "${target}"가 빌트인 컴포넌트와 이름이 충돌합니다\n→ 다른 이름을 사용하세요`,
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/errors.ts tests/errors.test.ts
git commit -m "feat: add component_name_conflict error code"
```

---

### Task 4: Custom Component Registry

**Files:**
- Modify: `src/components/registry.ts`
- Modify: `tests/components/registry.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/components/registry.test.ts`:
```typescript
  describe('custom components', () => {
    it('renders custom component from template', () => {
      registerCustomComponent('rating', '<div class="rating">{{label}} ★ {{value}}</div>');
      const node: ComponentNode = {
        type: 'COMPONENT',
        componentType: 'rating',
        properties: [
          { key: 'label', value: '"Score"' },
          { key: 'value', value: '"4.5"' },
        ],
        children: [],
      };
      const html = renderComponent(node);
      expect(html).toContain('Score');
      expect(html).toContain('4.5');
      expect(html).toContain('rating');
      clearCustomComponents();
    });

    it('removes unused placeholders', () => {
      registerCustomComponent('badge', '<span class="badge">{{text}} {{extra}}</span>');
      const node: ComponentNode = {
        type: 'COMPONENT',
        componentType: 'badge',
        properties: [{ key: 'text', value: '"NEW"' }],
        children: [],
      };
      const html = renderComponent(node);
      expect(html).toContain('NEW');
      expect(html).not.toContain('{{extra}}');
      clearCustomComponents();
    });

    it('falls back to unknown comment for unregistered component', () => {
      const node: ComponentNode = {
        type: 'COMPONENT',
        componentType: 'nonexistent',
        properties: [],
        children: [],
      };
      const html = renderComponent(node);
      expect(html).toContain('<!-- unknown component');
      clearCustomComponents();
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/registry.test.ts`
Expected: FAIL — `registerCustomComponent` and `clearCustomComponents` not exported

- [ ] **Step 3: Implement custom component support in registry**

In `src/components/registry.ts`, add after the `KNOWN_COMPONENTS` array:

```typescript
const customTemplates = new Map<string, string>();

export function registerCustomComponent(name: string, template: string): void {
  customTemplates.set(name, template);
}

export function clearCustomComponents(): void {
  customTemplates.clear();
}
```

Update the `renderComponent` function to check custom templates before falling back:

```typescript
export function renderComponent(node: ComponentNode): string {
  const renderer = renderers[node.componentType];
  if (renderer) {
    return renderer(node);
  }

  // Check custom components
  const template = customTemplates.get(node.componentType);
  if (template) {
    return renderCustom(template, node);
  }

  return `<!-- unknown component: ${node.componentType} -->`;
}
```

Add the `renderCustom` helper:
```typescript
function renderCustom(template: string, node: ComponentNode): string {
  let html = template;
  for (const prop of node.properties) {
    const val = unquote(prop.value);
    html = html.replace(new RegExp(`\\{\\{${prop.key}\\}\\}`, 'g'), val);
  }
  // Remove unused placeholders
  html = html.replace(/\{\{\w+\}\}/g, '');
  return html;
}
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/registry.ts tests/components/registry.test.ts
git commit -m "feat: add custom component template rendering to registry"
```

---

### Task 5: Compiler Custom Component Scanning

**Files:**
- Modify: `src/compiler.ts`
- Modify: `src/generator/css.ts`
- Modify: `tests/compiler.test.ts`
- Modify: `tests/generator/css.test.ts`

- [ ] **Step 1: Write failing compiler test**

Add to `tests/compiler.test.ts`:
```typescript
  it('scans components/ directory and renders custom components', () => {
    const tmpDir = join(__dirname, '.tmp-compiler-custom');
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, 'pages'), { recursive: true });
    mkdirSync(join(tmpDir, 'components'), { recursive: true });

    writeFileSync(join(tmpDir, 'app.neuron'), `STATE
  items: []`);
    writeFileSync(join(tmpDir, 'pages', 'home.neuron'), `PAGE home "Home" /

  rating
    label: "Score"
    value: "4.5"`);
    writeFileSync(join(tmpDir, 'components', 'rating.html'), `<div class="rating">{{label}} ★ {{value}}</div>`);
    writeFileSync(join(tmpDir, 'components', 'rating.css'), `.rating { color: gold; }`);

    const result = compile({
      appFile: join(tmpDir, 'app.neuron'),
      pageFiles: [join(tmpDir, 'pages', 'home.neuron')],
      apiFiles: [],
      themeFile: null,
      appTitle: 'Test',
    });

    expect(result.errors).toEqual([]);
    expect(result.html).toContain('Score');
    expect(result.html).toContain('4.5');
    expect(result.html).toContain('rating');
    expect(result.css).toContain('.rating { color: gold; }');

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports error when custom component conflicts with builtin', () => {
    const tmpDir = join(__dirname, '.tmp-compiler-conflict');
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, 'pages'), { recursive: true });
    mkdirSync(join(tmpDir, 'components'), { recursive: true });

    writeFileSync(join(tmpDir, 'app.neuron'), `STATE
  items: []`);
    writeFileSync(join(tmpDir, 'pages', 'home.neuron'), `PAGE home "Home" /

  text
    content: "Hello"`);
    writeFileSync(join(tmpDir, 'components', 'header.html'), `<header>{{title}}</header>`);

    const result = compile({
      appFile: join(tmpDir, 'app.neuron'),
      pageFiles: [join(tmpDir, 'pages', 'home.neuron')],
      apiFiles: [],
      themeFile: null,
      appTitle: 'Test',
    });

    expect(result.errors.some(e => e.includes('header') && e.includes('충돌'))).toBe(true);

    rmSync(tmpDir, { recursive: true, force: true });
  });
```

- [ ] **Step 2: Write failing CSS test**

Add to `tests/generator/css.test.ts`:
```typescript
  it('includes custom component CSS', () => {
    const customCSS = '.rating { color: gold; }';
    const css = generateCSS(DEFAULT_THEME, customCSS);
    expect(css).toContain('.rating { color: gold; }');
  });

  it('works without custom CSS', () => {
    const css = generateCSS(DEFAULT_THEME);
    expect(css).toContain(':root');
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/compiler.test.ts tests/generator/css.test.ts`
Expected: FAIL

- [ ] **Step 4: Update generateCSS to accept custom CSS**

In `src/generator/css.ts`, update the function signature:
```typescript
export function generateCSS(theme: Theme, customCSS?: string): string {
  let css = themeToCSS(theme) + '\n' + BASE_STYLES;
  if (theme.transition === 'fade') {
    css += '\n' + FADE_TRANSITION;
  } else if (theme.transition === 'slide') {
    css += '\n' + SLIDE_TRANSITION;
  }
  if (customCSS) {
    css += '\n/* Custom Components */\n' + customCSS;
  }
  return css;
}
```

- [ ] **Step 5: Update compiler to scan components/ and pass custom CSS**

In `src/compiler.ts`, add imports:
```typescript
import { registerCustomComponent, clearCustomComponents, KNOWN_COMPONENTS } from './components/registry';
```

After logic directory scanning and before validation, add:
```typescript
  // Scan components/ directory
  clearCustomComponents();
  let customCSS = '';
  const componentsDir = join(projectDir, 'components');
  if (existsSync(componentsDir)) {
    const htmlFiles = readdirSync(componentsDir).filter(f => f.endsWith('.html'));
    for (const file of htmlFiles) {
      const name = file.replace('.html', '');
      if (KNOWN_COMPONENTS.includes(name)) {
        errors.push(formatError(new NeuronError('component_name_conflict', name, {})));
        continue;
      }
      const template = readFileSync(join(componentsDir, file), 'utf-8');
      registerCustomComponent(name, template);

      // Check for matching CSS file
      const cssFile = join(componentsDir, name + '.css');
      if (existsSync(cssFile)) {
        customCSS += readFileSync(cssFile, 'utf-8') + '\n';
      }
    }
  }
```

Update the CSS generation call:
```typescript
  const css = generateCSS(theme, customCSS || undefined);
```

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/compiler.ts src/generator/css.ts tests/compiler.test.ts tests/generator/css.test.ts
git commit -m "feat: scan components/ directory for custom HTML components and CSS"
```

---

### Task 6: Scaffold --theme Option

**Files:**
- Modify: `src/scaffold.ts`
- Modify: `src/cli.ts`
- Modify: `tests/cli.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/cli.test.ts`:
```typescript
  it('neuron new --theme sets theme in neuron.json', () => {
    const tmpDir = join(__dirname, '.tmp-scaffold-theme');
    mkdirSync(tmpDir, { recursive: true });
    scaffold('test-theme', tmpDir, 'dark');
    const neuronJson = JSON.parse(readFileSync(join(tmpDir, 'test-theme', 'neuron.json'), 'utf-8'));
    expect(neuronJson.theme).toBe('dark');
    // Should NOT create themes/theme.json when using preset
    expect(existsSync(join(tmpDir, 'test-theme', 'themes', 'theme.json'))).toBe(false);
    rmSync(join(tmpDir, 'test-theme'), { recursive: true, force: true });
  });
```

Make sure `readFileSync`, `existsSync`, `rmSync` are imported.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cli.test.ts`
Expected: FAIL — scaffold doesn't accept theme parameter

- [ ] **Step 3: Update scaffold to accept theme option**

In `src/scaffold.ts`, update the function signature:
```typescript
export function scaffold(projectName: string, targetDir: string, themePreset?: string): void {
```

Update the files array to conditionally include theme.json:
```typescript
  const files: Array<{ src: string; dest: string }> = [
    { src: 'neuron.json', dest: 'neuron.json' },
    { src: 'app.neuron', dest: 'app.neuron' },
    { src: 'pages/home.neuron', dest: 'pages/home.neuron' },
  ];

  // Only include theme.json if no preset is specified
  if (!themePreset) {
    files.push({ src: 'theme.json', dest: 'themes/theme.json' });
  }
```

After writing template files, if themePreset is set, update neuron.json:
```typescript
  // If theme preset specified, add it to neuron.json
  if (themePreset) {
    const neuronJsonPath = join(projectDir, 'neuron.json');
    const config = JSON.parse(readFileSync(neuronJsonPath, 'utf-8'));
    config.theme = themePreset;
    writeFileSync(neuronJsonPath, JSON.stringify(config, null, 2));
  }
```

- [ ] **Step 4: Update CLI to pass --theme to scaffold**

In `src/cli.ts`, in the `new` command handler:
```typescript
  if (command === 'new') {
    const projectName = args[1];
    if (!projectName) {
      console.error('Usage: neuron new <project-name>');
      process.exit(1);
    }
    const themeIdx = args.indexOf('--theme');
    const themePreset = themeIdx !== -1 && args[themeIdx + 1] ? args[themeIdx + 1] : undefined;
    scaffold(projectName, process.cwd(), themePreset);
    console.log(`Created project: ${projectName}/`);
    return;
  }
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/scaffold.ts src/cli.ts tests/cli.test.ts
git commit -m "feat: add --theme option to neuron new for preset selection"
```

---

### Task 7: E2E Integration Test

**Files:**
- Modify: `tests/e2e.test.ts`

- [ ] **Step 1: Add e2e test for custom components + presets**

Add to `tests/e2e.test.ts`:
```typescript
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

    // Custom component rendering
    expect(result.html).toContain('Score');
    expect(result.html).toContain('4.5');
    expect(result.html).toContain('rating');
    expect(result.html).toContain('NEW');
    expect(result.html).toContain('badge');

    // Custom CSS included
    expect(result.css).toContain('.rating');
    expect(result.css).toContain('#f59e0b');

    // Dark theme preset applied
    expect(result.css).toContain('#121212');
    expect(result.css).toContain('#00D4AA');

    // Unused placeholder removed
    expect(result.html).not.toContain('{{variant}}');
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e.test.ts
git commit -m "test: add e2e test for custom components and theme presets"
```

---

### Task 8: Update Documentation

**Files:**
- Modify: `REFERENCE.md`
- Modify: `README.md`

- [ ] **Step 1: Update REFERENCE.md**

Add **Custom Components** section:
```markdown
## Custom Components

Create HTML templates in `components/` directory:

\```html
<!-- components/rating.html -->
<div class="rating">
  <span>{{label}}</span>
  <span>★ {{value}}</span>
</div>
\```

Optional CSS in matching file:
\```css
/* components/rating.css */
.rating { display: flex; gap: 8px; }
\```

Use in DSL like any built-in component:
\```
rating
  label: "Score"
  value: "4.5"
\```

- File name = component name (`rating.html` → `rating`)
- `{{prop}}` placeholders are replaced by component properties
- Cannot conflict with built-in component names
```

Add **Theme Presets** section:
```markdown
## Theme Presets

Set in `neuron.json`:
\```json
{
  "name": "My App",
  "theme": "dark"
}
\```

Available presets: `default`, `dark`, `minimal`, `vibrant`

Priority: `themes/theme.json` (file) > `neuron.json` theme field (preset) > default

Scaffold with preset:
\```bash
neuron new my-app --theme dark
\```
```

- [ ] **Step 2: Update README.md**

Add to features:
```markdown
### 생태계 (v2.3)

- **커스텀 컴포넌트**: `components/` 디렉토리에 HTML 템플릿으로 새 컴포넌트 추가
- **테마 프리셋**: `default`, `dark`, `minimal`, `vibrant` — neuron.json에서 한 줄로 설정
```

- [ ] **Step 3: Commit**

```bash
git add REFERENCE.md README.md
git commit -m "docs: update docs with Phase 4 custom components and theme presets"
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
cd /tmp && rm -rf neuron-p4-test && mkdir neuron-p4-test && cd neuron-p4-test
node /Users/guest-user/workspace/neuron/dist/index.js new my-app --theme dark
cd my-app
cat neuron.json  # Should contain "theme": "dark"
ls themes/       # Should NOT have theme.json
node /Users/guest-user/workspace/neuron/dist/index.js build
ls dist/
```

- [ ] **Step 4: Clean up**

```bash
rm -rf /tmp/neuron-p4-test
```
