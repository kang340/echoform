# Contributing to ECHOFORM

Use Node.js 24 LTS (minimum 22.18) and run `npm ci`, then `npm run dev`.
The local app is available at http://127.0.0.1:5178/.

Before opening a pull request:

1. Run `npm run build`.
2. Install a browser with `npx playwright-core install chromium`. On Linux, use `--with-deps`.
3. Keep the dev server running and run `npm run test:regressions`.
4. For changes to sound mapping, run `npm run test:analysis`; for visual interactions, run `npm run test:interactions` and `npm run test:mobile`.

Tests use a local Chrome/Edge installation on Windows, or Playwright Chromium elsewhere.
Set `CHROME_PATH` to use another browser and `ECHOFORM_URL` to change the test URL.
Capture artifacts are ignored by Git. Never commit personal recordings or credentials.

Report bugs with reproduction steps, browser/version, OS, and relevant console errors.
For performance issues, include viewport and GPU information when available.
Do not attach private voice recordings; use the generated audio fixtures instead.

Source code is MIT licensed. Brand and promotional media follow the existing terms in `docs/ASSETS_LICENSES.md`.
