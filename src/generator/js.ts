// src/generator/js.ts

import type { NeuronAST, ActionNode, ApiNode } from '../ast';

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

  // 8. DOMContentLoaded init
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

function generateInit(): string {
  return `document.addEventListener('DOMContentLoaded', function() {
  _initRouter();
  _autoLoad();
});`;
}
