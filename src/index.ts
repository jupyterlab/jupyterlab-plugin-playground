import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { ICommandPalette } from '@jupyterlab/apputils';

import { IEditorTracker } from '@jupyterlab/fileeditor';

import * as base from '@jupyter-widgets/base';
void base;

async function load_plugin(js_body: string, app: JupyterFrontEnd) {
  const token_map = new Map(
    Array.from((app as any)._serviceMap.keys()).map((t: any) => [t.name, t])
  );

  const module_fct = new Function(js_body)();
  const module_obj = module_fct();

  module_obj.requires = module_obj.requires.map((value: any) =>
    token_map.get(value)
  );

  (app as any).registerPluginModule(module_obj);
  if (module_obj.autoStart) {
    await app.activatePlugin(module_obj.id);
  }
}

async function get_module(url: string, app: JupyterFrontEnd) {
  const response = await fetch(url);
  const js_body = await response.text();
  load_plugin(js_body, app);
}

/**
 * Initialization data for the jupyterlab-dynext extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-dynext:plugin',
  autoStart: true,
  requires: [ISettingRegistry, ICommandPalette, IEditorTracker],
  activate: (
    app: JupyterFrontEnd,
    settingRegistry: ISettingRegistry,
    commandPalette: ICommandPalette,
    editorTracker: IEditorTracker
  ) => {
    (doc => {
      const script = doc.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.onload = () => {
        // Define the widgets base module for RequireJS
        (window as any).define('@jupyter-widgets/base', [], () => base);

        const commandID = 'LoadCurrentFileAsExtension';
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
          category: 'Dynamic Extension Loader',
          args: {}
        });

        app.restored.then(async () => {
          const settings = await settingRegistry.load(plugin.id);
          const urls = settings.composite.urls as string[];
          for (const u of urls) {
            await get_module(u, app);
          }
          const extensions = settings.composite.extensions as string[];
          for (const t of extensions) {
            await load_plugin(t, app);
          }
        });
      };

      script.src =
        'https://requirejs.org/docs/release/2.3.6/comments/require.js';
      doc.getElementsByTagName('head')[0].appendChild(script);
    })(window.document);
  }
};

export default plugin;
