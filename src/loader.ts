import ts from 'typescript';
import { Token } from '@lumino/coreutils';
import { IPlugin } from '@lumino/application';

function escape(x: string): string {
  return x.replace(/(['\\])/g, '\\$1');
}

function isString(value: any): value is string {
  return typeof value === 'string' || value instanceof String;
}

class NoDefaultExportError extends Error {
  // no-op
}

export class PluginLoadingError extends Error {
  constructor(
    public error: Error,
    public partialResult: Omit<PluginLoader.IResult, 'plugin'>
  ) {
    super();
  }
}

export namespace PluginLoader {
  export interface IOptions {
    compilerOptions: ts.CompilerOptions & { target: ts.ScriptTarget };
    modules: Record<string, any>;
    tokenMap: Map<string, Token<any>>;
    importFunction(statement: PluginLoader.IImportStatement): any;
  }
  export interface IResult {
    plugin: IPlugin<any, any>;
    code: string;
    transpiled: boolean;
  }
  /**
   * Internal representation of import statments.
   */
  export interface IImportStatement {
    name: string;
    alias?: string;
    module: string;
    unpack: boolean;
  }
}

const AsyncFunction = Object.getPrototypeOf(async () => {
  // no-op
}).constructor;

export class PluginLoader {
  private _options: PluginLoader.IOptions;
  private _modulesArgumentName = '_PLUGIN_PLAYGROUND_MODULES';
  private _importFunctionName = '_PLUGIN_IMPORT';

  constructor(options: PluginLoader.IOptions) {
    this._options = options;
  }

  protected transpile(code: string): string {
    const result = ts.transpileModule(code, {
      compilerOptions: this._options.compilerOptions,
      transformers: {
        before: [this._importTransformer(), this._exportDefaultTransformer()]
      }
    });
    // Module rules add empty `export` even after we replaced it in AST,
    /// so we need to remove it from the final string.
    return result.outputText.replace('export {};', '');
  }

  /**
   * Create a plugin from TypeScript code.
   */
  async load(code: string): Promise<PluginLoader.IResult> {
    let functionBody: string;
    let plugin;
    let transpiled = true;
    try {
      functionBody = this.transpile(code);
    } catch (error) {
      if (error instanceof NoDefaultExportError) {
        // no export statment
        // for compatibility with older version
        console.log(
          'No value was returned by the transpiled plugin, falling back to simpler legacy evaluation'
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
          this._modulesArgumentName,
          this._importFunctionName,
          functionBody
        )(this._options.modules, this._options.importFunction);
      } else {
        plugin = new Function(functionBody)();
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

  private _collectImports(
    node: ts.ImportDeclaration
  ): PluginLoader.IImportStatement[] {
    if (!ts.isStringLiteral(node.moduleSpecifier)) {
      return [];
    }
    const module = node.moduleSpecifier.text;
    const importClause = node.importClause;

    if (!importClause) {
      return [];
    }
    if (!importClause.namedBindings) {
      if (importClause.name) {
        return [
          {
            name: importClause.name.text,
            module: module,
            unpack: false
          }
        ];
      } else {
        return [];
      }
    }
    const bindings = importClause.namedBindings;
    if (!ts.isNamedImports(bindings)) {
      return [];
    }
    return bindings.elements.map(importedNameNode => {
      return {
        name: importedNameNode.name.text,
        module: module,
        unpack: true
      };
    });
  }

  /**
   * Instead of manually creating the nodes we create the AST from string
   * pretending it is a source file (which might be less performant,
   * but better easier to maintain).
   */
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
    data: PluginLoader.IImportStatement
  ): ts.Node[] {
    // TODO: raise if not a valide name:
    const name = data.alias ? data.alias : data.name;
    const dataJSON = JSON.stringify(data);
    return this._nodesFromString(`
        const ${name} = await ${this._importFunctionName}(${dataJSON})`);
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
    data: PluginLoader.IImportStatement
  ): ts.Node[] {
    const from = escape(data.module);
    const name = data.alias ? data.alias : data.name;
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

          if (!detectedImports || !detectedImports.length) {
            alert('Unsupported import encountered: ' + node.getFullText());
            console.error('Unsupported import:' + node.getFullText(), node);
            // return createImportFromWithRequireJS(candidateToken.importedName, candidateToken.module);
            return ts.visitEachChild(node, child => visit(child), context);
          }

          return ([] as ts.Node[]).concat(
            ...detectedImports.map(data => {
              const tokenName = `${data.module}:${data.name}`;
              if (this._options.tokenMap.has(tokenName)) {
                return [this._createStringAssignment(data.name, tokenName)];
              }
              if (
                Object.prototype.hasOwnProperty.call(
                  this._options.modules,
                  data.module
                )
              ) {
                return this._createImportFromKnownModule(data);
              }
              node.decorators;
              return this._createImportFromWithRequireJS(data);
            })
          );
        } else {
          return ts.visitEachChild(node, child => visit(child), context);
        }
      };

      return node => ts.visitNode(node, visit);
    };
  }

  private _exportDefaultTransformer(): ts.TransformerFactory<ts.SourceFile> {
    return context => {
      let defaultExport: ts.Expression | null = null;

      const visit: ts.Visitor = node => {
        if (ts.isExportSpecifier(node)) {
          console.warn(
            'Export specifier not supported: ' + node.getText(),
            node
          );
          return;
        }
        if (ts.isExportDeclaration(node)) {
          console.warn(
            'Export declaration not supported: ' + node.getText(),
            node
          );
          return;
        }

        if (ts.isExportAssignment(node)) {
          const hasDefaultClause = node
            .getChildren()
            .some(node => node.kind === ts.SyntaxKind.DefaultKeyword);
          if (hasDefaultClause) {
            defaultExport = node.expression;
          } else {
            console.warn(
              'Export assignment without default keyword not supported: ' +
                node.getText(),
              node
            );
          }
          return;
        } else {
          return ts.visitEachChild(node, child => visit(child), context);
        }
      };

      return source => {
        const withoutExports = ts.visitNode(source, visit);
        if (!defaultExport) {
          throw new NoDefaultExportError('Default export not found');
        }
        return ts.factory.updateSourceFile(withoutExports, [
          // original statements
          ...withoutExports.statements,
          // the default export as returned value
          ts.factory.createReturnStatement(defaultExport)
        ]);
      };
    };
  }
}
