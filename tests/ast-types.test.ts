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
