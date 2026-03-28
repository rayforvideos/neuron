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

  it('includes product card styles', () => {
    const css = generateCSS(DEFAULT_THEME);
    expect(css).toContain('.neuron-product-card');
    expect(css).toContain('.neuron-product-card__img');
    expect(css).toContain('.neuron-product-card__body');
    expect(css).toContain('.neuron-product-card__name');
    expect(css).toContain('.neuron-product-card__price');
    expect(css).toContain('.neuron-product-card__category');
  });

  it('includes cart item styles', () => {
    const css = generateCSS(DEFAULT_THEME);
    expect(css).toContain('.neuron-cart-item');
    expect(css).toContain('.neuron-cart-item__img');
    expect(css).toContain('.neuron-cart-item__info');
    expect(css).toContain('.neuron-cart-item__price');
    expect(css).toContain('.neuron-cart-item__remove');
  });

  it('includes cart summary content styles', () => {
    const css = generateCSS(DEFAULT_THEME);
    expect(css).toContain('.neuron-cart-summary__content');
    expect(css).toContain('.neuron-cart-summary__row');
    expect(css).toContain('.neuron-cart-summary__total');
  });

  it('includes empty state style', () => {
    const css = generateCSS(DEFAULT_THEME);
    expect(css).toContain('.neuron-empty');
  });

  it('includes form validation styles', () => {
    const css = generateCSS(DEFAULT_THEME);
    expect(css).toContain('input:invalid');
    expect(css).toContain('border-color');
  });

  it('generates fade transition CSS when theme.transition is fade', () => {
    const fadeTheme = { ...DEFAULT_THEME, transition: 'fade' as const };
    const css = generateCSS(fadeTheme);
    expect(css).toContain('neuron-page-active');
    expect(css).toContain('opacity');
  });

  it('generates slide transition CSS when theme.transition is slide', () => {
    const slideTheme = { ...DEFAULT_THEME, transition: 'slide' as const };
    const css = generateCSS(slideTheme);
    expect(css).toContain('neuron-page-active');
    expect(css).toContain('translateX');
  });

  it('does not generate transition CSS when theme.transition is none', () => {
    const noneTheme = { ...DEFAULT_THEME, transition: 'none' as const };
    const css = generateCSS(noneTheme);
    expect(css).not.toContain('neuron-page-active');
  });
});
