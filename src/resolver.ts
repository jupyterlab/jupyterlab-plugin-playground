import { Dialog, showDialog, InputDialog } from '@jupyterlab/apputils';

import { PluginTranspiler } from './transpiler';

import { formatImportError } from './errors';

import { Token } from '@lumino/coreutils';

import { IRequireJS } from './requirejs';

import { IModule, IModuleMember } from './types';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { formatCDNConsentDialog } from './dialogs';

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
    modules: Record<string, IModule>;
    tokenMap: Map<string, Token<any>>;
    requirejs: IRequireJS;
    settings: ISettingRegistry.ISettings;
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

type CDNPolicy =
  | 'awaiting-decision'
  | 'always-insecure'
  | 'never'
  | 'only-trusted-packages';

async function askUserForIntegrity(
  module: string,
  baseURL: string
): Promise<string | null> {
  return (
    await InputDialog.getText({
      title: `Please provide SRI string for ${module}`,
      label: `Current CDN policy requires a sub-resource integrity value to run ${module} from ${baseURL}${module}.
        Please provide a value with 'sha256', 'sha384', or 'sha512' prefix. 
        `,
      placeholder: 'sha384-'
    })
  ).value;
}

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
      Dialog.okButton({
        label: 'Require SRI'
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
    case 'Require SRI':
      return 'only-trusted-packages';
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

// class RemoteImportResolver

export class ImportResolver {
  constructor(private _options: ImportResolver.IOptions) {
    // no-op
  }
  /**
   * Convert import to:
   *   - token string,
   *   - module assignment if appropriate module is available,
   *   - requirejs import if everything else fails
   */
  async resolve(
    data: PluginTranspiler.IImportStatement
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

      const baseURL = this._options.settings.composite.requirejsCDN as string;
      const consent = await this._getCDNConsent(data, baseURL);

      if (!consent.agreed) {
        throw new Error(
          `Module ${data.module} requires execution from CDN but it is not allowed.`
        );
      }

      const externalAMDModule = this._resolveAMDModule(data);
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
    const trustedPackages = this._options.settings.composite
      .trustedCDNPackages as any as Record<string, string>;
    switch (allowCDN) {
      case 'awaiting-decision': {
        const newPolicy = await askUserForCDNPolicy(data.module, cdnUrl);
        if (newPolicy === 'abort-to-investigate') {
          throw new Error('User aborted execution when asked about CDN policy');
        } else {
          this._options.settings.set('allowCDN', newPolicy);
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
      case 'only-trusted-packages': {
        let wasIntegrityDefined = Object.prototype.hasOwnProperty.call(
          trustedPackages,
          data.module
        );
        if (!wasIntegrityDefined) {
          const sri = await askUserForIntegrity(data.module, cdnUrl);
          if (sri) {
            trustedPackages[data.module] = sri;
            this._options.settings.set('trustedCDNPackages', trustedPackages);
            wasIntegrityDefined = true;
          }
          console.log(wasIntegrityDefined);
        }
        return { agreed: wasIntegrityDefined };
      }
      case 'always-insecure':
        return { agreed: true };
    }
  }

  private _resolveToken(
    data: PluginTranspiler.IImportStatement
  ): Token<any> | null {
    const tokenName = `${data.module}:${data.name}`;
    if (this._options.tokenMap.has(tokenName)) {
      // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
      return this._options.tokenMap.get(tokenName)!;
    }
    return null;
  }

  private _resolveKnownModule(
    data: PluginTranspiler.IImportStatement
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

  private _resolveAMDModule(data: PluginTranspiler.IImportStatement): any {
    const require = this._options.requirejs.require;
    return require([data.module], (mod: any) => {
      if (data.unpack) {
        return mod[data.name];
      } else {
        return mod;
      }
    }, (error: Error) => {
      throw error;
    });
  }
}
