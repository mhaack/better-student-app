// Static rainbow-and-dino mark. The animated splash in index.html draws the
// same thing (it has to be plain markup to paint before JS); keep both in sync.
const ARCS = [
  [82, "#CDB8F0"],
  [95, "#A9D3F0"],
  [108, "#BFE3B4"],
  [121, "#F7E39C"],
  [134, "#F9CBA7"],
  [147, "#F4B6C2"],
];

export function rainbowMark(className) {
  const arcs = ARCS.map(
    ([r, color]) => `<path class="rainbow-arc" style="stroke:${color}" d="M${150 - r} 162a${r} ${r} 0 0 1 ${2 * r} 0"/>`
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
