import { describe, it, expect } from 'vitest';
import { generateCSS } from '../../src/generator/css';
import { DEFAULT_THEME } from '../../src/theme';

describe('generateCSS', () => {
  it('generates base styles with theme variables', () => {
    const css = generateCSS(DEFAULT_THEME);
    expect(css).toContain(':root');
    expect(css).toContain('--color-primary');
    expect(css).toContain('.neuron-header');
    expect(css).toContain('.neuron-hero');
    expect(css).toContain('.neuron-btn');
    expect(css).toContain('.neuron-btn--primary');
    expect(css).toContain('.neuron-form');
    expect(css).toContain('.neuron-product-grid');
    expect(css).toContain('.neuron-cart-list');
    expect(css).toContain('.neuron-footer');
    expect(css).toContain('box-sizing: border-box');
  });
});
