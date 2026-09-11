// ============================================================================
// Pie Chart — shared color palette
//
// Generates harmonious, distinguishable colors for pie chart slices.
// Slice 0 uses the theme accent (or fallback). Slices 1+ use golden-ratio
// distributed hues tuned for high visual contrast and theme harmony.
// ============================================================================

/** Default accent for charts when the theme doesn't provide one. */
export const DEFAULT_PIE_ACCENT = '#3b82f6' // blue-500

// ---------------------------------------------------------------------------
// HSL ↔ Hex conversion
// ---------------------------------------------------------------------------

export function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const ri = parseInt(h.substring(0, 2), 16) / 255
  const gi = parseInt(h.substring(2, 4), 16) / 255
  const bi = parseInt(h.substring(4, 6), 16) / 255

  const max = Math.max(ri, gi, bi)
  const min = Math.min(ri, gi, bi)
  const l = (max + min) / 2

  if (max === min) return [0, 0, l * 100]

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let hue: number
  if (max === ri) hue = ((gi - bi) / d + (gi < bi ? 6 : 0)) / 6
  else if (max === gi) hue = ((bi - ri) / d + 2) / 6
  else hue = ((ri - gi) / d + 4) / 6

  return [hue * 360, s * 100, l * 100]
}

export function hslToHex(h: number, s: number, l: number): string {
  const si = s / 100
  const li = l / 100

  const c = (1 - Math.abs(2 * li - 1)) * si
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = li - c / 2

  let r: number, g: number, b: number
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }

  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** Check whether a string is a valid 6-digit hex color (e.g. "#3b82f6"). */
export function isValidHex(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color)
}

/** Detect whether a background color is dark (lightness < 50%). */
export function isDarkBackground(bgHex: string): boolean {
  return hexToHsl(bgHex)[2] < 50
}

/**
 * Get the color for a pie chart slice by index.
 * Index 0 returns the theme accent color as-is.
 * Slices 1+ use golden ratio hue spacing (137.508°) starting from the accent hue.
 *
 * @param index - Slice index (0-based)
 * @param accentColor - Theme accent color
 * @param bgColor - Theme background color (to adjust lightness)
 */
export function getPieSliceColor(index: number, accentColor: string, bgColor?: string): string {
  if (index === 0 && isValidHex(accentColor)) {
    return accentColor
  }

  const safeAccent = isValidHex(accentColor) ? accentColor : DEFAULT_PIE_ACCENT
  const safeBg = bgColor && isValidHex(bgColor) ? bgColor : undefined
  const [baseHue, baseSat] = hexToHsl(safeAccent)

  if (index === 0) return safeAccent

  // Golden ratio angle in degrees gives maximum hue separation between consecutive slices
  const goldenAngle = 137.508
  const hue = ((baseHue + index * goldenAngle) % 360 + 360) % 360

  const isDark = safeBg ? isDarkBackground(safeBg) : false
  const sat = Math.max(55, Math.min(80, baseSat || 70))
  // Alternate lightness slightly to increase distinction between adjacent slices
  const lightOffset = ((index % 3) - 1) * 5
  const light = isDark
    ? Math.max(45, Math.min(75, 62 + lightOffset))
    : Math.max(35, Math.min(65, 48 + lightOffset))

  return hslToHex(hue, sat, light)
}
