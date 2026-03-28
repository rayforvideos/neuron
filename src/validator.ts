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
      for (const prop of comp.properties) {
        if ((prop.key === 'data' || prop.key === 'state') && !stateNames.has(prop.value) && !INTERNAL_STATES.has(prop.value)) {
          errors.push(formatError(new NeuronError('undefined_state', prop.value, {})));
        }
        if ((prop.key === 'on_click' || prop.key === 'on_remove') && !actionNames.has(prop.value)) {
          errors.push(formatError(new NeuronError('undefined_action', prop.value, {})));
        }
      }

      if (comp.showIf && !stateNames.has(comp.showIf.field) && !INTERNAL_STATES.has(comp.showIf.field)) {
        errors.push(formatError(new NeuronError('undefined_state', comp.showIf.field, {})));
      }

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
