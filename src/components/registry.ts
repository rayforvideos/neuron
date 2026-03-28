import type { ComponentNode } from '../ast';

export const KNOWN_COMPONENTS: string[] = [
  // Layout
  'header', 'footer', 'section', 'grid', 'hero',
  // Data display
  'product-grid', 'list', 'table', 'text', 'image',
  // State-bound
  'cart-icon', 'cart-summary', 'cart-list',
  // Interaction
  'button', 'form', 'search', 'tabs', 'modal',
];

/* ── helpers ─────────────────────────────────────────────────────── */

function getProp(node: ComponentNode, key: string): string | undefined {
  const found = node.properties.find((p) => p.key === key);
  return found?.value;
}

function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/** Parse `[label>href, label>href]` → array of {label, href} */
function parseLinks(raw: string): { label: string; href: string }[] {
  const inner = raw.replace(/^\[/, '').replace(/\]$/, '');
  return inner.split(',').map((part) => {
    const trimmed = part.trim();
    const sepIdx = trimmed.indexOf('>');
    if (sepIdx === -1) return { label: trimmed, href: '#' };
    return { label: trimmed.slice(0, sepIdx).trim(), href: trimmed.slice(sepIdx + 1).trim() };
  });
}

/** Parse `"label" -> action` → {label, action} */
function parseCta(raw: string): { label: string; action: string } {
  const match = raw.match(/^"([^"]+)"\s*->\s*(.+)$/);
  if (match) return { label: match[1], action: match[2].trim() };
  return { label: raw, action: '#' };
}

/* ── renderers ───────────────────────────────────────────────────── */

const renderers: Record<string, (node: ComponentNode) => string> = {
  header(node) {
    const title = unquote(getProp(node, 'title') ?? '');
    const linksRaw = getProp(node, 'links') ?? '';
    const links = linksRaw ? parseLinks(linksRaw) : [];
    const navItems = links
      .map((l) => `<a href="${l.href}" data-link>${l.label}</a>`)
      .join('');
    return `<header class="neuron-header"><h1>${title}</h1><nav>${navItems}</nav></header>`;
  },

  footer(node) {
    const text = unquote(getProp(node, 'text') ?? '');
    return `<footer class="neuron-footer"><p>${text}</p></footer>`;
  },

  section(node) {
    const childrenHtml = node.children.map(renderComponent).join('');
    return `<section class="neuron-section">${childrenHtml}</section>`;
  },

  grid(node) {
    const cols = getProp(node, 'cols') ?? '1';
    const childrenHtml = node.children.map(renderComponent).join('');
    return `<div class="neuron-grid" style="grid-template-columns:repeat(${cols},1fr)">${childrenHtml}</div>`;
  },

  hero(node) {
    const title = unquote(getProp(node, 'title') ?? '');
    const subtitle = unquote(getProp(node, 'subtitle') ?? '');
    const ctaRaw = getProp(node, 'cta');
    let ctaHtml = '';
    if (ctaRaw) {
      const cta = parseCta(ctaRaw);
      if (cta.action.startsWith('/')) {
        ctaHtml = `<a href="${cta.action}" class="neuron-btn" data-link>${cta.label}</a>`;
      } else {
        ctaHtml = `<button class="neuron-btn" data-action="${cta.action}">${cta.label}</button>`;
      }
    }
    return `<section class="neuron-hero"><h2>${title}</h2><p>${subtitle}</p>${ctaHtml}</section>`;
  },

  'product-grid'(node) {
    const data = getProp(node, 'data') ?? '';
    const cols = getProp(node, 'cols') ?? '3';
    const action = getProp(node, 'on_click') ?? '';
    return `<div id="product-grid" class="neuron-product-grid" data-source="${data}" data-cols="${cols}" data-action="${action}"></div>`;
  },

  list(node) {
    const data = getProp(node, 'data') ?? '';
    return `<div class="neuron-list" data-source="${data}"></div>`;
  },

  table(node) {
    const data = getProp(node, 'data') ?? '';
    return `<table class="neuron-table" data-source="${data}"></table>`;
  },

  text(node) {
    const content = unquote(getProp(node, 'content') ?? '');
    const size = getProp(node, 'size') ?? 'md';
    return `<p class="neuron-text neuron-text--${size}">${content}</p>`;
  },

  image(node) {
    const src = getProp(node, 'src') ?? '';
    const alt = getProp(node, 'alt') ?? '';
    return `<img class="neuron-image" src="${src}" alt="${alt}">`;
  },

  'cart-icon'(node) {
    const state = getProp(node, 'state') ?? '';
    return `<div id="cart-icon" class="neuron-cart-icon" data-state="${state}"><span class="badge">0</span></div>`;
  },

  'cart-summary'(node) {
    const state = getProp(node, 'state') ?? '';
    return `<div id="cart-summary" class="neuron-cart-summary" data-state="${state}"></div>`;
  },

  'cart-list'(node) {
    const state = getProp(node, 'state') ?? '';
    const removeAction = getProp(node, 'on_remove') ?? '';
    return `<div id="cart-list" class="neuron-cart-list" data-state="${state}" data-remove-action="${removeAction}"></div>`;
  },

  button(node) {
    const label = node.inlineLabel ?? unquote(getProp(node, 'label') ?? '');
    const action = node.inlineAction ?? getProp(node, 'action') ?? '#';
    const variant = getProp(node, 'variant') ?? 'default';
    if (action.startsWith('/')) {
      return `<a href="${action}" class="neuron-btn neuron-btn--${variant}" data-link>${label}</a>`;
    }
    return `<button class="neuron-btn neuron-btn--${variant}" data-action="${action}">${label}</button>`;
  },

  form(node) {
    const submitRaw = getProp(node, 'submit');
    let submitHtml = '';
    if (submitRaw) {
      const submit = parseCta(submitRaw);
      submitHtml = `<button type="submit" class="neuron-btn" data-action="${submit.action}">${submit.label}</button>`;
    }
    // Collect field properties (fields_items or field_*)
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

  search(node) {
    const placeholder = unquote(getProp(node, 'placeholder') ?? '');
    const state = getProp(node, 'state') ?? '';
    return `<input class="neuron-search" type="search" placeholder="${placeholder}" data-state="${state}">`;
  },

  tabs(_node) {
    return `<div class="neuron-tabs"></div>`;
  },

  modal(node) {
    const state = getProp(node, 'state') ?? '';
    const title = unquote(getProp(node, 'title') ?? '');
    return `<div class="neuron-modal" data-state="${state}"><h3>${title}</h3><div class="neuron-modal-body"></div></div>`;
  },
};

/* ── public API ──────────────────────────────────────────────────── */

export function renderComponent(node: ComponentNode): string {
  const renderer = renderers[node.componentType];
  if (!renderer) {
    return `<!-- unknown component: ${node.componentType} -->`;
  }
  return renderer(node);
}
