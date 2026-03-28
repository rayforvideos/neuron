import { describe, it, expect } from 'vitest';
import { PRESETS } from '../src/theme-presets';

describe('theme presets', () => {
  it('has 4 presets: default, dark, minimal, vibrant', () => {
    expect(Object.keys(PRESETS)).toEqual(['default', 'dark', 'minimal', 'vibrant']);
  });

  it('each preset has required theme fields', () => {
    for (const [name, theme] of Object.entries(PRESETS)) {
      expect(theme.colors.primary, `${name}.colors.primary`).toBeDefined();
      expect(theme.colors.bg, `${name}.colors.bg`).toBeDefined();
      expect(theme.colors.text, `${name}.colors.text`).toBeDefined();
      expect(theme.font.family, `${name}.font.family`).toBeDefined();
      expect(typeof theme.radius, `${name}.radius`).toBe('number');
      expect(theme.transition, `${name}.transition`).toBeDefined();
    }
  });

  it('dark preset has dark background', () => {
    expect(PRESETS.dark.colors.bg).toBe('#121212');
  });

  it('minimal preset has zero radius', () => {
    expect(PRESETS.minimal.radius).toBe(0);
  });
});
