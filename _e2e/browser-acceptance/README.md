# Mixed IconPlus / EP browser acceptance

Run from repository root, using Node 24 and installed Chrome (override `CHROME_PATH` if needed).

```powershell
npm --prefix _e2e/independent-build/icon-indep ci --no-audit --no-fund
node skills/gts-ep-coder/scripts/build.mjs --dir _e2e/independent-build/icon-indep
npm --prefix _e2e/independent-build/icon-indep run build
node _e2e/browser-acceptance/accept-dist.mjs
node _e2e/browser-acceptance/accept-preview-file.mjs
node _e2e/browser-acceptance/verify-consistency.mjs
```

Both browser drivers return nonzero on assertion, resource, JavaScript, or protocol failure.
They use separate temporary browser profiles and close the processes they start.
The dist driver serves the existing production build with correct MIME types on a temporary local port.
Optional arguments remain `<url> <output-directory>`; defaults use the checked-in independent fixture.

The file driver uses default file permissions (no `--allow-file-access-from-files`), disables cache,
and blocks all HTTP(S) requests before navigation. The report records every page request and response;
any attempted HTTP(S) request fails acceptance even if blocked. This isolates page network dependencies,
not all unrelated Chrome process networking.

Negative control:

```powershell
node _e2e/browser-acceptance/accept-dist.mjs --negative-css
# Expected: RESULT FAIL, exit 1. Intentionally blocks production CSS.
```

Reports and screenshots are under `shots/dist`, `shots/file`, and `shots/negative-dist`.
`shots/consistency.json` records exact icon metrics and selected computed-style parity for both themes.
The root-level legacy screenshots/reports are historical failed evidence, superseded by these subdirectories.

This fixture uses mock SVG assets (squares); these tests verify provider selection delivery, sizing,
theme variants, CSS and offline loading, not the real internal IconPlus service or visual semantics.
The suite does not claim full application interaction or design-token semantic compliance.
