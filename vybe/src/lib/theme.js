export const FONTS = {
  serif: "'Fraunces', Georgia, serif",
  sans: "'Inter', system-ui, sans-serif",
  mono: "ui-monospace, Menlo, Consolas, monospace",
  rounded: "'Trebuchet MS', 'Segoe UI', sans-serif",
};
export const CARDS = ['flat', 'glass', 'outline'];
export const PALETTE = ['#722F37', '#C98289', '#FFF1DC', '#211719', '#302426', '#2f4a3d', '#3b4a7a', '#f5c27a'];

export function autoInk(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? '#302426' : '#FFF1DC';
}

// Presets (theme_id) take colors from the themes table; custom colors are stored as safe hex values.
export function resolveTheme(theme, themes = []) {
  const t = theme || {};
  const preset = t.theme_id ? themes.find((x) => x.id === t.theme_id) : null;
  const bg = t.bg || preset?.config?.bg || null;
  return {
    bg,
    ink: t.ink || preset?.config?.ink || (bg && bg.startsWith('#') ? autoInk(bg) : null),
    font: t.font || 'sans',
    card: t.card || 'flat',
  };
}
export function heroStyle(r) {
  const s = {};
  if (r.bg) s['--hero-bg'] = r.bg;
  if (r.ink) s['--hero-ink'] = r.ink;
  s['--hero-font'] = FONTS[r.font] || FONTS.sans;
  return s;
}
