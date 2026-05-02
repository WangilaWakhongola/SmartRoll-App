// ============================================================
// SmartRoll — Theme Constants
// Centralised design tokens: colours, spacing, and typography.
// Import from here rather than hard-coding values in components.
// ============================================================

/** Application colour palette */
export const Colors = {
  bg: '#F0F4FF',
  surface: '#FFFFFF',
  surface2: '#E8EDF8',
  navy: '#1a237e',
  navy2: '#283593',
  green: '#1A6641',
  red: '#8B1A1A',
  amber: '#7A4A0B',
  text: '#1A1714',
  muted: '#6B6560',
  border: 'rgba(26,35,126,0.2)',
  border2: 'rgba(26,35,126,0.1)',
  white: '#FFFFFF',
  // Legacy aliases kept for backward compatibility
  darkGray: '#E8EDF8',
  lightGray: '#6B6560',
  textMuted: '#6B6560',
  blue: '#1a237e',
};

/** Spacing scale in pixels */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

/** Typography scale — font sizes and weights */
export const Typography = {
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    bold: '700' as const,
  },
};
