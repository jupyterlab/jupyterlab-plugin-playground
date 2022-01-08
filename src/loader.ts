import { Token } from '@lumino/coreutils';
import { IPlugin } from '@lumino/application';

import { NoDefaultExportError, PluginTranspiler } from './transpiler';

import { IRequireJS } from './requirejs';

import { IModule, IModuleMember } from './types';

export namespace PluginLoader {
  export interface IOptions {
    transpiler: PluginTranspiler;
    importFunction(
      statement: PluginTranspiler.IImportStatement
    ): Promise<Token<any> | IModule | IModuleMember>;
    tokenMap: Map<string, Token<any>>;
    /**
     * For backward-compatibility with plugins using requirejs over `import`;
     */
    requirejs: IRequireJS;
  }
  export interface IResult {
    plugin: IPlugin<any, any>;
    code: string;
    transpiled: boolean;
  }
}

export class PluginLoader {
  private _options: PluginLoader.IOptions;

  constructor(options: PluginLoader.IOptions) {
    this._options = options;
  }

  /**
   * Create a plugin from TypeScript code.
   */
  async load(code: string): Promise<PluginLoader.IResult> {
    let functionBody: string;
    let plugin;
    let transpiled = true;
    try {
      functionBody = this._options.transpiler.transpile(code);
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

    try {
      if (transpiled) {
        plugin = await new AsyncFunction(
          this._options.transpiler.importFunctionName,
          functionBody
        )(this._options.importFunction);
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
