import type { Theme } from './theme';

export const PRESETS: Record<string, Theme> = {
  default: {
    colors: { primary: '#2E86AB', secondary: '#A23B72', danger: '#E84855', bg: '#FFFFFF', text: '#1A1A2E', border: '#E0E0E0' },
    font: { family: 'Inter', size: { sm: 14, md: 16, lg: 20, xl: 28 } },
    radius: 8, shadow: '0 2px 8px rgba(0,0,0,0.1)', spacing: { sm: 8, md: 16, lg: 24, xl: 48 }, transition: 'none',
  },
  dark: {
    colors: { primary: '#00D4AA', secondary: '#BB86FC', danger: '#CF6679', bg: '#121212', text: '#E0E0E0', border: '#333333' },
    font: { family: 'Inter', size: { sm: 14, md: 16, lg: 20, xl: 28 } },
    radius: 8, shadow: '0 2px 8px rgba(0,0,0,0.3)', spacing: { sm: 8, md: 16, lg: 24, xl: 48 }, transition: 'none',
  },
  minimal: {
    colors: { primary: '#000000', secondary: '#666666', danger: '#CC0000', bg: '#FFFFFF', text: '#000000', border: '#CCCCCC' },
    font: { family: 'Georgia', size: { sm: 14, md: 16, lg: 20, xl: 28 } },
    radius: 0, shadow: 'none', spacing: { sm: 8, md: 16, lg: 24, xl: 48 }, transition: 'none',
  },
  vibrant: {
    colors: { primary: '#FF6B6B', secondary: '#4ECDC4', danger: '#FF4757', bg: '#FAFAFA', text: '#2D3436', border: '#DFE6E9' },
    font: { family: 'Poppins', size: { sm: 14, md: 16, lg: 20, xl: 28 } },
    radius: 12, shadow: '0 4px 16px rgba(0,0,0,0.08)', spacing: { sm: 8, md: 16, lg: 24, xl: 48 }, transition: 'fade',
  },
};
