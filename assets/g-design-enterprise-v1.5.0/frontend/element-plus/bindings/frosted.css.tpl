/* G Design frosted material: declarations are generated from design/tokens.json. */
:root {
  --frost-blur-control: {{frost-common|--frost-blur-control}};
  --frost-blur-card: {{frost-common|--frost-blur-card}};
  --frost-blur-overlay: {{frost-common|--frost-blur-overlay}};
  --frost-saturate-neutral: {{frost-common|--frost-saturate-neutral}};
  --frost-saturate-muted: {{frost-common|--frost-saturate-muted}};
  --frost-border-width: {{frost-common|--frost-border-width}};
  --frost-alpha-hover-delta: {{frost-common|--frost-alpha-hover-delta}};
  --frost-alpha-active-delta: {{frost-common|--frost-alpha-active-delta}};
  --frost-transition-duration: {{frost-common|--frost-transition-duration}};
  --frost-transition-easing: {{frost-common|--frost-transition-easing}};
}
:root, [data-theme="light"] {
  --frost-neutral-rgb: {{frost-light|--frost-neutral-rgb}};
  --frost-alpha-control: {{frost-light|--frost-alpha-control}};
  --frost-surface-control: {{frost-light|--frost-surface-control}};
  --frost-shadow-control: {{frost-light|--frost-shadow-control}};
  --frost-alpha-card: {{frost-light|--frost-alpha-card}};
  --frost-surface-card: {{frost-light|--frost-surface-card}};
  --frost-shadow-card: {{frost-light|--frost-shadow-card}};
  --frost-alpha-overlay: {{frost-light|--frost-alpha-overlay}};
  --frost-surface-overlay: {{frost-light|--frost-surface-overlay}};
  --frost-shadow-overlay: {{frost-light|--frost-shadow-overlay}};
  --frost-tint-blue: {{frost-light|--frost-tint-blue}};
  --frost-tint-lavender: {{frost-light|--frost-tint-lavender}};
  --frost-tint-teal: {{frost-light|--frost-tint-teal}};
  --frost-border: {{frost-light|--frost-border}};
  --frost-backdrop-base: {{frost-light|--frost-backdrop-base}};
  --frost-backdrop-blue: {{frost-light|--frost-backdrop-blue}};
  --frost-backdrop-lavender: {{frost-light|--frost-backdrop-lavender}};
  --frost-backdrop-teal: {{frost-light|--frost-backdrop-teal}};
  --frost-backdrop-gradient: {{frost-light|--frost-backdrop-gradient}};
  --frost-surface-solid: {{frost-light|--frost-surface-solid}};
}
[data-theme="dark"] {
  --frost-neutral-rgb: {{frost-dark|--frost-neutral-rgb}};
  --frost-alpha-control: {{frost-dark|--frost-alpha-control}};
  --frost-surface-control: {{frost-dark|--frost-surface-control}};
  --frost-shadow-control: {{frost-dark|--frost-shadow-control}};
  --frost-alpha-card: {{frost-dark|--frost-alpha-card}};
  --frost-surface-card: {{frost-dark|--frost-surface-card}};
  --frost-shadow-card: {{frost-dark|--frost-shadow-card}};
  --frost-alpha-overlay: {{frost-dark|--frost-alpha-overlay}};
  --frost-surface-overlay: {{frost-dark|--frost-surface-overlay}};
  --frost-shadow-overlay: {{frost-dark|--frost-shadow-overlay}};
  --frost-tint-blue: {{frost-dark|--frost-tint-blue}};
  --frost-tint-lavender: {{frost-dark|--frost-tint-lavender}};
  --frost-tint-teal: {{frost-dark|--frost-tint-teal}};
  --frost-border: {{frost-dark|--frost-border}};
  --frost-backdrop-base: {{frost-dark|--frost-backdrop-base}};
  --frost-backdrop-blue: {{frost-dark|--frost-backdrop-blue}};
  --frost-backdrop-lavender: {{frost-dark|--frost-backdrop-lavender}};
  --frost-backdrop-teal: {{frost-dark|--frost-backdrop-teal}};
  --frost-backdrop-gradient: {{frost-dark|--frost-backdrop-gradient}};
  --frost-surface-solid: {{frost-dark|--frost-surface-solid}};
}

/* Apply backdrop color to a separate parent, never to the frosted surface itself. */
.g-frost-backdrop {
  background-color: var(--frost-backdrop-base);
  background-image: var(--frost-backdrop-gradient);
}
.g-frost-overview { padding: var(--space-16); border-radius: var(--radius-large); }
:is([data-material="frosted"], .g-frosted, .g-glass-surface, .g-glass-surface-soft, .g-glass-header) {
  --_frost-blur: var(--frost-blur-card);
  --_frost-alpha: var(--frost-alpha-card);
  --_frost-surface: var(--frost-surface-card);
  --_frost-shadow: var(--frost-shadow-card);
  --_frost-tint: transparent;
  --_frost-saturate: var(--frost-saturate-neutral);
  background-color: var(--_frost-surface);
  background-image: linear-gradient(var(--_frost-tint), var(--_frost-tint));
  border: var(--frost-border-width) solid var(--frost-border);
  box-shadow: var(--_frost-shadow);
  -webkit-backdrop-filter: blur(var(--_frost-blur)) saturate(var(--_frost-saturate));
  backdrop-filter: blur(var(--_frost-blur)) saturate(var(--_frost-saturate));
}
:is([data-material="frosted"], .g-frosted)[data-frost-level="control"], .g-glass-surface-soft {
  --_frost-blur: var(--frost-blur-control);
  --_frost-alpha: var(--frost-alpha-control);
  --_frost-surface: var(--frost-surface-control);
  --_frost-shadow: var(--frost-shadow-control);
}
:is([data-material="frosted"], .g-frosted)[data-frost-level="overlay"], .g-glass-header {
  --_frost-blur: var(--frost-blur-overlay);
  --_frost-alpha: var(--frost-alpha-overlay);
  --_frost-surface: var(--frost-surface-overlay);
  --_frost-shadow: var(--frost-shadow-overlay);
}
:is([data-material="frosted"], .g-frosted)[data-frost-tint="blue"] { --_frost-tint: var(--frost-tint-blue); }
:is([data-material="frosted"], .g-frosted)[data-frost-tint="lavender"] { --_frost-tint: var(--frost-tint-lavender); }
:is([data-material="frosted"], .g-frosted)[data-frost-tint="teal"] { --_frost-tint: var(--frost-tint-teal); }
:is([data-material="frosted"], .g-frosted)[data-frost-tone="muted"] { --_frost-saturate: var(--frost-saturate-muted); }
/* Radius belongs to the component. Keep radius only for the legacy surface utilities. */
.g-glass-surface, .g-glass-surface-soft { border-radius: var(--glass-radius); }
.g-glass-header { border-radius: var(--glass-radius-lg); }
:is([data-material="frosted"], .g-frosted):is(button, a, [role="button"], [data-frost-interactive="true"]) {
  transition: background-color var(--frost-transition-duration) var(--frost-transition-easing), box-shadow var(--frost-transition-duration) var(--frost-transition-easing);
}
:is([data-material="frosted"], .g-frosted):is(button, a, [role="button"], [data-frost-interactive="true"]):hover:not(:disabled):not([aria-disabled="true"]) {
  background-color: rgba(var(--frost-neutral-rgb), calc(var(--_frost-alpha) + var(--frost-alpha-hover-delta)));
}
:is([data-material="frosted"], .g-frosted):is(button, a, [role="button"], [data-frost-interactive="true"]):active:not(:disabled):not([aria-disabled="true"]) {
  background-color: rgba(var(--frost-neutral-rgb), calc(var(--_frost-alpha) + var(--frost-alpha-active-delta)));
  box-shadow: none;
}
:is([data-material="frosted"], .g-frosted):focus-visible {
  outline: var(--border-width-focus) solid var(--color-border-focus);
  outline-offset: var(--border-width-focus);
}
:is([data-material="frosted"], .g-frosted):is([aria-selected="true"], [aria-pressed="true"]) { border-color: var(--color-border-focus); }
:is([data-material="frosted"], .g-frosted):is(:disabled, [aria-disabled="true"]) {
  background-color: var(--color-fill-disabled);
  background-image: none;
  color: var(--color-text-disabled);
  border-color: var(--color-border-disabled);
  box-shadow: none;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
/* A nested surface may use fill but must not add a second background blur. */
:is([data-material="frosted"], .g-frosted, .g-glass-surface, .g-glass-surface-soft, .g-glass-header)
:is([data-material="frosted"], .g-frosted, .g-glass-surface, .g-glass-surface-soft, .g-glass-header) {
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :is([data-material="frosted"], .g-frosted, .g-glass-surface, .g-glass-surface-soft, .g-glass-header) {
    background-color: var(--frost-surface-solid) !important;
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
  }
}
@media (prefers-reduced-transparency: reduce) {
  :is([data-material="frosted"], .g-frosted, .g-glass-surface, .g-glass-surface-soft, .g-glass-header) {
    background-color: var(--frost-surface-solid) !important;
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
  }
}
/* Explicit product setting and performance fallback work even without media-query support. */
[data-transparency="reduced"] :is([data-material="frosted"], .g-frosted, .g-glass-surface, .g-glass-surface-soft, .g-glass-header),
:is([data-material="frosted"], .g-frosted, .g-glass-surface, .g-glass-surface-soft, .g-glass-header)[data-transparency="reduced"] {
  background-color: var(--frost-surface-solid) !important;
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
}
@media (prefers-reduced-motion: reduce) {
  :is([data-material="frosted"], .g-frosted) { transition: none !important; }
}
@media (forced-colors: active) {
  :is([data-material="frosted"], .g-frosted, .g-glass-surface, .g-glass-surface-soft, .g-glass-header) {
    background: Canvas !important;
    color: CanvasText;
    border-color: ButtonText;
    box-shadow: none;
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
  }
}
