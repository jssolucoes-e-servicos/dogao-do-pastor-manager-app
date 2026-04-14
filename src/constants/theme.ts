import { Platform } from 'react-native';

export const brand = '#ea580c';
export const brandLight = '#fff7ed';
export const brandDark = '#9a3412';

export const palette = {
  light: {
    // Backgrounds
    bg: '#f9fafb',
    bgCard: '#ffffff',
    bgInput: '#ffffff',
    bgMuted: '#f3f4f6',
    bgBrand: brandLight,

    // Text
    text: '#1f2937',
    textSub: '#6b7280',
    textMuted: '#9ca3af',
    textInverse: '#ffffff',
    textBrand: brand,

    // Borders
    border: '#e5e7eb',
    borderBrand: brand,

    // Header
    headerBg: brand,
    headerText: '#ffffff',
    headerSub: '#fed7aa',

    // Status
    success: '#16a34a',
    successBg: '#f0fdf4',
    warning: '#d97706',
    warningBg: '#fffbeb',
    error: '#dc2626',
    errorBg: '#fef2f2',
    info: '#2563eb',
    infoBg: '#eff6ff',

    // Drawer
    drawerBg: '#ffffff',
    drawerActive: brandLight,
    drawerActiveBorder: brand,

    // Misc
    shadow: '#000000',
    overlay: 'rgba(0,0,0,0.5)',
    separator: '#f3f4f6',
  },
  dark: {
    // Backgrounds
    bg: '#0f172a',
    bgCard: '#1e293b',
    bgInput: '#1e293b',
    bgMuted: '#334155',
    bgBrand: '#431407',

    // Text
    text: '#f1f5f9',
    textSub: '#94a3b8',
    textMuted: '#64748b',
    textInverse: '#ffffff',
    textBrand: '#fb923c',

    // Borders
    border: '#334155',
    borderBrand: '#fb923c',

    // Header
    headerBg: '#7c2d12',
    headerText: '#ffffff',
    headerSub: '#fdba74',

    // Status
    success: '#22c55e',
    successBg: '#052e16',
    warning: '#f59e0b',
    warningBg: '#1c1400',
    error: '#f87171',
    errorBg: '#1f0000',
    info: '#60a5fa',
    infoBg: '#0c1a3a',

    // Drawer
    drawerBg: '#1e293b',
    drawerActive: '#431407',
    drawerActiveBorder: '#fb923c',

    // Misc
    shadow: '#000000',
    overlay: 'rgba(0,0,0,0.7)',
    separator: '#1e293b',
  },
} as const;

export type ThemeColors = typeof palette.light;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', mono: 'ui-monospace' },
  default: { sans: 'normal', mono: 'monospace' },
  web: { sans: "system-ui, -apple-system, sans-serif", mono: "monospace" },
});

// Legacy compat
export const Colors = {
  light: { text: palette.light.text, background: palette.light.bg, tint: brand, icon: palette.light.textSub, tabIconDefault: palette.light.textSub, tabIconSelected: brand },
  dark:  { text: palette.dark.text,  background: palette.dark.bg,  tint: '#fb923c', icon: palette.dark.textSub, tabIconDefault: palette.dark.textSub, tabIconSelected: '#fb923c' },
};
