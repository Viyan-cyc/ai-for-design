/* Legacy entry and aliases. Prefer data-material="frosted" for new surfaces. */
@import "./frosted.css";
@import "./frost-decoration.css";
:root, [data-theme="light"] {
  --visual-blue-1: {{glass-light|--visual-blue-1}};
  --visual-lavender-1: {{glass-light|--visual-lavender-1}};
  --visual-pink-1: {{glass-light|--visual-pink-1}};
  --visual-gradient-hero: {{glass-light|--visual-gradient-hero}};
  --visual-gradient-soft: {{glass-light|--visual-gradient-soft}};
  --glass-surface: {{glass-light|--glass-surface}};
  --glass-surface-soft: {{glass-light|--glass-surface-soft}};
  --glass-surface-strong: {{glass-light|--glass-surface-strong}};
  --glass-border: {{glass-light|--glass-border}};
  --glass-border-subtle: {{glass-light|--glass-border-subtle}};
  --glass-border-width: {{glass-light|--glass-border-width}};
  --glass-blur: {{glass-light|--glass-blur}};
  --glass-saturate: {{glass-light|--glass-saturate}};
  --glass-radius: {{glass-light|--glass-radius}};
  --glass-radius-lg: {{glass-light|--glass-radius-lg}};
  --glass-shadow: {{glass-light|--glass-shadow}};
  --glass-shadow-strong: {{glass-light|--glass-shadow-strong}};
}
[data-theme="dark"] {
  --visual-blue-1: {{glass-dark|--visual-blue-1}};
  --visual-lavender-1: {{glass-dark|--visual-lavender-1}};
  --visual-pink-1: {{glass-dark|--visual-pink-1}};
  --visual-gradient-hero: {{glass-dark|--visual-gradient-hero}};
  --visual-gradient-soft: {{glass-dark|--visual-gradient-soft}};
  --glass-surface: {{glass-dark|--glass-surface}};
  --glass-surface-soft: {{glass-dark|--glass-surface-soft}};
  --glass-surface-strong: {{glass-dark|--glass-surface-strong}};
  --glass-border: {{glass-dark|--glass-border}};
  --glass-border-subtle: {{glass-dark|--glass-border-subtle}};
  --glass-border-width: {{glass-dark|--glass-border-width}};
  --glass-blur: {{glass-dark|--glass-blur}};
  --glass-saturate: {{glass-dark|--glass-saturate}};
  --glass-radius: {{glass-dark|--glass-radius}};
  --glass-radius-lg: {{glass-dark|--glass-radius-lg}};
  --glass-shadow: {{glass-dark|--glass-shadow}};
  --glass-shadow-strong: {{glass-dark|--glass-shadow-strong}};
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
 :root, [data-theme="light"] {
  --glass-surface: {{glass-fallback-light|--glass-surface}};
  --glass-surface-soft: {{glass-fallback-light|--glass-surface-soft}};
  --glass-surface-strong: {{glass-fallback-light|--glass-surface-strong}};
 }
 [data-theme="dark"] {
  --glass-surface: {{glass-fallback-dark|--glass-surface}};
  --glass-surface-soft: {{glass-fallback-dark|--glass-surface-soft}};
  --glass-surface-strong: {{glass-fallback-dark|--glass-surface-strong}};
 }
}
@media (prefers-reduced-transparency: reduce) {
 :root, [data-theme="light"] {
  --glass-surface: {{glass-fallback-light|--glass-surface}};
  --glass-surface-soft: {{glass-fallback-light|--glass-surface-soft}};
  --glass-surface-strong: {{glass-fallback-light|--glass-surface-strong}};
 }
 [data-theme="dark"] {
  --glass-surface: {{glass-fallback-dark|--glass-surface}};
  --glass-surface-soft: {{glass-fallback-dark|--glass-surface-soft}};
  --glass-surface-strong: {{glass-fallback-dark|--glass-surface-strong}};
 }
}
