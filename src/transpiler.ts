import ts from 'typescript';

export class NoDefaultExportError extends Error {
  // no-op
}

export namespace PluginTranspiler {
  export interface IOptions {
    compilerOptions: ts.CompilerOptions & { target: ts.ScriptTarget };
  }
  /**
   * Representation of a single imported value.
   */
  export interface IImportStatement {
    name: string;
    alias?: string;
    module: string;
    unpack: boolean;
    isTypeOnly: boolean;
    isDefault?: boolean;
  }
}

export class PluginTranspiler {
  private _options: PluginTranspiler.IOptions;
  readonly importFunctionName = '_PLUGIN_IMPORT';

  constructor(options: PluginTranspiler.IOptions) {
    this._options = options;
  }

  /**
   * Transpile an ES6 plugin into a function body of an async function,
   * returning the plugin that would be exported as default.
   */
  transpile(code: string): string {
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

  private _collectImports(
    node: ts.ImportDeclaration
  ): PluginTranspiler.IImportStatement[] {
    if (!ts.isStringLiteral(node.moduleSpecifier)) {
      return [];
    }
    const module = node.moduleSpecifier.text;
    const clause = node.importClause;

    if (!clause) {
      return [];
    }
    if (!clause.namedBindings) {
      if (clause.name) {
        return [
          {
            // import bqplot from 'bqplot@*/dist/index';
            name: clause.name.text,
            module: module,
            unpack: false,
            isTypeOnly: clause.isTypeOnly,
            isDefault: true
          }
        ];
      } else {
        return [];
      }
    }
    const bindings = clause.namedBindings;
    if (ts.isNamespaceImport(bindings)) {
      return [
        {
          // import * as bqplot from 'bqplot@*/dist/index';
          name: bindings.name.text,
          module: module,
          unpack: false,
          isTypeOnly: clause.isTypeOnly
        }
      ];
    }
    if (!ts.isNamedImports(bindings)) {
      return [];
    }
    return bindings.elements.map(binding => {
      return binding.propertyName
        ? {
            // import { ICommandPalette as x } from '@jupyterlab/apputils';
            name: binding.propertyName.text,
            alias: binding.name.text,
            module: module,
            unpack: true,
            isTypeOnly: clause.isTypeOnly
          }
        : {
            // import { ICommandPalette } from '@jupyterlab/apputils';
            name: binding.name.text,
            module: module,
            unpack: true,
            isTypeOnly: clause.isTypeOnly
          };
    });
  }

  /**
   * Instead of manually creating the nodes we create the AST from string
   * pretending it is a source file (which might be less performant,
   * but easier to maintain).
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

  private _createImportFunctionCall(
    data: PluginTranspiler.IImportStatement
  ): ts.Node[] {
    const name = data.alias ? data.alias : data.name;
    const dataJSON = JSON.stringify(data);
    return this._nodesFromString(`
        const ${name} = await ${this.importFunctionName}(${dataJSON})`);
  }

  private _importTransformer<T extends ts.Node>(): ts.TransformerFactory<T> {
    return context => {
      const visit: ts.Visitor = node => {
        if (ts.isImportDeclaration(node)) {
          const detectedImports = this._collectImports(node);

          if (!detectedImports || !detectedImports.length) {
            alert('Unsupported import encountered: ' + node.getFullText());
            console.error('Unsupported import:' + node.getFullText(), node);
            return ts.visitEachChild(node, child => visit(child), context);
          }

          return ([] as ts.Node[]).concat(
            ...detectedImports.map(data => this._createImportFunctionCall(data))
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