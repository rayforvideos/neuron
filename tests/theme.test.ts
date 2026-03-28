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

  it('loads theme from preset name', () => {
    const theme = loadTheme(null, 'dark');
    expect(theme.colors.bg).toBe('#121212');
    expect(theme.colors.primary).toBe('#00D4AA');
  });

  it('file takes priority over preset', () => {
    const path = resolve(__dirname, 'fixtures/theme.json');
    const theme = loadTheme(path, 'dark');
    expect(theme.colors.primary).toBe('#2E86AB');
  });

  it('falls back to default when preset name is unknown', () => {
    const theme = loadTheme(null, 'nonexistent');
    expect(theme.colors.primary).toBe('#2E86AB');
  });
});

describe('theme transition', () => {
  it('loads transition from theme file', () => {
    const theme = loadTheme(null);
    expect(theme.transition).toBe('none');
  });

  it('defaults to none when transition not specified', () => {
    const theme = loadTheme(null);
    expect(theme.transition).toBe('none');
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
