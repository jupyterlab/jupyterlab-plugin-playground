/// <reference types="requirejs" />
import requireJsSource from '!!raw-loader!../node_modules/requirejs/require.js';

export interface IRequireJS {
  readonly require: Require;
  readonly define: RequireDefine;
}

/**
 * Load requirejs in an iframe to avoid polution of `window` object.
 */
export async function loadInIsolated(source: string): Promise<IRequireJS> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.onload = () => {
      const contentWindow = iframe.contentWindow;
      if (!contentWindow) {
        reject('Cannot load in isolated: no contentWindow, origin error?');
        return;
      }
      const iframeWindow = contentWindow.window;
      // execure require JS
      iframeWindow.eval(source);
      const requirejs = {
        require: (iframeWindow as any).require,
        define: (iframeWindow as any).define
      };
      if (requirejs.require && requirejs.define) {
        resolve(requirejs);
      } else {
        reject(
          'Require.js loading did not result in `require` and `define` objects attachment to window'
        );
      }
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
      iframe.onload = null;
    };
    document.body.appendChild(iframe);
  });
}

export class RequireJSLoader {
  async load(): Promise<IRequireJS> {
    return await loadInIsolated(requireJsSource);
  }
}
