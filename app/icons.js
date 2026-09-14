// Springo's icon set. No emoji anywhere: emoji render differently on every
// platform, sit at a different optical weight to the rest of the type, and read
// as clip art next to a real photograph of a plant.
//
// Two channels carry what one emoji used to:
//   SHAPE  says what kind of thing a square is. For plants the shapes are real
//          identification characters (three petals, a nodding bell, a hood), so
//          the glyph is doing botany rather than decoration.
//   COLOUR says which square it is, hashed from the item key, so a board of
//          twenty-four flowers still reads as twenty-four different things.
//
// All 24x24, stroked, 1.8 units, round caps. Colours are checked at 3:1 against
// both surfaces (WCAG non-text contrast).

const S = (name, body) => `<symbol id="ic-${name}" viewBox="0 0 24 24">${body}</symbol>`;

// five petals around a centre, the default flower
const petals = (n, rx = 2.9, ry = 4.3, cy = 7.1) => Array.from({ length: n }, (_, i) =>
  `<ellipse cx="12" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${(360 / n) * i} 12 12)"/>`).join('');

export const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
${S('bloom',   petals(5) + '<circle cx="12" cy="12" r="2.1"/>')}
${S('trio',    petals(3, 3.3, 4.8, 6.6) + '<circle cx="12" cy="12" r="1.7"/>')}
${S('bell',    '<path d="M11.7 6.8V4.6c0-1.4-1.1-2.2-2.5-2.4"/><path d="M11.7 6.8C7.8 7.6 5.5 11.8 5 16.9"/><path d="M11.7 6.8c3.9.8 6.2 5 6.7 10.1"/><path d="M5 16.9q2.15 2.7 4.3 0 q2.15 2.7 4.3 0 q2.2 2.7 4.4 0"/>')}
${S('spike',   '<path d="M12 21.5V5"/><path d="M12 7.2 8.6 5.4M12 7.2l3.4-1.8M12 11.2l-3.9-2M12 11.2l3.9-2M12 15.2l-4.2-2.2M12 15.2l4.2-2.2"/>')}
${S('hood',    '<path d="M6.6 20.5c0-8.2 2.3-13.4 6-13.4s6 5.2 6 13.4"/><path d="M12.6 10.6v7.3"/><path d="M12 7.1V3.2"/>')}
${S('cluster', '<circle cx="12" cy="6.4" r="2"/><circle cx="7.6" cy="9" r="2"/><circle cx="16.4" cy="9" r="2"/><circle cx="9.6" cy="12.8" r="2"/><circle cx="14.4" cy="12.8" r="2"/><path d="M12 15.2v6.3"/>')}
${S('leaf',    '<path d="M4.4 19.8c-.3-8.4 5.6-14.6 15.2-16-.7 9.6-6.9 15.3-15.2 16Z"/><path d="M4.4 19.8c3.5-3.6 7.2-6.8 11.4-9"/><path d="M4.4 19.8 2.6 21.6"/>')}
${S('fruit',   '<circle cx="12" cy="14.6" r="6.6"/><path d="M12 8V4.2"/><path d="M12.6 6.2c1.6-2.2 4.2-2.4 4.8-1.6-.5 1.9-2.8 2.7-4.8 1.6Z"/>')}
${S('tree',    '<path d="M12 2.4 6.2 10.8h3.2L5.4 16.6h13.2L14.6 10.8h3.2Z"/><path d="M12 16.6v4.4"/><path d="M9.2 21h5.6"/>')}
${S('fungus',  '<path d="M3.4 12.2a8.6 8.6 0 0 1 17.2 0Z"/><path d="M9.4 12.2v4.9a2.6 2.6 0 0 0 5.2 0v-4.9"/>')}
${S('bird',    '<ellipse cx="11.2" cy="13.8" rx="6.2" ry="4.8"/><circle cx="16" cy="8" r="3.1"/><path d="M18.8 6.9 22 7.6l-3 1.7"/><path d="M5.2 11.8 2 9.4"/><path d="M9.6 18.4v2.8M12.8 18.2v3"/><circle cx="16.9" cy="7.4" r=".85" stroke="none"/>')}
${S('creature','<ellipse cx="12" cy="13.6" rx="3.6" ry="6.4"/><path d="M12 7.2V20"/><path d="M10.6 6.6 8.4 3.4M13.4 6.6l2.2-3.2"/><path d="M8.4 10.4 4.6 8.6M8.4 14.2H4.2M8.6 17.8l-3.4 2M15.6 10.4l3.8-1.8M15.6 14.2h4.2M15.4 17.8l3.4 2"/>')}
${S('water',   '<path d="M2.6 8.4c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 5.6-1"/><path d="M2.6 13.4c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 5.6-1"/><path d="M2.6 18.4c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 5.6-1"/>')}
${S('stone',   '<path d="M3.4 14.6 6.8 6.2l8.4-2.4 5.4 6.6-3 9-10 .4Z"/>')}
${S('structure','<path d="M3.4 20.6V10L12 3.4 20.6 10v10.6Z"/><path d="M9.6 20.6v-6.2h4.8v6.2"/>')}
${S('vehicle', '<path d="M2.6 15.4h18.8v-3.2l-3.4-1-2.4-3.4H9.4L7 11.2l-4.4 1Z"/><circle cx="7.2" cy="17.4" r="2.2"/><circle cx="16.8" cy="17.4" r="2.2"/>')}
${S('sign',    '<path d="M5.6 2.8h8.8l4.6 4.6v13.8H5.6Z"/><path d="M14.4 2.8v4.6h4.6"/><path d="M8.8 12.6h6.6M8.8 16.4h4.6"/>')}
${S('person',  '<circle cx="12" cy="7.6" r="3.8"/><path d="M4.6 20.8a7.4 7.4 0 0 1 14.8 0"/>')}
${S('speech',  '<path d="M3.4 5.2h17.2v10.4h-9.4l-4.4 4v-4H3.4Z"/><path d="M7.6 10.4h8.8"/>')}
${S('reveal',  '<path d="M12 2.8a6.2 6.2 0 0 1 3.8 11.1v2.5H8.2v-2.5A6.2 6.2 0 0 1 12 2.8Z"/><path d="M9.6 19.4h4.8M10.4 21.8h3.2"/>')}
${S('time',    '<circle cx="12" cy="12" r="8.8"/><path d="M12 6.6V12l3.4 2.2"/>')}
${S('mark',    '<path d="M12 3.4 20.6 12 12 20.6 3.4 12Z"/>')}
${S('chevron', '<path d="M9 4.8 16.2 12 9 19.2"/>')}
${S('grid',    '<path d="M3.6 3.6h6.6v6.6H3.6ZM13.8 3.6h6.6v6.6h-6.6ZM3.6 13.8h6.6v6.6H3.6ZM13.8 13.8h6.6v6.6h-6.6Z"/>')}
${S('plus',    '<path d="M12 4.6v14.8M4.6 12h14.8"/>')}
${S('list',    '<path d="M4 6.6h16M4 12h16M4 17.4h10"/>')}
${S('sync',    '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20.4 3.6v5h-5"/>')}
${S('gear',    '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.6v2.8M12 18.6v2.8M4.3 7.6l2.4 1.4M17.3 15l2.4 1.4M4.3 16.4l2.4-1.4M17.3 9l2.4-1.4"/>')}
${S('star',    '<path d="M12 3.2 14.7 9l6.3.8-4.6 4.3 1.2 6.2L12 17.4l-5.6 2.9 1.2-6.2L3 9.8 9.3 9Z"/>')}
</defs></svg>`;

export const ICON_NAMES = [
  'bloom', 'trio', 'bell', 'spike', 'hood', 'cluster', 'leaf', 'fruit', 'tree', 'fungus',
  'bird', 'creature', 'water', 'stone', 'structure', 'vehicle', 'sign',
  'person', 'speech', 'reveal', 'time', 'mark',
  'chevron', 'grid', 'plus', 'list', 'sync', 'gear', 'star',
];
const VALID = new Set(ICON_NAMES);

export const ICON_COLOURS = ['rose', 'gold', 'moss', 'sky', 'iris', 'plum', 'ember', 'bark'];

/** Stable across devices and reloads, so a square keeps its colour forever. */
export function colourFor(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ICON_COLOURS[(h >>> 0) % ICON_COLOURS.length];
}

export function injectSprite() {
  if (document.getElementById('springo-sprite')) return;
  const holder = document.createElement('div');
  holder.id = 'springo-sprite';
  holder.innerHTML = SPRITE;
  document.body.prepend(holder);
}

/** An <svg> using the sprite. `key` picks the colour; omit it to inherit. */
export function icon(name, { key, cls = 'ic' } = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('class', cls);
  el.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#ic-' + (VALID.has(name) ? name : 'mark'));
  el.append(use);
  if (key) el.style.color = `var(--ic-${colourFor(key)})`;
  return el;
}
