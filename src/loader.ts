import ts from 'typescript';
import { Token } from '@lumino/coreutils';
import { IPlugin } from '@lumino/application';

/**
 * Internal representation of import statments.
 */
interface IImportedName {
  importedName: string;
  module: string;
}

function escape(x: string): string {
  return x.replace(/(['\\])/g, '\\$1');
}

namespace PluginLoader {
  export interface IOptions {
    compilerOptions: ts.CompilerOptions & { target: ts.ScriptTarget };
    modules: Record<string, any>;
    tokenMap: Map<string, Token<any>>;
  }
}

const AsyncFunction = Object.getPrototypeOf(async () => {
  // no-op
}).constructor;

export class PluginLoader {
  private _options: PluginLoader.IOptions;
  private _modulesArgumentName = '_PLUGIN_PLAYGROUND_MODULES';

  constructor(options: PluginLoader.IOptions) {
    this._options = options;
  }

  protected transpile(code: string): string {
    const result = ts.transpileModule(code, {
      compilerOptions: this._options.compilerOptions,
      transformers: {
        before: [this._importTransformer(), this.exportDefaultTransformer()]
      }
    });
    // Module rules add empty `export` even after we replaced it in AST,
    /// so we need to remove it from the final string.
    return result.outputText.replace('export {};', '');
  }

  /**
   * Create a plugin from TypeScript code.
   */
  async load(code: string): Promise<IPlugin<any, any>> {
    const functionBody = this.transpile(code);
    console.log(functionBody);
    let plugin;

    try {
      plugin = await new AsyncFunction(this._modulesArgumentName, functionBody)(
        this._options.modules
      );
      // no export/return statment
      if (plugin == null) {
        // for compatibility with older version
        console.log(
          'No value was returned by the transpiled plugin, falling back to simpler legacy evaluation'
        );
        plugin = new Function(`'use strict';return (${code})`)();
      }
    } catch (e) {
      alert(`Problem loading extension: ${e}

        ${functionBody}`);
      throw e;
    }

    // We allow one level of indirection (return a function instead of a plugin)
    if (typeof plugin === 'function') {
      plugin = plugin();
    }

    // Finally, we allow returning a promise (or an async function above).
    plugin = (await Promise.resolve(plugin)) as IPlugin<any, any>;

    plugin.requires = plugin.requires?.map((value: any) => {
      const token = this._options.tokenMap.get(value);
      if (!token) {
        throw Error('Required token' + value + 'not found in the token map');
      }
      return token;
    });
    plugin.optional = plugin.optional
      ?.map((value: any) => {
        const token = this._options.tokenMap.get(value);
        if (!token) {
          console.log('Optional token' + value + 'not found in the token map');
        }
        return token;
      })
      .filter((token): token is Token<any> => token != null);
    return plugin;
  }

  private _collectImports(node: ts.ImportDeclaration): IImportedName[] {
    if (!ts.isStringLiteral(node.moduleSpecifier)) {
      return [];
    }
    const module = node.moduleSpecifier.text;

    if (!node.importClause || !node.importClause.namedBindings) {
      return [];
    }
    const bindings = node.importClause.namedBindings;
    if (!ts.isNamedImports(bindings)) {
      return [];
    }
    return bindings.elements.map(importedNameNode => {
      return {
        importedName: importedNameNode.name.text,
        module: module
      };
    });
  }

  private _nodesFromString(code: string): ts.Node[] {
    // new lines make reading the code easier when debugging plugins
    const sourceFile = ts.createSourceFile(
      'temporary.ts',
      '\n' + code + '\n',
      this._options.compilerOptions.target
    );
    return [...sourceFile.statements];
  }

  private _createImportFromWithRequireJS(
    importedName: string,
    importFrom: string
  ): ts.Node[] {
    // Instead of manually creating the nodes we create the AST
    // pretending it is a source file (which might be less performant,
    // but better from maintenance perspective).
    const from = escape(importFrom);
    const name = escape(importedName); // this should not be neeed
    return this._nodesFromString(`
        const ${name} = await new Promise((resolve, reject) => {
            try {
                require(['${from}'], function(mod) {
                    resolve(mod['${name}']);
                }, function(error) {
                    const hint = '';
                    alert('Could not import ${from} from ${name}: ' + error + hint);
                });
            } catch (error) {
                const hint = '';
                alert('Could not import ${from} from ${name}: ' + error + hint);
                reject();
            }
        });`);
  }

  private _createStringAssignment(
    variableName: string,
    variableValue: string
  ): ts.VariableStatement {
    return ts.factory.createVariableStatement(
      /* modifiers */ [],
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            variableName,
            /* exclamation */ undefined,
            /* type */ undefined,
            ts.factory.createStringLiteral(variableValue)
          )
        ],
        ts.NodeFlags.Const
      )
    );
  }

  private _createImportFromKnownModule(
    importedName: string,
    importFrom: string
  ): ts.Node[] {
    const from = escape(importFrom);
    const name = escape(importedName); // this should not be neeed
    return this._nodesFromString(
      `const ${name} = ${this._modulesArgumentName}['${from}']['${name}'];`
    );
  }

  /**
   * Convert import to:
   *   - token assignment if appropriate token is available,
   *   - module assignment if appropriate module is available,
   *   - requirejs import if everything else fails
   */
  private _importTransformer<T extends ts.Node>(): ts.TransformerFactory<T> {
    return context => {
      const visit: ts.Visitor = node => {
        if (ts.isImportDeclaration(node)) {
          const detectedImports = this._collectImports(node);

          if (!detectedImports) {
            alert('Unsupported import encountered: ' + node.getFullText());
            console.error('Unsupported import:', node.getFullText(), node);
            // return createImportFromWithRequireJS(candidateToken.importedName, candidateToken.module);
            return ts.visitEachChild(node, child => visit(child), context);
          }

          return ([] as ts.Node[]).concat(
            ...detectedImports.map(importData => {
              const tokenName = `${importData.module}:${importData.importedName}`;
              if (this._options.tokenMap.has(tokenName)) {
                return [
                  this._createStringAssignment(
                    importData.importedName,
                    tokenName
                  )
                ];
              }
              if (
                Object.prototype.hasOwnProperty.call(
                  this._options.modules,
                  importData.module
                )
              ) {
                return this._createImportFromKnownModule(
                  importData.importedName,
                  importData.module
                );
              }
              return this._createImportFromWithRequireJS(
                importData.importedName,
                importData.module
              );
            })
          );
        } else {
          return ts.visitEachChild(node, child => visit(child), context);
        }
      };

      return node => ts.visitNode(node, visit);
    };
  }

  private exportDefaultTransformer<
    T extends ts.Node
  >(): ts.TransformerFactory<T> {
    return context => {
      const visit: ts.Visitor = node => {
        if (ts.isExportSpecifier(node)) {
          console.log('TODO: export specifier', node, ts.isDefaultClause(node));
        }
        if (ts.isExportDeclaration(node)) {
          console.log(
            'TODO: export declaration',
            node,
            ts.isDefaultClause(node)
          );
        }

        if (ts.isExportAssignment(node)) {
          return ts.factory.createReturnStatement(node.expression);
        } else {
          return ts.visitEachChild(node, child => visit(child), context);
        }
      };

      return node => ts.visitNode(node, visit);
    };
  }
}
