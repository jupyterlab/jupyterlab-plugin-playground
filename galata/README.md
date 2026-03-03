# Integration Tests (Galata)

Browser integration tests for `@jupyterlab/plugin-playground` using:

- [Playwright](https://playwright.dev/docs/intro)
- [Galata](https://github.com/jupyterlab/jupyterlab/tree/main/galata)

## Quickstart

```bash
jlpm run build:prod
jlpm run test:integration
```

## setup

```bash
cd galata
jlpm install
jlpm playwright install chromium
```

## commands

```bash
# List tests
cd galata && jlpm playwright test --list

# Run only this plugin spec
cd galata && jlpm playwright test tests/plugin-playground.spec.ts --workers=1
```

## Outputs

- `galata/playwright-report`
- `galata/test-results`
