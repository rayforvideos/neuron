// tests/errors.test.ts
import { describe, it, expect } from 'vitest';
import { NeuronError, formatError } from '../src/errors';

describe('formatError', () => {
  it('formats unknown component error', () => {
    const err = new NeuronError('unknown_component', 'buttton', { suggestions: ['button', 'form', 'text'] });
    const msg = formatError(err);
    expect(msg).toContain('[NEURON ERROR]');
    expect(msg).toContain('buttton');
    expect(msg).toContain('button');
  });

  it('formats undefined state error', () => {
    const err = new NeuronError('undefined_state', 'wishlist');
    const msg = formatError(err);
    expect(msg).toContain('wishlist');
    expect(msg).toContain('STATE');
  });

  it('formats undefined action error', () => {
    const err = new NeuronError('undefined_action', 'add-to-wishlist');
    const msg = formatError(err);
    expect(msg).toContain('add-to-wishlist');
    expect(msg).toContain('ACTION');
  });

  it('formats undefined api error', () => {
    const err = new NeuronError('undefined_api', 'wishlist');
    const msg = formatError(err);
    expect(msg).toContain('wishlist');
  });

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
});
