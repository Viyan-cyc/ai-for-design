/* H Design 色彩.docx 映射。原文与使用规则：source/h-design-color-spec.md、source/h-design-color-mappings.md。 */
/* 严格采用 Word 图20代码语义表 HEX；与通用 UI 色板不同的专用值单独保存。 */
:root,
[data-theme="light"] {
  --color-code-background: {{code-light|--color-code-background}};
  --color-code-foreground: {{code-light|--color-code-foreground}};
  --color-code-comment: {{code-light|--color-code-comment}};
  --color-code-quote: {{code-light|--color-code-quote}};
  --color-code-bullet: {{code-light|--color-code-bullet}};
  --color-code-javadoc: {{code-light|--color-code-javadoc}};
  --color-code-doctag: {{code-light|--color-code-doctag}};
  --color-code-link: {{code-light|--color-code-link}};
  --color-code-keyword: {{code-light|--color-code-keyword}};
  --color-code-punctuation: {{code-light|--color-code-punctuation}};
  --color-code-operator: {{code-light|--color-code-operator}};
  --color-code-section: {{code-light|--color-code-section}};
  --color-code-meta: {{code-light|--color-code-meta}};
  --color-code-type: {{code-light|--color-code-type}};
  --color-code-title: {{code-light|--color-code-title}};
  --color-code-class: {{code-light|--color-code-class}};
  --color-code-name: {{code-light|--color-code-name}};
  --color-code-function: {{code-light|--color-code-function}};
  --color-code-params: {{code-light|--color-code-params}};
  --color-code-built-in: {{code-light|--color-code-built-in}};
  --color-code-attr: {{code-light|--color-code-attr}};
  --color-code-value: {{code-light|--color-code-value}};
  --color-code-property: {{code-light|--color-code-property}};
  --color-code-variable: {{code-light|--color-code-variable}};
  --color-code-string: {{code-light|--color-code-string}};
  --color-code-literal: {{code-light|--color-code-literal}};
  --color-code-number: {{code-light|--color-code-number}};
  --color-code-regexp: {{code-light|--color-code-regexp}};
  --color-code-boolean: {{code-light|--color-code-boolean}};
  --color-code-symbol: {{code-light|--color-code-symbol}};
  --color-code-template-variable: {{code-light|--color-code-template-variable}};
  --color-code-subst: {{code-light|--color-code-subst}};
  --color-code-tag: {{code-light|--color-code-tag}};
  --color-code-selector-tag: {{code-light|--color-code-selector-tag}};
  --color-code-selector-class: {{code-light|--color-code-selector-class}};
  --color-code-selector-id: {{code-light|--color-code-selector-id}};
  --color-code-error: {{code-light|--color-code-error}};
}
[data-theme="dark"] {
  --color-code-background: {{code-dark|--color-code-background}};
  --color-code-foreground: {{code-dark|--color-code-foreground}};
  --color-code-comment: {{code-dark|--color-code-comment}};
  --color-code-quote: {{code-dark|--color-code-quote}};
  --color-code-bullet: {{code-dark|--color-code-bullet}};
  --color-code-javadoc: {{code-dark|--color-code-javadoc}};
  --color-code-doctag: {{code-dark|--color-code-doctag}};
  --color-code-link: {{code-dark|--color-code-link}};
  --color-code-keyword: {{code-dark|--color-code-keyword}};
  --color-code-punctuation: {{code-dark|--color-code-punctuation}};
  --color-code-operator: {{code-dark|--color-code-operator}};
  --color-code-section: {{code-dark|--color-code-section}};
  --color-code-meta: {{code-dark|--color-code-meta}};
  --color-code-type: {{code-dark|--color-code-type}};
  --color-code-title: {{code-dark|--color-code-title}};
  --color-code-class: {{code-dark|--color-code-class}};
  --color-code-name: {{code-dark|--color-code-name}};
  --color-code-function: {{code-dark|--color-code-function}};
  --color-code-params: {{code-dark|--color-code-params}};
  --color-code-built-in: {{code-dark|--color-code-built-in}};
  --color-code-attr: {{code-dark|--color-code-attr}};
  --color-code-value: {{code-dark|--color-code-value}};
  --color-code-property: {{code-dark|--color-code-property}};
  --color-code-variable: {{code-dark|--color-code-variable}};
  --color-code-string: {{code-dark|--color-code-string}};
  --color-code-literal: {{code-dark|--color-code-literal}};
  --color-code-number: {{code-dark|--color-code-number}};
  --color-code-regexp: {{code-dark|--color-code-regexp}};
  --color-code-boolean: {{code-dark|--color-code-boolean}};
  --color-code-symbol: {{code-dark|--color-code-symbol}};
  --color-code-template-variable: {{code-dark|--color-code-template-variable}};
  --color-code-subst: {{code-dark|--color-code-subst}};
  --color-code-tag: {{code-dark|--color-code-tag}};
  --color-code-selector-tag: {{code-dark|--color-code-selector-tag}};
  --color-code-selector-class: {{code-dark|--color-code-selector-class}};
  --color-code-selector-id: {{code-dark|--color-code-selector-id}};
  --color-code-error: {{code-dark|--color-code-error}};
}

/* 可选的 Highlight.js 样式：只对 .h-design-code 容器内生效。 */
.h-design-code .hljs {
  background: var(--color-code-background);
  color: var(--color-code-foreground);
}
.h-design-code .hljs-comment {
  color: var(--color-code-comment);
}
.h-design-code .hljs-quote {
  color: var(--color-code-quote);
}
.h-design-code .hljs-bullet {
  color: var(--color-code-bullet);
}
.h-design-code .hljs-javadoc {
  color: var(--color-code-javadoc);
}
.h-design-code .hljs-doctag {
  color: var(--color-code-doctag);
}
.h-design-code .hljs-link {
  color: var(--color-code-link);
}
.h-design-code .hljs-keyword {
  color: var(--color-code-keyword);
}
.h-design-code .hljs-punctuation {
  color: var(--color-code-punctuation);
}
.h-design-code .hljs-operator {
  color: var(--color-code-operator);
}
.h-design-code .hljs-section {
  color: var(--color-code-section);
}
.h-design-code .hljs-meta {
  color: var(--color-code-meta);
}
.h-design-code .hljs-type {
  color: var(--color-code-type);
}
.h-design-code .hljs-title {
  color: var(--color-code-title);
}
.h-design-code .hljs-class {
  color: var(--color-code-class);
}
.h-design-code .hljs-name {
  color: var(--color-code-name);
}
.h-design-code .hljs-function {
  color: var(--color-code-function);
}
.h-design-code .hljs-params {
  color: var(--color-code-params);
}
.h-design-code .hljs-built_in {
  color: var(--color-code-built-in);
}
.h-design-code .hljs-attr {
  color: var(--color-code-attr);
}
.h-design-code .hljs-value {
  color: var(--color-code-value);
}
.h-design-code .hljs-property {
  color: var(--color-code-property);
}
.h-design-code .hljs-variable {
  color: var(--color-code-variable);
}
.h-design-code .hljs-string {
  color: var(--color-code-string);
}
.h-design-code .hljs-literal {
  color: var(--color-code-literal);
}
.h-design-code .hljs-number {
  color: var(--color-code-number);
}
.h-design-code .hljs-regexp {
  color: var(--color-code-regexp);
}
.h-design-code .hljs-boolean {
  color: var(--color-code-boolean);
}
.h-design-code .hljs-symbol {
  color: var(--color-code-symbol);
}
.h-design-code .hljs-template-variable {
  color: var(--color-code-template-variable);
}
.h-design-code .hljs-subst {
  color: var(--color-code-subst);
}
.h-design-code .hljs-tag {
  color: var(--color-code-tag);
}
.h-design-code .hljs-selector-tag {
  color: var(--color-code-selector-tag);
}
.h-design-code .hljs-selector-class {
  color: var(--color-code-selector-class);
}
.h-design-code .hljs-selector-id {
  color: var(--color-code-selector-id);
}
.h-design-code .hljs-error {
  color: var(--color-code-error);
}
