import { readFileSync } from 'fs';

export interface Theme {
  colors: Record<string, string>;
  font: { family: string; size: Record<string, number> };
  radius: number;
  shadow: string;
  spacing: Record<string, number>;
  transition: 'fade' | 'slide' | 'none';
}

export const DEFAULT_THEME: Theme = {
  colors: {
    primary: '#2E86AB',
    secondary: '#A23B72',
    danger: '#E84855',
    bg: '#FFFFFF',
    text: '#1A1A2E',
    border: '#E0E0E0',
  },
  font: {
    family: 'Inter',
    size: { sm: 14, md: 16, lg: 20, xl: 28 },
  },
  radius: 8,
  shadow: '0 2px 8px rgba(0,0,0,0.1)',
  spacing: { sm: 8, md: 16, lg: 24, xl: 48 },
  transition: 'none',
};

export function loadTheme(path: string | null): Theme {
  if (!path) return { ...DEFAULT_THEME };
  const raw = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(raw);
  return { ...DEFAULT_THEME, ...parsed, transition: parsed.transition || 'none' };
}

export function themeToCSS(theme: Theme): string {
  const lines: string[] = [':root {'];
  for (const [name, value] of Object.entries(theme.colors)) {
    lines.push(`  --color-${name}: ${value};`);
  }
  lines.push(`  --font-family: '${theme.font.family}', sans-serif;`);
  for (const [size, val] of Object.entries(theme.font.size)) {
    lines.push(`  --font-size-${size}: ${val}px;`);
  }
  lines.push(`  --radius: ${theme.radius}px;`);
  lines.push(`  --shadow: ${theme.shadow};`);
  for (const [name, val] of Object.entries(theme.spacing)) {
    lines.push(`  --spacing-${name}: ${val}px;`);
  }
  lines.push('}');
  return lines.join('\n');
}
