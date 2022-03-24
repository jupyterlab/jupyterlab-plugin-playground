import { Token } from '@lumino/coreutils';
import { IPlugin } from '@lumino/application';

import { PathExt } from '@jupyterlab/coreutils';

import { ServiceManager } from '@jupyterlab/services';

import { NoDefaultExportError, PluginTranspiler } from './transpiler';

import { IRequireJS } from './requirejs';

import { IModule, IModuleMember } from './types';

export namespace PluginLoader {
  export interface IOptions {
    transpiler: PluginTranspiler;
    importFunction(
      statement: string
    ): Promise<Token<any> | IModule | IModuleMember>;
    tokenMap: Map<string, Token<any>>;
    /**
     * For backward-compatibility with plugins using requirejs over `import`;
     */
    requirejs: IRequireJS;
    serviceManager: ServiceManager | null;
  }
  export interface IResult {
    plugin: IPlugin<any, any>;
    code: string;
    transpiled: boolean;
    schema?: string | null;
  }
}

export class PluginLoader {
  private _options: PluginLoader.IOptions;

  constructor(options: PluginLoader.IOptions) {
    this._options = options;
  }

  async loadFile(code: string): Promise<IModule> {
    const functionBody = this._options.transpiler.transpile(code, false);
    return await this._createAsyncFunctionModule(functionBody);
  }

  private async _createAsyncFunctionModule(transpiledCode: string) {
    const module = new AsyncFunction(
      this._options.transpiler.importFunctionName,
      transpiledCode
    );
    return await module(this._options.importFunction);
  }

  private async _discoverSchema(
    pluginPath: string | null
  ): Promise<string | null> {
    if (!pluginPath) {
      console.warn('Not looking for schema: no path');
      return null;
    }
    const serviceManager = this._options.serviceManager;
    if (!serviceManager) {
      console.warn('Not looking for schema: no document manager');
      return null;
    }
    const candidatePaths = [
      // canonical
      PathExt.join(PathExt.dirname(pluginPath), '..', 'schema', 'plugin.json'),
      // simplification for dynamic plugins
      PathExt.join(PathExt.dirname(pluginPath), 'plugin.json')
    ];
    for (const path of candidatePaths) {
      console.log(`Looking for schema in ${path}`);
      try {
        const file = await serviceManager.contents.get(path);
        console.log(`Found schema in ${path}`);
        return file.content;
      } catch (e) {
        console.log(`Did not find schema in ${path}`);
      }
    }
    return null;
  }

  /**
   * Create a plugin from TypeScript code.
   */
  async load(
    code: string,
    basePath: string | null
  ): Promise<PluginLoader.IResult> {
    let functionBody: string;
    let plugin;
    let transpiled = true;
    try {
      functionBody = this._options.transpiler.transpile(code, true);
    } catch (error) {
      if (error instanceof NoDefaultExportError) {
        // no export statment
        // for compatibility with older version
        console.log(
          'No default export was found in the plugin code, falling back to object-based evaluation'
        );
        functionBody = `'use strict';\nreturn (${code})`;
        transpiled = false;
      } else {
        throw error;
      }
    }

    console.log(functionBody);
    let schema: string | null = null;

    try {
      if (transpiled) {
        const module = await this._createAsyncFunctionModule(functionBody);
        plugin = module.default;
        schema = await this._discoverSchema(basePath);
      } else {
        const requirejs = this._options.requirejs;
        plugin = new Function('require', 'requirejs', 'define', functionBody)(
          requirejs.require,
          requirejs.require,
          requirejs.define
        );
      }
    } catch (e) {
      throw new PluginLoadingError(e, { code: functionBody, transpiled });
    }

    // We allow one level of indirection (return a function instead of a plugin)
    if (typeof plugin === 'function') {
      plugin = plugin();
    }

    // Finally, we allow returning a promise (or an async function above).
    plugin = (await Promise.resolve(plugin)) as IPlugin<any, any>;

    plugin.requires = plugin.requires?.map((value: string | Token<any>) => {
      if (!isString(value)) {
        // already a token
        return value;
      }
      const token = this._options.tokenMap.get(value);
      if (!token) {
        throw Error('Required token' + value + 'not found in the token map');
      }
      return token;
    });
    plugin.optional = plugin.optional
      ?.map((value: string | Token<any>) => {
        if (!isString(value)) {
          // already a token
          return value;
        }
        const token = this._options.tokenMap.get(value);
        if (!token) {
          console.log('Optional token' + value + 'not found in the token map');
        }
        return token;
      })
      .filter((token): token is Token<any> => token != null);
    return {
      schema,
      plugin,
      code: functionBody,
      transpiled
    };
  }
}

function isString(value: any): value is string {
  return typeof value === 'string' || value instanceof String;
}

export class PluginLoadingError extends Error {
  constructor(
    public error: Error,
    public partialResult: Omit<PluginLoader.IResult, 'plugin'>
  ) {
    super();
  }
}

const AsyncFunction = Object.getPrototypeOf(async () => {
  // no-op
}).constructor;
