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

  // 7. Auto-load
  lines.push(generateAutoLoad(ast));

  // 8. Runtime renderers for data-bound components
  const renderers = generateRuntimeRenderers(ast);
  if (renderers) lines.push(renderers);

  // 9. Init bindings
  lines.push(generateInitBindings(ast));

  // 10. DOMContentLoaded init
  lines.push(generateInit());

  return lines.join('\n\n');
}

function generateState(ast: NeuronAST): string {
  const fields = ast.states.flatMap(s => s.fields);
  const entries = fields.map(f => `  "${f.name}": ${f.defaultValue}`);
  return `const _state = {\n${entries.join(',\n')}\n};`;
}

function generateBindings(ast: NeuronAST): string {
  const fields = ast.states.flatMap(s => s.fields);
  const entries = fields.map(f => `  "${f.name}": []`);
  return `const _bindings = {\n${entries.join(',\n')}\n};`;
}

function generateSetState(): string {
  return `function _setState(key, val) {
  _state[key] = val;
  (_bindings[key] || []).forEach(fn => fn(val));
}`;
}

function generateRouter(ast: NeuronAST): string {
  const routeEntries = ast.pages.map(p => `  "${p.route}": "${p.name}"`);
  const routeMap = `const _routes = {\n${routeEntries.join(',\n')}\n};`;

  const navigate = `function _navigate(route) {
  history.pushState(null, '', route);
  _render(route);
}`;

  const render = `function _render(route) {
  const pageName = _routes[route];
  document.querySelectorAll('[data-page]').forEach(el => {
    el.style.display = el.getAttribute('data-page') === pageName ? '' : 'none';
  });
}`;

  const initRouter = `function _initRouter() {
  document.addEventListener('click', function(e) {
    const link = e.target.closest('[data-link]');
    if (link) {
      e.preventDefault();
      _navigate(link.getAttribute('data-link') || link.getAttribute('href'));
    }
    const actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      e.preventDefault();
      const name = actionEl.getAttribute('data-action');
      if (_actions[name]) _actions[name]();
    }
  });
  window.addEventListener('popstate', function() {
    _render(location.pathname);
  });
  _render(location.pathname);
}`;

  return [routeMap, navigate, render, initRouter].join('\n\n');
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

  return `function() {}`;
}

function generateFormHandling(): string {
  return `document.addEventListener('submit', function(e) {
  const form = e.target.closest('form[data-action]');
  if (form) {
    e.preventDefault();
    const name = form.getAttribute('data-action');
    const formData = Object.fromEntries(new FormData(form));
    if (_actions[name]) _actions[name](formData);
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

/** Recursively collect component types used across all pages */
function collectComponentTypes(ast: NeuronAST): Set<string> {
  const types = new Set<string>();
  function walk(components: ComponentNode[]) {
    for (const c of components) {
      types.add(c.componentType);
      walk(c.children);
    }
  }
  for (const page of ast.pages) {
    walk(page.components);
  }
  return types;
}

function generateRuntimeRenderers(ast: NeuronAST): string {
  const usedTypes = collectComponentTypes(ast);
  const parts: string[] = [];

  if (usedTypes.has('product-grid')) {
    parts.push(`function _renderProductGrid(items) {
  document.querySelectorAll('.neuron-product-grid').forEach(function(grid) {
    var cols = grid.getAttribute('data-cols') || '3';
    var action = grid.getAttribute('data-action');
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
    grid.innerHTML = items.map(function(p) {
      return '<article class="neuron-product-card">' +
        '<img class="neuron-product-card__img" src="' + p.image + '" alt="' + p.name + '">' +
        '<div class="neuron-product-card__body">' +
          '<p class="neuron-product-card__category">' + p.category + '</p>' +
          '<h3 class="neuron-product-card__name">' + p.name + '</h3>' +
          '<p class="neuron-product-card__price">' + p.price.toLocaleString('ko-KR') + '원</p>' +
          (action ? '<button class="neuron-btn neuron-btn--primary neuron-product-card__btn" data-product-id="' + p.id + '">담기</button>' : '') +
        '</div></article>';
    }).join('');
    if (action) {
      grid.querySelectorAll('[data-product-id]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var id = parseInt(this.getAttribute('data-product-id'));
          var source = grid.getAttribute('data-source');
          var product = _state[source].find(function(p) { return p.id === id; });
          if (product && _actions[action]) _actions[action](product);
        });
      });
    }
  });
}`);
  }

  if (usedTypes.has('cart-list')) {
    parts.push(`function _renderCartList(items) {
  document.querySelectorAll('.neuron-cart-list').forEach(function(list) {
    var removeAction = list.getAttribute('data-remove-action');
    if (items.length === 0) {
      list.innerHTML = '<div class="neuron-empty">장바구니가 비어있습니다</div>';
      return;
    }
    list.innerHTML = items.map(function(item) {
      return '<div class="neuron-cart-item">' +
        '<img class="neuron-cart-item__img" src="' + item.image + '" alt="' + item.name + '">' +
        '<div class="neuron-cart-item__info">' +
          '<h4>' + item.name + '</h4>' +
          '<p>' + item.category + '</p>' +
        '</div>' +
        '<p class="neuron-cart-item__price">' + item.price.toLocaleString('ko-KR') + '원</p>' +
        (removeAction ? '<button class="neuron-btn neuron-btn--danger neuron-cart-item__remove" data-remove-id="' + item.id + '">삭제</button>' : '') +
      '</div>';
    }).join('');
    if (removeAction) {
      list.querySelectorAll('[data-remove-id]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var id = parseInt(this.getAttribute('data-remove-id'));
          if (_actions[removeAction]) _actions[removeAction](id);
        });
      });
    }
  });
}`);
  }

  if (usedTypes.has('cart-summary')) {
    parts.push(`function _renderCartSummary(items) {
  document.querySelectorAll('.neuron-cart-summary').forEach(function(el) {
    var total = items.reduce(function(sum, item) { return sum + item.price; }, 0);
    el.innerHTML = '<div class="neuron-cart-summary__content">' +
      '<div class="neuron-cart-summary__row"><span>상품 수</span><span>' + items.length + '개</span></div>' +
      '<div class="neuron-cart-summary__total"><span>총 합계</span><span>' + total.toLocaleString('ko-KR') + '원</span></div>' +
    '</div>';
  });
}`);
  }

  if (usedTypes.has('cart-icon')) {
    parts.push(`function _renderCartIcon(items) {
  document.querySelectorAll('.neuron-cart-icon .badge').forEach(function(badge) {
    badge.textContent = items.length;
  });
}`);
  }

  return parts.join('\n\n');
}

function generateInitBindings(ast: NeuronAST): string {
  const registrations: string[] = [];
  const seen = new Set<string>();

  for (const page of ast.pages) {
    for (const comp of page.components) {
      if (comp.componentType === 'product-grid' && !seen.has('_renderProductGrid')) {
        const dataField = comp.properties.find(p => p.key === 'data')?.value || 'products';
        seen.add('_renderProductGrid');
        registrations.push(`  _bindings['${dataField}'].push(_renderProductGrid);`);
      }
      if (comp.componentType === 'cart-list' && !seen.has('_renderCartList')) {
        const stateField = comp.properties.find(p => p.key === 'state')?.value || 'cart';
        seen.add('_renderCartList');
        registrations.push(`  _bindings['${stateField}'].push(_renderCartList);`);
      }
      if (comp.componentType === 'cart-summary' && !seen.has('_renderCartSummary')) {
        const stateField = comp.properties.find(p => p.key === 'state')?.value || 'cart';
        seen.add('_renderCartSummary');
        registrations.push(`  _bindings['${stateField}'].push(_renderCartSummary);`);
      }
      if (comp.componentType === 'cart-icon' && !seen.has('_renderCartIcon')) {
        const stateField = comp.properties.find(p => p.key === 'state')?.value || 'cart';
        seen.add('_renderCartIcon');
        registrations.push(`  _bindings['${stateField}'].push(_renderCartIcon);`);
      }
    }
  }

  return `function _initBindings() {\n${registrations.join('\n')}\n}`;
}

function generateInit(): string {
  return `document.addEventListener('DOMContentLoaded', function() {
  _initBindings();
  _initRouter();
  _autoLoad();
});`;
}
