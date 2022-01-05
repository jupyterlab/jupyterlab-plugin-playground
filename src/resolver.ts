import { showDialog } from '@jupyterlab/apputils';

import { PluginTranspiler } from './transpiler';

import { formatImportError } from './errors';

import { Token } from '@lumino/coreutils';

import { IRequireJS } from './requirejs';

function handleImportError(
  error: Error,
  data: PluginTranspiler.IImportStatement
) {
  return showDialog({
    title: `Import in plugin code failed: ${error.message}`,
    body: formatImportError(error, data)
  });
}

export namespace ImportResolver {
  export interface IOptions {
    modules: Record<string, any>;
    tokenMap: Map<string, Token<any>>;
    requirejs: IRequireJS;
  }
}

function formatImport(data: PluginTranspiler.IImportStatement): string {
  const tokens = ['import'];
  if (data.isTypeOnly) {
    tokens.push('type');
  }
  if (data.isDefault) {
    tokens.push(`* as ${data.name}`);
  } else {
    const name = data.alias ? `${data.name} as ${data.alias}` : data.name;
    tokens.push(data.unpack ? `{ ${name} }` : name);
  }
  tokens.push('from');
  tokens.push(data.module);
  return tokens.join(' ');
}

export class ImportResolver {
  constructor(private _options: ImportResolver.IOptions) {
    // no-op
  }
  /**
   * Convert import to:
   *   - token string (for backward compatibility, otherwise we could just use token),
   *   - module assignment if appropriate module is available,
   *   - requirejs import if everything else fails
   */
  async resolve(data: PluginTranspiler.IImportStatement): Promise<any> {
    return new Promise((resolve, reject) => {
      const tokenName = `${data.module}:${data.name}`;
      if (this._options.tokenMap.has(tokenName)) {
        return resolve(this._options.tokenMap.get(tokenName));
      }

      if (
        Object.prototype.hasOwnProperty.call(this._options.modules, data.module)
      ) {
        const module = this._options.modules[data.module];
        if (data.isDefault) {
          return module;
        }
        if (!Object.prototype.hasOwnProperty.call(module, data.name)) {
          if (!data.isTypeOnly) {
            const equivalentTypeImport = formatImport({
              ...data,
              isTypeOnly: true
            });
            console.warn(
              `Module ${data.module} does not have a property ${data.name}; if it is type import,` +
                ` use \`${equivalentTypeImport}\` to avoid this warning.`
            );
          }
        }
        return resolve(module[data.name]);
      }

      const require = this._options.requirejs.require;
      try {
        require([data.module], (mod: any) => {
          if (data.unpack) {
            resolve(mod[data.name]);
          } else {
            resolve(mod);
          }
        }, (error: Error) => handleImportError(error, data));
      } catch (error) {
        handleImportError(error as Error, data);
        reject();
      }
    });
  }
}
