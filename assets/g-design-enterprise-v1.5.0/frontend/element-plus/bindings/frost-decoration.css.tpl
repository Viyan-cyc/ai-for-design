/* Brand feature surface and optional decoration; independent from full frosted surfaces. */
:root {
  --frost-decor-blur: {{frost-decoration|--frost-decor-blur}};
  --frost-decor-fill-start: {{frost-decoration|--frost-decor-fill-start}};
  --frost-decor-fill-end: {{frost-decoration|--frost-decor-fill-end}};
  --frost-decor-border: {{frost-decoration|--frost-decor-border}};
  --frost-decor-ink: {{frost-decoration|--frost-decor-ink}};
  --frost-decor-brand-start: {{frost-decoration|--frost-decor-brand-start}};
  --frost-decor-brand-end: {{frost-decoration|--frost-decor-brand-end}};
  --frost-decor-brand-gradient: {{frost-decoration|--frost-decor-brand-gradient}};
  --frost-decor-shape-gradient: {{frost-decoration|--frost-decor-shape-gradient}};
  --frost-decor-scale-card: {{frost-decoration|--frost-decor-scale-card}};
  --frost-decor-scale-panel: {{frost-decoration|--frost-decor-scale-panel}};
  --frost-decor-circle-size: {{frost-decoration|--frost-decor-circle-size}};
  --frost-decor-circle-top: {{frost-decoration|--frost-decor-circle-top}};
  --frost-decor-circle-right: {{frost-decoration|--frost-decor-circle-right}};
  --frost-decor-tile-size: {{frost-decoration|--frost-decor-tile-size}};
  --frost-decor-tile-top: {{frost-decoration|--frost-decor-tile-top}};
  --frost-decor-tile-right: {{frost-decoration|--frost-decor-tile-right}};
  --frost-decor-tile-radius: {{frost-decoration|--frost-decor-tile-radius}};
  --frost-decor-tile-rotation: {{frost-decoration|--frost-decor-tile-rotation}};
}
[data-surface="brand"]:not([data-material="frosted"]) {
  background-color: var(--frost-decor-brand-start);
  background-image: var(--frost-decor-brand-gradient);
  color: var(--frost-decor-ink);
  border-color: transparent;
}
[data-decoration="frosted"] {
  --_frost-decor-scale: var(--frost-decor-scale-card);
  position: relative;
  overflow: hidden;
  isolation: isolate;
}
[data-decoration="frosted"][data-decoration-size="panel"] { --_frost-decor-scale: var(--frost-decor-scale-panel); }
[data-decoration="frosted"] > * { position: relative; z-index: 1; }
[data-decoration="frosted"]::before,
[data-decoration="frosted"]::after {
  content: "";
  position: absolute;
  pointer-events: none;
  z-index: 0;
  aspect-ratio: 1;
  box-sizing: border-box;
  border: var(--border-width-normal) solid var(--frost-decor-border);
  background-image: var(--frost-decor-shape-gradient);
  -webkit-backdrop-filter: blur(var(--frost-decor-blur));
  backdrop-filter: blur(var(--frost-decor-blur));
}
[data-decoration="frosted"]::before {
  width: min(calc(var(--frost-decor-circle-size) * var(--_frost-decor-scale)), 52%);
  top: calc(var(--frost-decor-circle-top) * var(--_frost-decor-scale));
  right: calc(var(--frost-decor-circle-right) * var(--_frost-decor-scale));
  border-radius: 50%;
}
[data-decoration="frosted"]::after {
  width: min(calc(var(--frost-decor-tile-size) * var(--_frost-decor-scale)), 32%);
  top: calc(var(--frost-decor-tile-top) * var(--_frost-decor-scale));
  right: calc(var(--frost-decor-tile-right) * var(--_frost-decor-scale));
  border-radius: var(--frost-decor-tile-radius);
  transform: rotate(var(--frost-decor-tile-rotation));
}
/* A small control or an already blurred surface never receives another blur layer. */
:is(button, a, input, select, textarea, th, td)[data-decoration="frosted"]::before,
:is(button, a, input, select, textarea, th, td)[data-decoration="frosted"]::after,
:is([data-material="frosted"], .g-frosted, .g-glass-surface, .g-glass-surface-soft, .g-glass-header)[data-decoration="frosted"]::before,
:is([data-material="frosted"], .g-frosted, .g-glass-surface, .g-glass-surface-soft, .g-glass-header)[data-decoration="frosted"]::after,
:is([data-material="frosted"], .g-frosted, .g-glass-surface, .g-glass-surface-soft, .g-glass-header) [data-decoration="frosted"]::before,
:is([data-material="frosted"], .g-frosted, .g-glass-surface, .g-glass-surface-soft, .g-glass-header) [data-decoration="frosted"]::after,
[data-decoration="frosted"] [data-decoration="frosted"]::before,
[data-decoration="frosted"] [data-decoration="frosted"]::after,
[data-decoration="frosted"][aria-disabled="true"]::before,
[data-decoration="frosted"][aria-disabled="true"]::after { display: none; }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  [data-decoration="frosted"]::before, [data-decoration="frosted"]::after { display: none; }
}
@media (prefers-reduced-transparency: reduce) {
  [data-decoration="frosted"]::before, [data-decoration="frosted"]::after { display: none; }
}
[data-transparency="reduced"] [data-decoration="frosted"]::before,
[data-transparency="reduced"] [data-decoration="frosted"]::after,
[data-decoration="frosted"][data-transparency="reduced"]::before,
[data-decoration="frosted"][data-transparency="reduced"]::after { display: none; }
@media (forced-colors: active) {
  [data-surface="brand"]:not([data-material="frosted"]) { background: Canvas; color: CanvasText; border-color: ButtonText; }
  [data-decoration="frosted"]::before, [data-decoration="frosted"]::after { display: none; }
}
