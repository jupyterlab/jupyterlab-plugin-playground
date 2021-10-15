import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { ICommandPalette } from '@jupyterlab/apputils';

import { IEditorTracker } from '@jupyterlab/fileeditor';

import * as base from '@jupyter-widgets/base';

async function load_plugin(code: string, app: JupyterFrontEnd) {
  const token_map = new Map(
    Array.from((app as any)._serviceMap.keys()).map((t: any) => [t.name, t])
  );

  const functionBody = `'use strict';return (${code})`;
  console.log(functionBody);
  let plugin;
  try {
    plugin = new Function(functionBody)();
  } catch (e) {
    alert(`Problem loading extension: ${e}
    
    ${functionBody}`);
    throw e;
  }
  // We allow one level of indirection (return a function instead of a plugin)
  if (typeof plugin === 'function') {
    plugin = plugin();
  }

  // Finally, we allow returning a promise (or an async function above).
  plugin = await Promise.resolve(plugin);

  plugin.requires = plugin.requires?.map((value: any) => token_map.get(value));
  plugin.optional = plugin.optional?.map((value: any) => token_map.get(value));

  (app as any).registerPluginModule(plugin);
  if (plugin.autoStart) {
    await app.activatePlugin(plugin.id);
  }
}

async function get_module(url: string, app: JupyterFrontEnd) {
  const response = await fetch(url);
  const js_body = await response.text();
  load_plugin(js_body, app);
}

/**
 * Initialization data for the @jupyterlab/plugin-playground extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/plugin-playground:plugin',
  autoStart: true,
  requires: [ISettingRegistry, ICommandPalette, IEditorTracker],
  activate: (
    app: JupyterFrontEnd,
    settingRegistry: ISettingRegistry,
    commandPalette: ICommandPalette,
    editorTracker: IEditorTracker
  ) => {
    // In order to accommodate loading ipywidgets and other AMD modules, we
    // first put RequireJS on the page (and define the @jupyter-widgets/base
    // module to give our system version) before loading any custom extensions.
    const script = document.createElement('script');
    script.src = 'https://requirejs.org/docs/release/2.3.6/comments/require.js';
    script.type = 'text/javascript';
    script.async = true;
    script.onload = () => {
      // Define the widgets base module for RequireJS
      (window as any).define('@jupyter-widgets/base', [], () => base);

      const commandID =
        '@jupyterlab/plugin-playground:LoadCurrentFileAsExtension';
      app.commands.addCommand(commandID, {
        label: 'Load current file as extension',
        isEnabled: () =>
          editorTracker.currentWidget !== null &&
          editorTracker.currentWidget === app.shell.currentWidget,
        execute: async () => {
          if (editorTracker.currentWidget) {
            const currentText =
              editorTracker.currentWidget.context.model.toString();
            load_plugin(currentText, app);
          }
        }
      });

      commandPalette.addItem({
        command: commandID,
        category: 'Plugin Playground',
        args: {}
      });

      app.restored.then(async () => {
        const settings = await settingRegistry.load(plugin.id);
        const urls = settings.composite.urls as string[];
        for (const u of urls) {
          await get_module(u, app);
        }
        const plugins = settings.composite.plugins as string[];
        for (const t of plugins) {
          await load_plugin(t, app);
        }
      });
    };

    // Actually load RequireJS
    document.getElementsByTagName('head')[0].appendChild(script);
  }
};

export default plugin;
