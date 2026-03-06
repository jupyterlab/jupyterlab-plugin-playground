import { expect, test } from '@jupyterlab/galata';
import type { FileEditorWidget } from '@jupyterlab/fileeditor';
import type { IJupyterLabPageFixture } from '@jupyterlab/galata';
import type { Locator } from '@playwright/test';

const LOAD_COMMAND = 'plugin-playground:load-as-extension';
const CREATE_FILE_COMMAND = 'plugin-playground:create-new-plugin';
const TEST_PLUGIN_ID = 'playground-integration-test:plugin';
const TEST_TOGGLE_COMMAND = 'playground-integration-test:toggle';
const TEST_FILE = 'playground-integration-test.ts';
const TOKEN_SIDEBAR_ID = 'jp-plugin-token-sidebar';
const EXAMPLE_SIDEBAR_ID = 'jp-plugin-example-sidebar';

test.use({ autoGoto: false });

const TEST_PLUGIN_SOURCE = `
const plugin = {
  id: '${TEST_PLUGIN_ID}',
  autoStart: true,
  activate: app => {
    let toggled = false;
    app.commands.addCommand('${TEST_TOGGLE_COMMAND}', {
      label: 'Playground Integration Toggle',
      isToggled: () => toggled,
      execute: () => {
        toggled = !toggled;
      }
    });
  }
};

export default plugin;
`;

async function openSidebarPanel(
  page: IJupyterLabPageFixture,
  sidebarId: string
): Promise<Locator> {
  const sidebarTab = page.sidebar.getTabLocator(sidebarId);
  await expect(sidebarTab).toBeVisible();
  await page.sidebar.openTab(sidebarId);

  const sidebarSide = await page.sidebar.getTabPosition(sidebarId);
  const panel = page.sidebar.getContentPanelLocator(sidebarSide ?? 'right');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('id', sidebarId);
  return panel;
}

async function findImportableToken(panel: Locator): Promise<string> {
  const tokenEntries = panel.locator('.jp-PluginPlayground-entryLabel');
  const count = await tokenEntries.count();
  for (let i = 0; i < count; i++) {
    const tokenName = (await tokenEntries.nth(i).innerText()).trim();
    const separatorIndex = tokenName.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }
    const packageName = tokenName.slice(0, separatorIndex).trim();
    const tokenSymbol = tokenName.slice(separatorIndex + 1).trim();
    if (
      packageName.length > 0 &&
      /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(tokenSymbol)
    ) {
      return tokenName;
    }
  }
  throw new Error('No importable token found in token sidebar');
}

test('registers plugin playground commands', async ({ page }) => {
  await page.goto();

  await page.waitForCondition(() =>
    page.evaluate((id: string) => {
      return window.jupyterapp.commands.hasCommand(id);
    }, LOAD_COMMAND)
  );

  await page.waitForCondition(() =>
    page.evaluate((id: string) => {
      return window.jupyterapp.commands.hasCommand(id);
    }, CREATE_FILE_COMMAND)
  );

  await expect(
    page.evaluate((id: string) => {
      return window.jupyterapp.commands.hasCommand(id);
    }, LOAD_COMMAND)
  ).resolves.toBe(true);

  await expect(
    page.evaluate((id: string) => {
      return window.jupyterapp.commands.hasCommand(id);
    }, CREATE_FILE_COMMAND)
  ).resolves.toBe(true);
});

test('opens an extension example from the sidebar', async ({ page }) => {
  await page.goto();
  const panel = await openSidebarPanel(page, EXAMPLE_SIDEBAR_ID);

  const exampleItems = panel.locator('.jp-PluginPlayground-listItem');
  await expect(exampleItems.first()).toBeVisible();
  expect(await exampleItems.count()).toBeGreaterThan(0);

  const firstExampleName = (
    await panel.locator('.jp-PluginPlayground-entryLabel').first().innerText()
  ).trim();
  expect(firstExampleName.length).toBeGreaterThan(0);

  const openButton = exampleItems
    .first()
    .locator('.jp-PluginPlayground-exampleOpenButton');
  await expect(openButton).toBeVisible();
  await openButton.click();

  await page.waitForFunction((exampleName: string) => {
    const current = window.jupyterapp.shell
      .currentWidget as FileEditorWidget | null;
    const path = current?.context?.path;
    if (typeof path !== 'string') {
      return false;
    }
    return (
      path === `extension-examples/${exampleName}/src/index.ts` ||
      path === `extension-examples/${exampleName}/src/index.js`
    );
  }, firstExampleName);
});

test('loads current editor file as a plugin extension', async ({
  page,
  tmpPath
}) => {
  const pluginPath = `${tmpPath}/${TEST_FILE}`;

  await page.contents.uploadContent(TEST_PLUGIN_SOURCE, 'text', pluginPath);
  await page.goto();

  await page.filebrowser.open(pluginPath);
  expect(await page.activity.activateTab(TEST_FILE)).toBe(true);

  await page.waitForCondition(() =>
    page.evaluate((id: string) => {
      return window.jupyterapp.commands.hasCommand(id);
    }, LOAD_COMMAND)
  );
  await page.evaluate((id: string) => {
    return window.jupyterapp.commands.execute(id);
  }, LOAD_COMMAND);

  await page.waitForCondition(() =>
    page.evaluate((id: string) => {
      return window.jupyterapp.hasPlugin(id);
    }, TEST_PLUGIN_ID)
  );

  await page.waitForCondition(() =>
    page.evaluate((id: string) => {
      return window.jupyterapp.commands.hasCommand(id);
    }, TEST_TOGGLE_COMMAND)
  );

  const initiallyToggled = await page.evaluate((id: string) => {
    return window.jupyterapp.commands.isToggled(id);
  }, TEST_TOGGLE_COMMAND);
  expect(initiallyToggled).toBe(false);

  await page.evaluate((id: string) => {
    return window.jupyterapp.commands.execute(id);
  }, TEST_TOGGLE_COMMAND);

  await page.waitForCondition(() =>
    page.evaluate((id: string) => {
      return window.jupyterapp.commands.isToggled(id);
    }, TEST_TOGGLE_COMMAND)
  );
  await expect(
    page.evaluate((id: string) => {
      return window.jupyterapp.commands.isToggled(id);
    }, TEST_TOGGLE_COMMAND)
  ).resolves.toBe(true);
});

test('opens token sidebar, shows tokens, and filters by exact token', async ({
  page
}) => {
  await page.goto();
  const panel = await openSidebarPanel(page, TOKEN_SIDEBAR_ID);

  const tokenListItems = panel.locator('.jp-PluginPlayground-listItem');
  await expect(tokenListItems.first()).toBeVisible();
  expect(await tokenListItems.count()).toBeGreaterThan(0);

  const firstToken = (
    await panel.locator('.jp-PluginPlayground-entryLabel').first().innerText()
  ).trim();
  expect(firstToken.length).toBeGreaterThan(0);

  const filterInput = panel.getByPlaceholder('Filter token strings');
  await filterInput.fill(firstToken);
  await expect(tokenListItems).toHaveCount(1);
  await expect(panel.locator('.jp-PluginPlayground-entryLabel')).toHaveText([
    firstToken
  ]);
});

test('token sidebar copy button shows copied state', async ({ page }) => {
  await page.goto();
  const panel = await openSidebarPanel(page, TOKEN_SIDEBAR_ID);

  const tokenListItem = panel.locator('.jp-PluginPlayground-listItem');
  await expect(tokenListItem.first()).toBeVisible();

  const copyButton = tokenListItem
    .first()
    .locator('.jp-PluginPlayground-copyButton');
  await expect(copyButton).toHaveAttribute('title', 'Copy token string');
  await copyButton.click();
  await expect(copyButton).toHaveAttribute('title', 'Copied');
});

test('token sidebar inserts import statement into active editor', async ({
  page,
  tmpPath
}) => {
  const editorPath = `${tmpPath}/token-sidebar-import.ts`;

  await page.contents.uploadContent(
    "const pluginId = 'token-sidebar-test';\n",
    'text',
    editorPath
  );
  await page.goto();
  await page.filebrowser.open(editorPath);
  expect(await page.activity.activateTab('token-sidebar-import.ts')).toBe(true);

  const panel = await openSidebarPanel(page, TOKEN_SIDEBAR_ID);
  const tokenName = await findImportableToken(panel);
  const filterInput = panel.getByPlaceholder('Filter token strings');
  await filterInput.fill(tokenName);
  const tokenListItem = panel.locator('.jp-PluginPlayground-listItem');
  await expect(tokenListItem).toHaveCount(1);

  const importButton = tokenListItem.locator(
    '.jp-PluginPlayground-importButton'
  );
  await expect(importButton).toBeEnabled();
  await importButton.click();

  const separatorIndex = tokenName.indexOf(':');
  const packageName = tokenName.slice(0, separatorIndex).trim();
  const tokenSymbol = tokenName.slice(separatorIndex + 1).trim();
  const expectedImport = `import { ${tokenSymbol} } from '${packageName}';`;

  await page.waitForFunction((expected: string) => {
    const current = window.jupyterapp.shell
      .currentWidget as FileEditorWidget | null;
    const source = current?.content.model.sharedModel.getSource();
    if (typeof source !== 'string') {
      return false;
    }
    return source.startsWith(expected);
  }, expectedImport);

  await importButton.click();
  await page.waitForFunction((expected: string) => {
    const current = window.jupyterapp.shell
      .currentWidget as FileEditorWidget | null;
    const source = current?.content.model.sharedModel.getSource();
    if (typeof source !== 'string') {
      return false;
    }
    return source.split(expected).length - 1 === 1;
  }, expectedImport);
});
