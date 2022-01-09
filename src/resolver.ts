import { Dialog, showDialog } from '@jupyterlab/apputils';

import { formatImportError } from './errors';

import { Token } from '@lumino/coreutils';

import { PathExt } from '@jupyterlab/coreutils';

import { IRequireJS } from './requirejs';

import { IModule, IModuleMember } from './types';

import { ServiceManager, Contents } from '@jupyterlab/services';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { formatCDNConsentDialog } from './dialogs';

function handleImportError(error: Error, module: string) {
  return showDialog({
    title: `Import in plugin code failed: ${error.message}`,
    body: formatImportError(error, module)
  });
}

export namespace ImportResolver {
  export interface IOptions {
    modules: Record<string, IModule>;
    tokenMap: Map<string, Token<any>>;
    requirejs: IRequireJS;
    settings: ISettingRegistry.ISettings;
    serviceManager: ServiceManager | null;
    dynamicLoader?: (transpiledCode: string) => Promise<IModule>;
    /**
     * Path of the module to load, used to resolve relative imports.
     */
    basePath: string | null;
  }
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
  async resolve(module: string): Promise<Token<any> | IModule | IModuleMember> {
    try {
      const tokenAndDefaultHandler = {
        get: (
          target: IModule,
          prop: string | number | symbol,
          receiver: any
        ) => {
          if (typeof prop !== 'string') {
            return Reflect.get(target, prop, receiver);
          }
          const tokenName = `${module}:${prop}`;
          if (this._options.tokenMap.has(tokenName)) {
            // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
            return this._options.tokenMap.get(tokenName)!;
          }
          // synthetic default import (without proxy)
          if (prop === 'default' && !(prop in target)) {
            return target;
          }
          return Reflect.get(target, prop, receiver);
        }
      };

      const knownModule = this._resolveKnownModule(module);
      if (knownModule !== null) {
        return new Proxy(knownModule, tokenAndDefaultHandler);
      }
      const localFile = await this._resolveLocalFile(module);
      if (localFile !== null) {
        return localFile;
      }

      const baseURL = this._options.settings.composite.requirejsCDN as string;
      const consent = await this._getCDNConsent(module, baseURL);

      if (!consent.agreed) {
        throw new Error(
          `Module ${module} requires execution from CDN but it is not allowed.`
        );
      }

      const externalAMDModule = await this._resolveAMDModule(module);
      if (externalAMDModule !== null) {
        return externalAMDModule;
      }
      throw new Error(`Could not resolve the module ${module}`);
    } catch (error) {
      handleImportError(error as Error, module);
      throw error;
    }
  }

  private async _getCDNConsent(
    module: string,
    cdnUrl: string
  ): Promise<ICDNConsent> {
    const allowCDN = this._options.settings.composite.allowCDN as CDNPolicy;
    switch (allowCDN) {
      case 'awaiting-decision': {
        const newPolicy = await askUserForCDNPolicy(module, cdnUrl);
        if (newPolicy === 'abort-to-investigate') {
          throw new Error('User aborted execution when asked about CDN policy');
        } else {
          await this._options.settings.set('allowCDN', newPolicy);
        }
        return await this._getCDNConsent(module, cdnUrl);
      }
      case 'never':
        console.warn(
          'Not loading the module ',
          module,
          'as it is not a known token/module and the CDN policy is set to `never`'
        );
        return { agreed: false };
      case 'always-insecure':
        return { agreed: true };
    }
  }

  private _resolveKnownModule(module: string): IModule | null {
    if (Object.prototype.hasOwnProperty.call(this._options.modules, module)) {
      return this._options.modules[module];
    }
    return null;
  }

  private async _resolveAMDModule(
    module: string
  ): Promise<IModule | IModuleMember | null> {
    const require = this._options.requirejs.require;
    return new Promise((resolve, reject) => {
      console.log('Fetching', module, 'via require.js');
      require([module], (mod: IModule) => {
        if (!mod) {
          reject(`Module ${module} could not be loaded via require.js`);
        }
        return resolve(mod);
      }, (error: Error) => {
        return reject(error);
      });
    });
  }

  private async _resolveLocalFile(
    module: string
  ): Promise<IModule | IModuleMember | null> {
    if (!module.startsWith('.')) {
      // not a local file, can't help here
      return null;
    }
    const serviceManager = this._options.serviceManager;
    if (serviceManager === null) {
      throw Error(
        `Cannot resolve import of local module ${module}: service manager is not available`
      );
    }
    if (!this._options.dynamicLoader) {
      throw Error(
        `Cannot resolve import of local module ${module}: dynamic loader is not available`
      );
    }
    const path = this._options.basePath;
    if (path === null) {
      throw Error(
        `Cannot resolve import of local module ${module}: the base path was not provided`
      );
    }
    const base = PathExt.dirname(path);
    const candidatePaths = [
      PathExt.join(base, module + '.ts'),
      PathExt.join(base, module + '.tsx')
    ];
    if (module.endsWith('.svg')) {
      candidatePaths.push(PathExt.join(base, module));
    }

    for (const candidatePath of candidatePaths) {
      const directory = await serviceManager.contents.get(
        PathExt.dirname(candidatePath)
      );
      const files = directory.content as Contents.IModel[];
      const filePaths = new Set(files.map(file => file.path));

      if (filePaths.has(candidatePath)) {
        console.log(`Resolved ${module} to ${candidatePath}`);
        const file = await serviceManager.contents.get(candidatePath);
        if (candidatePath.endsWith('.svg')) {
          return {
            default: file.content
          };
        }
        return await this._options.dynamicLoader(file.content);
      }
    }
    console.warn(
      `Could not resolve ${module}, candidate paths:`,
      candidatePaths
    );
    return null;
  }
}
