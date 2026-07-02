// TypeScript-side mirrors of the CSS design tokens in app/globals.css — for
// the few places that cannot read CSS custom properties (web manifest,
// viewport themeColor, generated icons). app/globals.css remains canonical:
// if a token changes there, update it here too (see docs/design-system.md).
export const TOKEN_COLOR_BG = "#fafaf8"; // --color-bg
export const TOKEN_COLOR_PRIMARY = "#12695e"; // --color-primary
