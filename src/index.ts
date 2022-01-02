import ts from 'typescript';

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { ICommandPalette } from '@jupyterlab/apputils';

import { IDocumentWidget } from '@jupyterlab/docregistry';

import { FileEditor, IEditorTracker } from '@jupyterlab/fileeditor';

import { ILauncher } from '@jupyterlab/launcher';

import { extensionIcon } from '@jupyterlab/ui-components';

import { PluginLoader } from './loader';

import { modules } from './modules';

namespace CommandIDs {
  export const createNewFile = 'plugin-playground:create-new-plugin';
  export const loadCurrentAsExtension = 'plugin-playground:load-as-extension';
}

const PLUGIN_TEMPLATE = `import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';

/**
 * This is an example hellow world plugin.
 * Open Command Palette with Ctrl+Shift+C
 * (Command+Shift+C on Mac) and select
 * "Load Current File as Extension"
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'hello-world:plugin',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    alert('Hello World!');
  },
};

export default plugin;
`;

async function loadPlugin(code: string, app: JupyterFrontEnd) {
  const tokenMap = new Map(
    Array.from((app as any)._serviceMap.keys()).map((t: any) => [t.name, t])
  );
  const pluginLoader = new PluginLoader({
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2017
    },
    modules: modules,
    tokenMap: tokenMap
  });
  const plugin = await pluginLoader.load(code);

  // Unregister plugin if already registered.
  if (app.hasPlugin(plugin.id)) {
    delete (app as any)._pluginMap[plugin.id];
  }
  (app as any).registerPluginModule(plugin);
  if (plugin.autoStart) {
    await app.activatePlugin(plugin.id);
  }
}

async function getModule(url: string, app: JupyterFrontEnd) {
  const response = await fetch(url);
  const jsBody = await response.text();
  loadPlugin(jsBody, app);
}

/**
 * Initialization data for the @jupyterlab/plugin-playground extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/plugin-playground:plugin',
  autoStart: true,
  requires: [ISettingRegistry, ICommandPalette, IEditorTracker],
  optional: [ILauncher],
  activate: (
    app: JupyterFrontEnd,
    settingRegistry: ISettingRegistry,
    commandPalette: ICommandPalette,
    editorTracker: IEditorTracker,
    launcher: ILauncher | null
  ) => {
    // In order to accommodate loading ipywidgets and other AMD modules, we
    // first put RequireJS on the page (and define the @jupyter-widgets/base
    // module to give our system version) before loading any custom extensions.
    const script = document.createElement('script');
    script.src = 'https://requirejs.org/docs/release/2.3.6/comments/require.js';
    script.type = 'text/javascript';
    script.async = true;
    script.onload = () => {
      // Define the widgets base module for RequireJS - left for compatibility only
      (window as any).define(
        '@jupyter-widgets/base',
        [],
        () => modules['@jupyter-widgets/base']
      );

      app.commands.addCommand(CommandIDs.loadCurrentAsExtension, {
        label: 'Load Current File As Extension',
        icon: extensionIcon,
        isEnabled: () =>
          editorTracker.currentWidget !== null &&
          editorTracker.currentWidget === app.shell.currentWidget,
        execute: async () => {
          if (editorTracker.currentWidget) {
            const currentText =
              editorTracker.currentWidget.context.model.toString();
            loadPlugin(currentText, app);
          }
        }
      });

      commandPalette.addItem({
        command: CommandIDs.loadCurrentAsExtension,
        category: 'Plugin Playground',
        args: {}
      });

      app.commands.addCommand(CommandIDs.createNewFile, {
        label: 'TypeScript File (Playground)',
        caption: 'Create a new TypeScript file',
        icon: extensionIcon,
        execute: async args => {
          const model = await app.commands.execute('docmanager:new-untitled', {
            path: args['cwd'],
            type: 'file',
            ext: 'ts'
          });
          const widget: IDocumentWidget<FileEditor> | undefined =
            await app.commands.execute('docmanager:open', {
              path: model.path,
              factory: 'Editor'
            });
          if (widget) {
            widget.content.ready.then(() => {
              widget.content.model.value.text = PLUGIN_TEMPLATE;
            });
          }
          return widget;
        }
      });

      // add to the launcher
      if (launcher) {
        launcher.add({
          command: CommandIDs.createNewFile,
          category: 'Other',
          rank: 1
        });
      }

      app.restored.then(async () => {
        const settings = await settingRegistry.load(plugin.id);
        (window as any).require.config({
          baseUrl: settings.composite.packageRegistryBaseUrl
        });
        const urls = settings.composite.urls as string[];
        for (const u of urls) {
          await getModule(u, app);
        }
        const plugins = settings.composite.plugins as string[];
        for (const t of plugins) {
          await loadPlugin(t, app);
        }
      });
    };

    // Actually load RequireJS
    document.getElementsByTagName('head')[0].appendChild(script);
  }
};

export default plugin;
