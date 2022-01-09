import ts from 'typescript';

export class NoDefaultExportError extends Error {
  // no-op
}

export namespace PluginTranspiler {
  export interface IOptions {
    compilerOptions: ts.CompilerOptions & { target: ts.ScriptTarget };
  }
}

export class PluginTranspiler {
  private _options: PluginTranspiler.IOptions;
  readonly importFunctionName = 'require';

  constructor(options: PluginTranspiler.IOptions) {
    this._options = options;
    if (options.compilerOptions.module) {
      throw new Error(
        'The module setting is an implementation detail of transpiler.'
      );
    }
  }

  /**
   * Transpile an ES6 plugin into a function body of an async function,
   * returning the plugin that would be exported as default.
   */
  transpile(code: string, requireDefaultExport: boolean): string {
    const result = ts.transpileModule(code, {
      compilerOptions: {
        ...this._options.compilerOptions,
        module: ts.ModuleKind.CommonJS
      },
      transformers: {
        before: requireDefaultExport
          ? [this._requireDefaultExportTransformer()]
          : []
      }
    });
    const body = result.outputText.replace(/ require\(/g, ' await require(');
    return `'use strict';\nconst exports = {};\n${body}\nreturn exports;`;
  }

  private _requireDefaultExportTransformer(): ts.TransformerFactory<ts.SourceFile> {
    return context => {
      let defaultExport: ts.Expression | null = null;

      const visit: ts.Visitor = node => {
        // default export
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
        }
        return ts.visitEachChild(node, child => visit(child), context);
      };

      return source => {
        const traveresed = ts.visitNode(source, visit);
        if (!defaultExport) {
          throw new NoDefaultExportError('Default export not found');
        }
        return traveresed;
      };
    };
  }
}
