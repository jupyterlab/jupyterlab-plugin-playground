import ts from 'typescript';

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import {
  showDialog,
  showErrorMessage,
  ICommandPalette
} from '@jupyterlab/apputils';

import { IDocumentWidget } from '@jupyterlab/docregistry';

import { FileEditor, IEditorTracker } from '@jupyterlab/fileeditor';

import { ILauncher } from '@jupyterlab/launcher';

import { extensionIcon } from '@jupyterlab/ui-components';

import { PluginLoader, PluginLoadingError } from './loader';

import { PluginTranspiler } from './transpiler';

import { modules } from './modules';

import { formatErrorWithResult } from './errors';

import { ImportResolver } from './resolver';

import { IRequireJS, RequireJS } from './requirejs';

namespace CommandIDs {
  export const createNewFile = 'plugin-playground:create-new-plugin';
  export const loadCurrentAsExtension = 'plugin-playground:load-as-extension';
}

const PLUGIN_TEMPLATE = `import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';

/**
 * This is an example hello world plugin.
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

class PluginPlayground {
  constructor(
    protected app: JupyterFrontEnd,
    settingRegistry: ISettingRegistry,
    commandPalette: ICommandPalette,
    editorTracker: IEditorTracker,
    launcher: ILauncher | null,
    protected requirejs: IRequireJS
  ) {
    // Define the widgets base module for RequireJS (left for compatibility only)
    requirejs.define(
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
          this._loadPlugin(currentText);
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
      const baseURL = settings.composite.packageRegistryBaseUrl as string;
      requirejs.require.config({
        baseUrl: baseURL
      });
      const urls = settings.composite.urls as string[];
      for (const u of urls) {
        await this._getModule(u);
      }
      const plugins = settings.composite.plugins as string[];
      for (const t of plugins) {
        await this._loadPlugin(t);
      }
    });
  }

  private async _loadPlugin(code: string) {
    const tokenMap = new Map(
      Array.from((this.app as any)._serviceMap.keys()).map((t: any) => [
        t.name,
        t
      ])
    );
    // Widget registry does not follow convention of importName:tokenName
    tokenMap.set(
      '@jupyter-widgets/base:IJupyterWidgetRegistry',
      tokenMap.get('jupyter.extensions.jupyterWidgetRegistry')
    );
    const importResolver = new ImportResolver({
      modules: modules,
      tokenMap: tokenMap,
      requirejs: this.requirejs
    });

    const pluginLoader = new PluginLoader({
      transpiler: new PluginTranspiler({
        compilerOptions: {
          module: ts.ModuleKind.ES2020,
          target: ts.ScriptTarget.ES2017
        }
      }),
      importFunction: importResolver.resolve.bind(importResolver),
      tokenMap: tokenMap
    });
    let result;
    try {
      result = await pluginLoader.load(code);
    } catch (error) {
      if (error instanceof PluginLoadingError) {
        const internalError = error.error;
        showDialog({
          title: `Plugin loading failed: ${internalError.message}`,
          body: formatErrorWithResult(error, error.partialResult)
        });
      } else {
        showErrorMessage('Plugin loading failed', (error as Error).message);
      }
      return;
    }
    const plugin = result.plugin;

    // Unregister plugin if already registered.
    if (this.app.hasPlugin(plugin.id)) {
      delete (this.app as any)._pluginMap[plugin.id];
    }
    (this.app as any).registerPluginModule(plugin);
    if (plugin.autoStart) {
      try {
        await this.app.activatePlugin(plugin.id);
      } catch (e) {
        showDialog({
          title: `Plugin autostart failed: ${(e as Error).message}`,
          body: formatErrorWithResult(e, result)
        });
        return;
      }
    }
  }

  private async _getModule(url: string) {
    const response = await fetch(url);
    const jsBody = await response.text();
    this._loadPlugin(jsBody);
  }
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
    // load RequireJS before loading any custom extensions.

    const requirejs = new RequireJS();
    // We coud convert to `async` and use `await` but we don't, because a failure
    // would freeze JupyterLab on splash screen; this way if it fails to load,
    // only the plugin is affected, not the entire application.
    requirejs.load().then(() => {
      new PluginPlayground(
        app,
        settingRegistry,
        commandPalette,
        editorTracker,
        launcher,
        requirejs
      );
    });
  }
};

export default plugin;
