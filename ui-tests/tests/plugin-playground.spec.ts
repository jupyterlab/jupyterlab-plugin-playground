import { expect, test } from '@jupyterlab/galata';

const LOAD_COMMAND = 'plugin-playground:load-as-extension';
const CREATE_FILE_COMMAND = 'plugin-playground:create-new-plugin';
const TEST_PLUGIN_ID = 'playground-integration-test:plugin';
const TEST_TOGGLE_COMMAND = 'playground-integration-test:toggle';
const TEST_FILE = 'playground-integration-test.ts';

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
