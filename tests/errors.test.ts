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
});
