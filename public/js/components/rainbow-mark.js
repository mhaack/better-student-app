// Static rainbow-and-dino mark. The animated splash in index.html draws the
// same thing (it has to be plain markup to paint before JS); keep both in sync.
// Innermost first; colours are --rainbow-1…6 in tokens.css.
const RADII = [82, 95, 108, 121, 134, 147];

export function rainbowMark(className) {
  const arcs = RADII.map(
    (r, i) => `<path class="rainbow-arc rainbow-arc--${i + 1}" d="M${150 - r} 162a${r} ${r} 0 0 1 ${2 * r} 0"/>`
  ).join("");
  return `
    <svg class="${className}" viewBox="-5 0 310 170" aria-hidden="true">
      <defs><clipPath id="${className}-clip"><rect x="122" y="76" width="56" height="56" rx="14"/></clipPath></defs>
      ${arcs}
      <g class="rainbow-logo">
        <rect x="120" y="74" width="60" height="60" rx="16" fill="#fff"/>
        <image href="/icons/icon-192.png" x="122" y="76" width="56" height="56" clip-path="url(#${className}-clip)"/>
      </g>
    </svg>`;
}
