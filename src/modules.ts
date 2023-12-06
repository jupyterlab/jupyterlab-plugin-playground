import type { IModule } from './types';

export function loadKnownModule(name: string): Promise<IModule | null> {
  switch (name) {
    case '@jupyter-widgets/base':
      return import('@jupyter-widgets/base') as any;
    case '@jupyterlab/application':
      return import('@jupyterlab/application') as any;
    case '@jupyterlab/apputils':
      return import('@jupyterlab/apputils') as any;
    case '@jupyterlab/cell-toolbar':
      return import('@jupyterlab/cell-toolbar') as any;
    case '@jupyterlab/codeeditor':
      return import('@jupyterlab/codeeditor') as any;
    case '@jupyterlab/codemirror':
      return import('@jupyterlab/codemirror') as any;
    case '@jupyterlab/completer':
      return import('@jupyterlab/completer') as any;
    case '@jupyterlab/console':
      return import('@jupyterlab/console') as any;
    case '@jupyterlab/coreutils':
      return import('@jupyterlab/coreutils') as any;
    case '@jupyterlab/debugger':
      return import('@jupyterlab/debugger') as any;
    case '@jupyterlab/docmanager':
      return import('@jupyterlab/docmanager') as any;
    case '@jupyterlab/docregistry':
      return import('@jupyterlab/docregistry') as any;
    case '@jupyterlab/documentsearch':
      return import('@jupyterlab/documentsearch') as any;
    case '@jupyterlab/extensionmanager':
      return import('@jupyterlab/extensionmanager') as any;
    case '@jupyterlab/filebrowser':
      return import('@jupyterlab/filebrowser') as any;
    case '@jupyterlab/fileeditor':
      return import('@jupyterlab/fileeditor') as any;
    case '@jupyterlab/imageviewer':
      return import('@jupyterlab/imageviewer') as any;
    case '@jupyterlab/inspector':
      return import('@jupyterlab/inspector') as any;
    case '@jupyterlab/launcher':
      return import('@jupyterlab/launcher') as any;
    case '@jupyterlab/logconsole':
      return import('@jupyterlab/logconsole') as any;
    case '@jupyterlab/mainmenu':
      return import('@jupyterlab/mainmenu') as any;
    case '@jupyterlab/markdownviewer':
      return import('@jupyterlab/markdownviewer') as any;
    case '@jupyterlab/notebook':
      return import('@jupyterlab/notebook') as any;
    case '@jupyterlab/outputarea':
      return import('@jupyterlab/outputarea') as any;
    case '@jupyterlab/rendermime':
      return import('@jupyterlab/rendermime') as any;
    case '@jupyterlab/rendermime-interfaces':
      return import('@jupyterlab/rendermime-interfaces') as any;
    case '@jupyterlab/services':
      return import('@jupyterlab/services') as any;
    case '@jupyterlab/settingeditor':
      return import('@jupyterlab/settingeditor') as any;
    case '@jupyterlab/settingregistry':
      return import('@jupyterlab/settingregistry') as any;
    case '@jupyterlab/statedb':
      return import('@jupyterlab/statedb') as any;
    case '@jupyterlab/statusbar':
      return import('@jupyterlab/statusbar') as any;
    case '@jupyterlab/terminal':
      return import('@jupyterlab/terminal') as any;
    case '@jupyterlab/toc':
      return import('@jupyterlab/toc') as any;
    case '@jupyterlab/tooltip':
      return import('@jupyterlab/tooltip') as any;
    case '@jupyterlab/translation':
      return import('@jupyterlab/translation') as any;
    case '@jupyterlab/ui-components':
      return import('@jupyterlab/ui-components') as any;
    case '@lumino/algorithm':
      return import('@lumino/algorithm') as any;
    case '@lumino/application':
      return import('@lumino/application') as any;
    case '@lumino/commands':
      return import('@lumino/commands') as any;
    case '@lumino/coreutils':
      return import('@lumino/coreutils') as any;
    case '@lumino/datagrid':
      return import('@lumino/datagrid') as any;
    case '@lumino/disposable':
      return import('@lumino/disposable') as any;
    case '@lumino/domutils':
      return import('@lumino/domutils') as any;
    case '@lumino/dragdrop':
      return import('@lumino/dragdrop') as any;
    case '@lumino/messaging':
      return import('@lumino/messaging') as any;
    case '@lumino/properties':
      return import('@lumino/properties') as any;
    case '@lumino/signaling':
      return import('@lumino/signaling') as any;
    case '@lumino/virtualdom':
      return import('@lumino/virtualdom') as any;
    case '@lumino/widgets':
      return import('@lumino/widgets') as any;
    case 'react':
      return import('react') as any;
    case 'react-dom':
      return import('react-dom') as any;
    default:
      return Promise.resolve(null);
  }
}
