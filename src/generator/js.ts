// src/generator/js.ts

import type { NeuronAST, ActionNode, ApiNode, ComponentNode } from '../ast';

export function generateJS(ast: NeuronAST): string {
  const lines: string[] = [];

  // 1. State initialization
  lines.push(generateState(ast));

  // 2. Bindings
  lines.push(generateBindings(ast));

  // 3. _setState function
  lines.push(generateSetState());

  // 4. Router
  lines.push(generateRouter(ast));

  // 5. Action handlers
  lines.push(generateActions(ast));

  // 6. Form handling
  lines.push(generateFormHandling());

  // 6.5 Show-if bindings
  const showIfCode = generateShowIfBindings(ast);
  if (showIfCode) lines.push(showIfCode);

  // 7. Auto-load
  lines.push(generateAutoLoad(ast));

  // 8. Runtime renderers for data-bound components
  const renderers = generateRuntimeRenderers(ast);
  if (renderers) lines.push(renderers);

  // 9. Init bindings
  lines.push(generateInitBindings(ast));

  // 10. DOMContentLoaded init
  lines.push(generateInit(ast));

  return lines.join('\n\n');
}

function generateState(ast: NeuronAST): string {
  const fields = ast.states.flatMap(s => s.fields);
  const entries = fields.map(f => `  "${f.name}": ${f.defaultValue}`);
  entries.push('  "_params": {}');
  return `const _state = {\n${entries.join(',\n')}\n};`;
}

function generateBindings(ast: NeuronAST): string {
  const fields = ast.states.flatMap(s => s.fields);
  const entries = fields.map(f => `  "${f.name}": []`);
  entries.push('  "_params": []');
  return `const _bindings = {\n${entries.join(',\n')}\n};`;
}

function generateSetState(): string {
  return `function _setState(key, val) {
  _state[key] = val;
  (_bindings[key] || []).forEach(fn => fn(val));
}`;
}

function generateRouter(ast: NeuronAST): string {
  const routeEntries = ast.pages.map(p => {
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

function generateActions(ast: NeuronAST): string {
  const apiMap = new Map<string, ApiNode>();
  for (const api of ast.apis) {
    apiMap.set(api.name, api);
  }

  const entries = ast.actions.map(action => {
    const body = generateActionBody(action, apiMap);
    return `  '${action.name}': ${body}`;
  });

  return `const _actions = {\n${entries.join(',\n')}\n};`;
}

function generateActionBody(action: ActionNode, apiMap: Map<string, ApiNode>): string {
  const stepMap = new Map<string, string>();
  for (const step of action.steps) {
    stepMap.set(step.key, step.value);
  }

  // append pattern: "item -> target"
  if (stepMap.has('append')) {
    const val = stepMap.get('append')!;
    const parts = val.split('->').map(s => s.trim());
    const target = parts[1];
    return `function(item) {\n    _setState('${target}', [..._state.${target}, item]);\n  }`;
  }

  // remove pattern: "target where id matches"
  if (stepMap.has('remove')) {
    const val = stepMap.get('remove')!;
    const target = val.split(' ')[0].trim();
    return `function(id) {\n    _setState('${target}', _state.${target}.filter(i => i.id !== id));\n  }`;
  }

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

    let errorCode = '';
    if (onError) {
      errorCode = `\n      } catch(err) {\n        console.error('${onError}', err);`;
    } else {
      errorCode = `\n      } catch(err) {\n        console.error(err);`;
    }

    return `async function() {
      try {
        const res = await fetch(${urlExpr}, {
          ${fetchOptions.join(',\n          ')}
        });
        const data = await res.json();
        ${successCode}${errorCode}
      }
    }`;
  }

  // set pattern: "field -> value"
  if (stepMap.has('set')) {
    const val = stepMap.get('set')!;
    const parts = val.split('->').map(s => s.trim());
    const field = parts[0];
    const rawValue = parts[1];
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

  return `function() {}`;
}

function generateFormHandling(): string {
  return `document.addEventListener('submit', function(e) {
  var form = e.target.closest('form');
  if (form) {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    var actionBtn = form.querySelector('[data-action]');
    var name = actionBtn ? actionBtn.getAttribute('data-action') : null;
    var formData = Object.fromEntries(new FormData(form));
    if (name && _actions[name]) _actions[name](formData);
  }
});`;
}

function generateAutoLoad(ast: NeuronAST): string {
  const autoApis = ast.apis.filter(a => a.options.on_load === 'true');
  if (autoApis.length === 0) return 'function _autoLoad() {}';

  const calls = autoApis.map(api => {
    return `  fetch('${api.endpoint}')
    .then(res => res.json())
    .then(data => _setState('${api.name}', data))
    .catch(err => console.error('Failed to load ${api.name}', err));`;
  });

  return `function _autoLoad() {\n${calls.join('\n')}\n}`;
}

/** Helper to get a property value from a ComponentNode */
function getProp(comp: ComponentNode, key: string): string | undefined {
  return comp.properties.find(p => p.key === key)?.value;
}

/** Collect all data-bound components from AST with their config */
interface BoundComponent {
  type: string;
  stateField: string;
  rendererId: string;
  config: Record<string, string>;
}

function collectBoundComponents(ast: NeuronAST): BoundComponent[] {
  const results: BoundComponent[] = [];
  const seen = new Set<string>();
  let counter = 0;

  function walk(components: ComponentNode[]) {
    for (const comp of components) {
      const type = comp.componentType;

      if (type === 'product-grid') {
        const dataField = getProp(comp, 'data') || 'items';
        const key = `product-grid:${dataField}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            type,
            stateField: dataField,
            rendererId: `_renderGrid${counter++}`,
            config: {
              image: getProp(comp, 'image') || '',
              title: getProp(comp, 'title') || '',
              subtitle: getProp(comp, 'subtitle') || '',
              price: getProp(comp, 'price') || '',
              id: getProp(comp, 'id') || 'id',
            },
          });
        }
      }

      if (type === 'cart-list') {
        const stateField = getProp(comp, 'state') || 'cart';
        const key = `cart-list:${stateField}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            type,
            stateField,
            rendererId: `_renderList${counter++}`,
            config: {
              image: getProp(comp, 'image') || '',
              title: getProp(comp, 'title') || '',
              subtitle: getProp(comp, 'subtitle') || '',
              price: getProp(comp, 'price') || '',
              id: getProp(comp, 'id') || 'id',
              empty_text: getProp(comp, 'empty_text') || '',
            },
          });
        }
      }

      if (type === 'cart-summary') {
        const stateField = getProp(comp, 'state') || 'cart';
        const key = `cart-summary:${stateField}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            type,
            stateField,
            rendererId: `_renderSummary${counter++}`,
            config: {
              price: getProp(comp, 'price') || '',
              count_label: getProp(comp, 'count_label') || '',
              total_label: getProp(comp, 'total_label') || '',
            },
          });
        }
      }

      if (type === 'cart-icon') {
        const stateField = getProp(comp, 'state') || 'cart';
        const key = `cart-icon:${stateField}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            type,
            stateField,
            rendererId: `_renderIcon${counter++}`,
            config: {},
          });
        }
      }

      walk(comp.children);
    }
  }

  for (const page of ast.pages) {
    walk(page.components);
  }
  return results;
}

/**
 * Generate a JS expression that builds HTML for one field.
 * If fieldName is provided (from .neuron config), use item[fieldName].
 * If not, returns '' (field is omitted from rendering).
 */
function fieldExpr(varName: string, fieldName: string): string {
  return fieldName ? `${varName}['${fieldName}']` : `''`;
}

function generateRuntimeRenderers(ast: NeuronAST): string {
  const bound = collectBoundComponents(ast);
  const parts: string[] = [];

  for (const bc of bound) {
    if (bc.type === 'product-grid') {
      const { image, title, subtitle, price, id } = bc.config;
      // Build card HTML parts conditionally based on which fields are mapped
      const imgPart = image
        ? `'<img class="neuron-product-card__img" src="' + p['${image}'] + '" alt="' + (p['${title}'] || '') + '">'`
        : `''`;
      const titlePart = title
        ? `'<h3 class="neuron-product-card__name">' + p['${title}'] + '</h3>'`
        : `''`;
      const subtitlePart = subtitle
        ? `'<p class="neuron-product-card__category">' + p['${subtitle}'] + '</p>'`
        : `''`;
      const pricePart = price
        ? `'<p class="neuron-product-card__price">' + (typeof p['${price}'] === "number" ? p['${price}'].toLocaleString() : p['${price}']) + '</p>'`
        : `''`;
      const idField = id || 'id';

      parts.push(`function ${bc.rendererId}(items) {
  document.querySelectorAll('.neuron-product-grid').forEach(function(grid) {
    var cols = grid.getAttribute('data-cols') || '3';
    var action = grid.getAttribute('data-action');
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
    if (!items || items.length === 0) {
      grid.innerHTML = '<div class="neuron-empty">No items</div>';
      return;
    }
    grid.innerHTML = items.map(function(p) {
      var html = '<article class="neuron-product-card">';
      html += ${imgPart};
      html += '<div class="neuron-product-card__body">';
      html += ${subtitlePart};
      html += ${titlePart};
      html += ${pricePart};
      if (action) html += '<button class="neuron-btn neuron-btn--primary neuron-product-card__btn" data-product-id="' + p['${idField}'] + '">+</button>';
      html += '</div></article>';
      return html;
    }).join('');
    if (action) {
      grid.querySelectorAll('[data-product-id]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var pid = this.getAttribute('data-product-id');
          var source = grid.getAttribute('data-source');
          var product = _state[source].find(function(p) { return String(p['${idField}']) === pid; });
          if (product && _actions[action]) _actions[action](product);
        });
      });
    }
  });
}`);
    }

    if (bc.type === 'cart-list') {
      const { image, title, subtitle, price, id, empty_text } = bc.config;
      const emptyMsg = empty_text || 'Empty';
      const idField = id || 'id';
      const imgPart = image
        ? `'<img class="neuron-cart-item__img" src="' + item['${image}'] + '" alt="' + (item['${title}'] || '') + '">'`
        : `''`;
      const titlePart = title
        ? `'<h4>' + item['${title}'] + '</h4>'`
        : `''`;
      const subtitlePart = subtitle
        ? `'<p>' + item['${subtitle}'] + '</p>'`
        : `''`;
      const pricePart = price
        ? `'<p class="neuron-cart-item__price">' + (typeof item['${price}'] === "number" ? item['${price}'].toLocaleString() : item['${price}']) + '</p>'`
        : `''`;

      parts.push(`function ${bc.rendererId}(items) {
  document.querySelectorAll('.neuron-cart-list').forEach(function(list) {
    var removeAction = list.getAttribute('data-remove-action');
    if (!items || items.length === 0) {
      list.innerHTML = '<div class="neuron-empty">${emptyMsg}</div>';
      return;
    }
    list.innerHTML = items.map(function(item) {
      var html = '<div class="neuron-cart-item">';
      html += ${imgPart};
      html += '<div class="neuron-cart-item__info">';
      html += ${titlePart};
      html += ${subtitlePart};
      html += '</div>';
      html += ${pricePart};
      if (removeAction) html += '<button class="neuron-btn neuron-btn--danger neuron-cart-item__remove" data-remove-id="' + item['${idField}'] + '">X</button>';
      html += '</div>';
      return html;
    }).join('');
    if (removeAction) {
      list.querySelectorAll('[data-remove-id]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var rid = this.getAttribute('data-remove-id');
          var item = items.find(function(i) { return String(i['${idField}']) === rid; });
          if (item && _actions[removeAction]) _actions[removeAction](item['${idField}']);
        });
      });
    }
  });
}`);
    }

    if (bc.type === 'cart-summary') {
      const { price, count_label, total_label } = bc.config;
      const countLbl = count_label || 'Items';
      const totalLbl = total_label || 'Total';

      // If price field is specified, compute sum. Otherwise show count only.
      const totalExpr = price
        ? `items.reduce(function(s, i) { return s + (Number(i['${price}']) || 0); }, 0).toLocaleString()`
        : `items.length`;

      parts.push(`function ${bc.rendererId}(items) {
  document.querySelectorAll('.neuron-cart-summary').forEach(function(el) {
    if (!items) items = [];
    var total = ${totalExpr};
    el.innerHTML = '<div class="neuron-cart-summary__content">' +
      '<div class="neuron-cart-summary__row"><span>${countLbl}</span><span>' + items.length + '</span></div>' +
      '<div class="neuron-cart-summary__total"><span>${totalLbl}</span><span>' + total + '</span></div>' +
    '</div>';
  });
}`);
    }

    if (bc.type === 'cart-icon') {
      parts.push(`function ${bc.rendererId}(items) {
  document.querySelectorAll('.neuron-cart-icon .badge').forEach(function(badge) {
    badge.textContent = items ? items.length : 0;
  });
}`);
    }
  }

  return parts.join('\n\n');
}

function generateInitBindings(ast: NeuronAST): string {
  const bound = collectBoundComponents(ast);
  const registrations = bound.map(bc =>
    `  _bindings['${bc.stateField}'].push(${bc.rendererId});`
  );
  return `function _initBindings() {\n${registrations.join('\n')}\n}`;
}

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
      counter++;
      walk(comp.children);
    }
  }

  for (const page of ast.pages) {
    walk(page.components);
  }
  return results;
}

function generateShowIfBindings(ast: NeuronAST): string {
  const components = collectShowIfComponents(ast);
  if (components.length === 0) return '';

  const lines: string[] = ['function _initShowIf() {'];
  for (const comp of components) {
    const condition = comp.negate
      ? `!val || (Array.isArray(val) && val.length === 0)`
      : `val && (!Array.isArray(val) || val.length > 0)`;
    const initCondition = comp.negate
      ? `!initVal || (Array.isArray(initVal) && initVal.length === 0)`
      : `initVal && (!Array.isArray(initVal) || initVal.length > 0)`;
    lines.push(`  (function() {`);
    lines.push(`    var el = document.getElementById('${comp.elementId}');`);
    lines.push(`    if (!el) return;`);
    lines.push(`    _bindings['${comp.stateField}'].push(function(val) {`);
    lines.push(`      el.style.display = ${condition} ? '' : 'none';`);
    lines.push(`    });`);
    lines.push(`    var initVal = _state['${comp.stateField}'];`);
    lines.push(`    el.style.display = ${initCondition} ? '' : 'none';`);
    lines.push(`  })();`);
  }
  lines.push('}');
  return lines.join('\n');
}

function generateInit(ast: NeuronAST): string {
  const hasShowIf = collectShowIfComponents(ast).length > 0;
  const showIfCall = hasShowIf ? '\n  _initShowIf();' : '';
  return `document.addEventListener('DOMContentLoaded', function() {
  _initBindings();${showIfCall}
  _initRouter();
  _autoLoad();
});`;
}
