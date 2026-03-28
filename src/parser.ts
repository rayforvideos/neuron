import { tokenize, Token } from './lexer';
import {
  NeuronAST,
  StateNode,
  ActionNode,
  ApiNode,
  PageNode,
  ComponentNode,
  ComponentProperty,
} from './ast';
import { NeuronError } from './errors';

export function parse(source: string): NeuronAST {
  const tokens = tokenize(source);
  const ast: NeuronAST = {
    states: [],
    actions: [],
    apis: [],
    pages: [],
  };

  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === 'SEPARATOR') {
      i++;
      continue;
    }

    if (token.type === 'KEYWORD') {
      switch (token.value) {
        case 'STATE': {
          const [node, next] = parseState(tokens, i);
          ast.states.push(node);
          i = next;
          break;
        }
        case 'ACTION': {
          const [node, next] = parseAction(tokens, i);
          ast.actions.push(node);
          i = next;
          break;
        }
        case 'API': {
          const [node, next] = parseApi(tokens, i);
          ast.apis.push(node);
          i = next;
          break;
        }
        case 'PAGE': {
          const [node, next] = parsePage(tokens, i);
          ast.pages.push(node);
          i = next;
          break;
        }
      }
    } else {
      i++;
    }
  }

  return ast;
}

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

function parseAction(tokens: Token[], start: number): [ActionNode, number] {
  const keyword = tokens[start] as Extract<Token, { type: 'KEYWORD'; value: 'ACTION' }>;
  const baseIndent = keyword.indent;
  const node: ActionNode = { type: 'ACTION', name: keyword.name, steps: [] };
  let i = start + 1;

  while (i < tokens.length) {
    const t = tokens[i];
    if (t.type === 'KEYWORD' || t.type === 'SEPARATOR' || t.indent <= baseIndent) break;
    if (t.type === 'PROPERTY') {
      node.steps.push({ key: t.key, value: t.value });
    }
    i++;
  }

  return [node, i];
}

function parseApi(tokens: Token[], start: number): [ApiNode, number] {
  const keyword = tokens[start] as Extract<Token, { type: 'KEYWORD'; value: 'API' }>;
  const baseIndent = keyword.indent;
  const node: ApiNode = { type: 'API', name: keyword.name, method: '', endpoint: '', options: {} };
  let i = start + 1;

  while (i < tokens.length) {
    const t = tokens[i];
    if (t.type === 'KEYWORD' || t.type === 'SEPARATOR' || t.indent <= baseIndent) break;
    if (t.type === 'HTTP_METHOD') {
      node.method = t.method;
      node.endpoint = t.endpoint;
    } else if (t.type === 'PROPERTY') {
      node.options[t.key] = t.value;
    }
    i++;
  }

  return [node, i];
}

function parsePage(tokens: Token[], start: number): [PageNode, number] {
  const keyword = tokens[start] as Extract<Token, { type: 'KEYWORD'; value: 'PAGE' }>;
  const baseIndent = keyword.indent;
  const node: PageNode = {
    type: 'PAGE',
    name: keyword.name,
    title: keyword.title,
    route: keyword.route,
    params: [],
    components: [],
  };

  // Extract dynamic route params
  const paramMatches = keyword.route.matchAll(/:(\w+)/g);
  for (const match of paramMatches) {
    node.params.push(match[1]);
  }

  // Validate route params - detect empty param names like /product/:
  if (keyword.route.includes('/:') && node.params.length === 0) {
    throw new NeuronError('invalid_route_param', keyword.route, {});
  }
  // Also check for /:/ or /:$ patterns (trailing colon without name)
  if (/:(?:\/|$)/.test(keyword.route)) {
    throw new NeuronError('invalid_route_param', keyword.route, {});
  }

  let i = start + 1;

  while (i < tokens.length) {
    const t = tokens[i];
    if (t.type === 'KEYWORD' || t.type === 'SEPARATOR' || t.indent <= baseIndent) break;
    if (t.type === 'COMPONENT') {
      const [comp, next] = parseComponent(tokens, i);
      node.components.push(comp);
      i = next;
    } else {
      i++;
    }
  }

  return [node, i];
}

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
        if (!/^!?\w+$/.test(raw)) {
          throw new NeuronError('invalid_show_if', raw, {});
        }
        if (raw.startsWith('!')) {
          node.showIf = { field: raw.slice(1).trim(), negate: true };
        } else {
          node.showIf = { field: raw, negate: false };
        }
        i++;
      } else if (cur.key.startsWith('field_') && node.componentType === 'form') {
        const prop: ComponentProperty = { key: cur.key, value: cur.value };
        const fieldIndent = cur.indent;
        i++;
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
            const validTypes = ['text', 'email', 'password', 'number', 'tel', 'url'];
            if (!validTypes.includes(sub.value)) {
              throw new NeuronError('invalid_form_field_type', sub.value, {});
            }
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
