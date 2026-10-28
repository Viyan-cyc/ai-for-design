# Cleanup Report

**Date**: 2026-10-28

## Files Deleted (from skill package)

No files were deleted from the skill package. The existing package structure was already clean — all files have verified references or purposes.

## Files Retained

### Root
| File | Reason |
|------|--------|
| SKILL.md | Skill definition; name=gts-sweetui-coder as specified |

### references/
| File | Reason |
|------|--------|
| env-config.json | setup-env.mjs reads manifestUrl, fallbackManifestUrl, envDirName |
| fallback-node-manifest.json | setup-env.mjs reads platform configs when offline |
| on-demand-toggle.md | Referenced by SKILL.md "按需读取" table |
| runtime-setup.md | Referenced by SKILL.md "维护" section |
| token-catalog.md | Referenced by SKILL.md "选 token" row |

### scripts/
| File | Reason |
|------|--------|
| build-data.mjs | build.mjs dependency |
| build.mjs | Required by SKILL.md "编写" step 4 |
| check-runtime.mjs | Required by runtime-setup.md verification flow |
| cleanup-starter.mjs | Required by SKILL.md "编写" step 4 |
| ensure-env.mjs | Required by SKILL.md "准备环境" step 1 |
| gen-tokens.mjs | Required by runtime-setup.md "首次准备" |
| gen-whitelists.mjs | Required by runtime-setup.md "首次准备" |
| init.mjs | Required by SKILL.md "初始化" step 2 |
| prepare-runtime.mjs | Required by runtime-setup.md "首次准备" |
| setup-env.mjs | Required by runtime-setup.md "首次准备" |
| source-tools.mjs | Shared dependency of build.mjs, gen-whitelists.mjs, gen-tokens.mjs |
| verify-build.mjs | Required by runtime-setup.md verification flow |
| install/install.ps1 | Referenced by SKILL.md "HINT" |
| install/install.sh | Same for non-Windows |

### scripts/preview/
| File | Reason |
|------|--------|
| index.gts.html | Preview template; copied to output on build |
| public/library/ (7 files) | Runtime dependencies for browser preview |
| src/main.js | Shared Vue entry point |
| src/runtime.js | Shared wiring (app.use + theme + i18n) |
| src/theme.js | Theme adapter with selector mapping + backgroundColor fix |
| src/i18n/index.js | i18n adapter wrapping native APIs |
| src/assets/base.css | Minimal app layout, no component overrides |
| src/api/demo.js | Starter API stub |
| src/api/mock/demo-data.js | Starter mock data |
| src/README.md | Source接入说明 for init-generated projects |

### scripts/verify/
| File | Reason |
|------|--------|
| compiler/package.json, package-lock.json | verify-build.mjs installs vue3-sfc-loader for SFC compilation checks |
| whitelists/sweetui-exports.json | Build-time import validation |
| whitelists/sweetui-icons.json | Build-time icon-class validation |
| whitelists/sweetui-tokens.json | Build-time CSS variable validation |

### vendor/
| Directory | Reason |
|-----------|--------|
| code-example/ | Referenced by SKILL.md "布局与组合" row |
| vue-skill/ | Referenced by SKILL.md "选组件", "布局", "报错" rows; component docs used by code generation |

## Duplicate CSS/Font Analysis

| Issue | Finding |
|-------|---------|
| Duplicate CSS | No duplicates. Single source: `dist/sweet-ui-base.css` loaded once via `<link>` in preview, once via `import` in main.js |
| Inline fonts | Yes — `dist/sweet-ui-base.css` contains `@font-face` with base64 data URI for sweetui icon font. No separate font files exist. No duplicate loading. |
| Theme layer duplication | No. Single official stylesheet; no generated or rebuilt theme CSS. theme.js only manipulates `body[theme]` attribute and inline `backgroundColor`. |

## Files NOT in Skill (Intentionally)

These are in output/ directories, not in the skill package:
- acceptance project (output/sweetui-acceptance/)
- Vite validation project (output/sweetui-vue-check/)
- handoff reports (output/sweetui-coder-handoff/)
