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

import { Signal } from '@lumino/signaling';

import { IDocumentWidget } from '@jupyterlab/docregistry';

import { FileEditor, IEditorTracker } from '@jupyterlab/fileeditor';

import { ILauncher } from '@jupyterlab/launcher';

import { extensionIcon } from '@jupyterlab/ui-components';

import { IDocumentManager } from '@jupyterlab/docmanager';

import { PluginLoader, PluginLoadingError } from './loader';

import { PluginTranspiler } from './transpiler';

import { modules } from './modules';

import { formatErrorWithResult } from './errors';

import { ImportResolver } from './resolver';

import { IRequireJS, RequireJSLoader } from './requirejs';

import { IModule } from './types';

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
    protected settingRegistry: ISettingRegistry,
    commandPalette: ICommandPalette,
    editorTracker: IEditorTracker,
    launcher: ILauncher | null,
    protected documentManager: IDocumentManager | null,
    protected settings: ISettingRegistry.ISettings,
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
        const currentWidget = editorTracker.currentWidget;
        if (currentWidget) {
          const currentText = currentWidget.context.model.toString();
          this._loadPlugin(currentText, currentWidget.context.path);
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

    app.restored.then(async () => {
      const settings = this.settings;
      this._updateSettings(requirejs, settings);
      // add to the launcher
      if (launcher && (settings.composite.showIconInLauncher as boolean)) {
        launcher.add({
          command: CommandIDs.createNewFile,
          category: 'Other',
          rank: 1
        });
      }

      const urls = settings.composite.urls as string[];
      for (const u of urls) {
        await this._getModule(u);
      }
      const plugins = settings.composite.plugins as string[];
      for (const t of plugins) {
        await this._loadPlugin(t, null);
      }

      settings.changed.connect(updatedSettings => {
        this._updateSettings(requirejs, updatedSettings);
      });
    });
  }

  private _updateSettings(
    requirejs: IRequireJS,
    settings: ISettingRegistry.ISettings
  ) {
    const baseURL = settings.composite.requirejsCDN as string;
    requirejs.require.config({
      baseUrl: baseURL
    });
  }

  private async _loadPlugin(code: string, path: string | null) {
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
      modules: modules as unknown as Record<string, IModule>,
      tokenMap: tokenMap,
      requirejs: this.requirejs,
      settings: this.settings,
      serviceManager: this.app.serviceManager,
      basePath: path
    });

    const pluginLoader = new PluginLoader({
      transpiler: new PluginTranspiler({
        compilerOptions: {
          target: ts.ScriptTarget.ES2017,
          jsx: ts.JsxEmit.React
        }
      }),
      importFunction: importResolver.resolve.bind(importResolver),
      tokenMap: tokenMap,
      serviceManager: this.app.serviceManager,
      requirejs: this.requirejs
    });
    importResolver.dynamicLoader = pluginLoader.loadFile.bind(pluginLoader);

    let result;
    try {
      result = await pluginLoader.load(code, path);
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

    if (result.schema) {
      // TODO: this is mostly fine to get the menus and toolbars, but:
      // - transforms are not applied
      // - any refresh from the server might overwrite the data
      // - it is not a good long term solution in general
      this.settingRegistry.plugins[plugin.id] = {
        id: plugin.id,
        schema: JSON.parse(result.schema),
        raw: result.schema,
        data: {
          composite: {},
          user: {}
        },
        version: '0.0.0'
      };
      (
        this.settingRegistry.pluginChanged as Signal<ISettingRegistry, string>
      ).emit(plugin.id);
    }

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
    this._loadPlugin(jsBody, null);
  }
}

/**
 * Initialization data for the @jupyterlab/plugin-playground extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/plugin-playground:plugin',
  autoStart: true,
  requires: [ISettingRegistry, ICommandPalette, IEditorTracker],
  optional: [ILauncher, IDocumentManager],
  activate: (
    app: JupyterFrontEnd,
    settingRegistry: ISettingRegistry,
    commandPalette: ICommandPalette,
    editorTracker: IEditorTracker,
    launcher: ILauncher | null,
    documentManager: IDocumentManager | null
  ) => {
    // In order to accommodate loading ipywidgets and other AMD modules, we
    // load RequireJS before loading any custom extensions.

    const requirejsLoader = new RequireJSLoader();
    // We coud convert to `async` and use `await` but we don't, because a failure
    // would freeze JupyterLab on splash screen; this way if it fails to load,
    // only the plugin is affected, not the entire application.
    Promise.all([settingRegistry.load(plugin.id), requirejsLoader.load()]).then(
      ([settings, requirejs]) => {
        new PluginPlayground(
          app,
          settingRegistry,
          commandPalette,
          editorTracker,
          launcher,
          documentManager,
          settings,
          requirejs
        );
      }
    );
  }
};

export default plugin;
