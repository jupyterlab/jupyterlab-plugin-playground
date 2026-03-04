import { expect, test } from '@jupyterlab/galata';

const LOAD_COMMAND = 'plugin-playground:load-as-extension';
const CREATE_FILE_COMMAND = 'plugin-playground:create-new-plugin';
const TEST_PLUGIN_ID = 'playground-integration-test:plugin';
const TEST_TOGGLE_COMMAND = 'playground-integration-test:toggle';
const TEST_FILE = 'playground-integration-test.ts';
const TOKEN_SIDEBAR_ID = 'jp-plugin-token-sidebar';

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
  const tokenSidebarTab = page.sidebar.getTabLocator(TOKEN_SIDEBAR_ID);
  await expect(tokenSidebarTab).toBeVisible();
  await page.sidebar.open('right');
  await tokenSidebarTab.click();
  await page.waitForFunction((id: string) => {
    const activePanel = document.querySelector(
      '#jp-right-stack .lm-StackedPanel-child:not(.lm-mod-hidden)'
    );
    return activePanel?.id === id;
  }, TOKEN_SIDEBAR_ID);

  const panel = page.sidebar.getContentPanelLocator('right');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('id', TOKEN_SIDEBAR_ID);

  const tokenListItems = panel.locator('.jp-PluginPlayground-tokenListItem');
  await expect(tokenListItems.first()).toBeVisible();
  expect(await tokenListItems.count()).toBeGreaterThan(0);

  const firstToken = (
    await panel.locator('.jp-PluginPlayground-tokenString').first().innerText()
  ).trim();
  expect(firstToken.length).toBeGreaterThan(0);

  const filterInput = panel.getByPlaceholder('Filter token strings');
  await filterInput.fill(firstToken);
  await expect(tokenListItems).toHaveCount(1);
  await expect(panel.locator('.jp-PluginPlayground-tokenString')).toHaveText([
    firstToken
  ]);
});
