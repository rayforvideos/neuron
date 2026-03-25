import { describe, it, expect } from 'vitest';
import { loadTheme, themeToCSS, DEFAULT_THEME } from '../src/theme';
import { resolve } from 'path';

describe('loadTheme', () => {
  it('loads theme from JSON file', () => {
    const path = resolve(__dirname, 'fixtures/theme.json');
    const theme = loadTheme(path);
    expect(theme.colors.primary).toBe('#2E86AB');
    expect(theme.font.family).toBe('Inter');
    expect(theme.radius).toBe(8);
  });

  it('returns default theme when path is null', () => {
    const theme = loadTheme(null);
    expect(theme.colors.primary).toBeDefined();
    expect(theme.font.family).toBeDefined();
  });
});

describe('themeToCSS', () => {
  it('generates CSS custom properties', () => {
    const theme = loadTheme(null);
    const css = themeToCSS(theme);
    expect(css).toContain(':root');
    expect(css).toContain('--color-primary');
    expect(css).toContain('--font-family');
    expect(css).toContain('--radius');
    expect(css).toContain('--spacing-sm');
  });
});
