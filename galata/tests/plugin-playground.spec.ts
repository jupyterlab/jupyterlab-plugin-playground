import { expect, test, type IJupyterLabPageFixture } from '@jupyterlab/galata';

const LOAD_COMMAND = 'plugin-playground:load-as-extension';
const CREATE_FILE_COMMAND = 'plugin-playground:create-new-plugin';
const TEST_PLUGIN_ID = 'playground-integration-test:plugin';
const TEST_TOGGLE_COMMAND = 'playground-integration-test:toggle';
const TEST_FILE = 'playground-integration-test.ts';

test.use({ autoGoto: false });

const hasCommand = (page: IJupyterLabPageFixture, commandId: string) =>
  page.evaluate((id: string) => {
    const w = window as any;
    const app = w.jupyterapp ?? w.galata?.app;
    return Boolean(app?.commands?.hasCommand(id));
  }, commandId);

const executeCommand = (page: IJupyterLabPageFixture, commandId: string) =>
  page.evaluate((id: string) => {
    const w = window as any;
    const app = w.jupyterapp ?? w.galata?.app;
    return app.commands.execute(id);
  }, commandId);

const hasPlugin = (page: IJupyterLabPageFixture, pluginId: string) =>
  page.evaluate((id: string) => {
    const w = window as any;
    const app = w.jupyterapp ?? w.galata?.app;
    return Boolean(app?.hasPlugin?.(id));
  }, pluginId);

const isToggled = (page: IJupyterLabPageFixture, commandId: string) =>
  page.evaluate((id: string) => {
    const w = window as any;
    const app = w.jupyterapp ?? w.galata?.app;
    return Boolean(app?.commands?.isToggled(id));
  }, commandId);

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

  await expect.poll(() => hasCommand(page, LOAD_COMMAND)).toBe(true);
  await expect.poll(() => hasCommand(page, CREATE_FILE_COMMAND)).toBe(true);
});

test('loads current editor file as a plugin extension', async ({
  page,
  tmpPath
}) => {
  const pluginPath = `${tmpPath}/${TEST_FILE}`;

  await page.contents.uploadContent(TEST_PLUGIN_SOURCE, 'text', pluginPath);
  await page.goto();

  await page.filebrowser.open(pluginPath);
  await page.locator('.jp-FileEditor').first().click();

  await expect.poll(() => hasCommand(page, LOAD_COMMAND)).toBe(true);
  await executeCommand(page, LOAD_COMMAND);

  await expect.poll(() => hasPlugin(page, TEST_PLUGIN_ID)).toBe(true);

  await expect.poll(() => hasCommand(page, TEST_TOGGLE_COMMAND)).toBe(true);

  const initiallyToggled = await isToggled(page, TEST_TOGGLE_COMMAND);
  expect(initiallyToggled).toBe(false);

  await executeCommand(page, TEST_TOGGLE_COMMAND);

  await expect.poll(() => isToggled(page, TEST_TOGGLE_COMMAND)).toBe(true);
});
