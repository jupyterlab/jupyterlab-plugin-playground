import { Dialog, showDialog } from '@jupyterlab/apputils';

import { PluginTranspiler } from './transpiler';

import { formatImportError } from './errors';

import { Token } from '@lumino/coreutils';

import { PathExt } from '@jupyterlab/coreutils';

import { IRequireJS } from './requirejs';

import { IModule, IModuleMember } from './types';

import { IDocumentManager } from '@jupyterlab/docmanager';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { formatCDNConsentDialog } from './dialogs';

type IImportStatement = PluginTranspiler.IImportStatement;

function handleImportError(error: Error, data: IImportStatement) {
  return showDialog({
    title: `Import in plugin code failed: ${error.message}`,
    body: formatImportError(error, data)
  });
}

export namespace ImportResolver {
  export interface IOptions {
    modules: Record<string, IModule>;
    tokenMap: Map<string, Token<any>>;
    requirejs: IRequireJS;
    settings: ISettingRegistry.ISettings;
    documentManager: IDocumentManager | null;
    dynamicLoader?: (transpiledCode: string) => Promise<IModule>;
    /**
     * Path of the module to load, used to resolve relative imports.
     */
    basePath: string | null;
  }
}

function formatImport(data: IImportStatement): string {
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

type CDNPolicy = 'awaiting-decision' | 'always-insecure' | 'never';

async function askUserForCDNPolicy(
  exampleModule: string,
  cdnUrl: string
): Promise<CDNPolicy | 'abort-to-investigate'> {
  const decision = await showDialog({
    title: 'Allow execution of code from CDN?',
    body: formatCDNConsentDialog(exampleModule, cdnUrl),
    buttons: [
      Dialog.okButton({
        label: 'Forbid'
      }),
      Dialog.cancelButton({
        label: 'Abort'
      }),
      Dialog.warnButton({
        label: 'Allow'
      })
    ],
    defaultButton: 0
  });
  switch (decision.button.label) {
    case 'Forbid':
      return 'never';
    case 'Allow':
      return 'always-insecure';
    case 'Abort':
      return 'abort-to-investigate';
    default:
      return 'awaiting-decision';
  }
}

interface ICDNConsent {
  readonly agreed: boolean;
}

export class ImportResolver {
  constructor(private _options: ImportResolver.IOptions) {
    // no-op
  }

  set dynamicLoader(loader: (transpiledCode: string) => Promise<IModule>) {
    this._options.dynamicLoader = loader;
  }

  /**
   * Convert import to:
   *   - token string,
   *   - module assignment if appropriate module is available,
   *   - requirejs import if everything else fails
   */
  async resolve(
    data: IImportStatement
  ): Promise<Token<any> | IModule | IModuleMember> {
    try {
      const token = this._resolveToken(data);
      if (token !== null) {
        return token;
      }
      const knownModule = this._resolveKnownModule(data);
      if (knownModule !== null) {
        return knownModule;
      }
      const localFile = await this._resolveLocalFile(data);
      if (localFile !== null) {
        return localFile;
      }

      const baseURL = this._options.settings.composite.requirejsCDN as string;
      const consent = await this._getCDNConsent(data, baseURL);

      if (!consent.agreed) {
        throw new Error(
          `Module ${data.module} requires execution from CDN but it is not allowed.`
        );
      }

      const externalAMDModule = await this._resolveAMDModule(data);
      if (externalAMDModule !== null) {
        return externalAMDModule;
      }
      throw new Error(`Could not resolve the module ${data.module}`);
    } catch (error) {
      handleImportError(error as Error, data);
      throw error;
    }
  }

  private async _getCDNConsent(
    data: PluginTranspiler.IImportStatement,
    cdnUrl: string
  ): Promise<ICDNConsent> {
    const allowCDN = this._options.settings.composite.allowCDN as CDNPolicy;
    switch (allowCDN) {
      case 'awaiting-decision': {
        const newPolicy = await askUserForCDNPolicy(data.module, cdnUrl);
        if (newPolicy === 'abort-to-investigate') {
          throw new Error('User aborted execution when asked about CDN policy');
        } else {
          await this._options.settings.set('allowCDN', newPolicy);
        }
        return await this._getCDNConsent(data, cdnUrl);
      }
      case 'never':
        console.warn(
          'Not loading the module ',
          data,
          'as it is not a known token/module and the CDN policy is set to `never`'
        );
        return { agreed: false };
      case 'always-insecure':
        return { agreed: true };
    }
  }

  private _resolveToken(data: IImportStatement): Token<any> | null {
    const tokenName = `${data.module}:${data.name}`;
    if (this._options.tokenMap.has(tokenName)) {
      // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
      return this._options.tokenMap.get(tokenName)!;
    }
    return null;
  }

  private _resolveKnownModule(
    data: IImportStatement
  ): IModule | IModuleMember | null {
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
      return module[data.name];
    }
    return null;
  }

  private async _resolveAMDModule(
    data: IImportStatement
  ): Promise<IModule | IModuleMember | null> {
    const require = this._options.requirejs.require;
    return new Promise((resolve, reject) => {
      require([data.module], (mod: IModule) => {
        if (data.unpack) {
          return resolve(mod[data.name]);
        } else {
          return resolve(mod);
        }
      }, (error: Error) => {
        return reject(error);
      });
    });
  }

  private async _resolveLocalFile(
    data: IImportStatement
  ): Promise<IModule | IModuleMember | null> {
    if (!data.module.startsWith('.')) {
      // not a local file, can't help here
      return null;
    }
    const documentManager = this._options.documentManager;
    if (documentManager === null) {
      throw Error(
        `Cannot resolve import of local module ${data.module}: document manager is not available`
      );
    }
    if (!this._options.dynamicLoader) {
      throw Error(
        `Cannot resolve import of local module ${data.module}: dynamic loader is not available`
      );
    }
    const path = this._options.basePath;
    if (path === null) {
      throw Error(
        `Cannot resolve import of local module ${data.module}: the base path was not provided`
      );
    }
    const file = await documentManager.services.contents.get(
      PathExt.join(PathExt.dirname(path), data.module + '.ts')
    );

    const module = await this._options.dynamicLoader(file.content);

    if (data.isDefault) {
      return module.default;
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
    return module[data.name];
  }
}
