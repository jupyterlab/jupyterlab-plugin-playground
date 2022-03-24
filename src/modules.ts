import * as jupyter_widgets_base from '@jupyter-widgets/base';
import * as jupyterlab_application from '@jupyterlab/application';
import * as jupyterlab_apputils from '@jupyterlab/apputils';
import * as jupyterlab_codeeditor from '@jupyterlab/codeeditor';
import * as jupyterlab_codemirror from '@jupyterlab/codemirror';
import * as jupyterlab_completer from '@jupyterlab/completer';
import * as jupyterlab_console from '@jupyterlab/console';
import * as jupyterlab_coreutils from '@jupyterlab/coreutils';
import * as jupyterlab_debugger from '@jupyterlab/debugger';
import * as jupyterlab_docmanager from '@jupyterlab/docmanager';
import * as jupyterlab_docprovider from '@jupyterlab/docprovider';
import * as jupyterlab_docregistry from '@jupyterlab/docregistry';
import * as jupyterlab_documentsearch from '@jupyterlab/documentsearch';
import * as jupyterlab_extensionmanager from '@jupyterlab/extensionmanager';
import * as jupyterlab_filebrowser from '@jupyterlab/filebrowser';
import * as jupyterlab_fileeditor from '@jupyterlab/fileeditor';
import * as jupyterlab_imageviewer from '@jupyterlab/imageviewer';
import * as jupyterlab_inspector from '@jupyterlab/inspector';
import * as jupyterlab_launcher from '@jupyterlab/launcher';
import * as jupyterlab_logconsole from '@jupyterlab/logconsole';
import * as jupyterlab_mainmenu from '@jupyterlab/mainmenu';
import * as jupyterlab_markdownviewer from '@jupyterlab/markdownviewer';
import * as jupyterlab_notebook from '@jupyterlab/notebook';
import * as jupyterlab_outputarea from '@jupyterlab/outputarea';
import * as jupyterlab_rendermime from '@jupyterlab/rendermime';
import * as jupyterlab_rendermime_interfaces from '@jupyterlab/rendermime-interfaces';
import * as jupyterlab_services from '@jupyterlab/services';
import * as jupyterlab_settingeditor from '@jupyterlab/settingeditor';
import * as jupyterlab_settingregistry from '@jupyterlab/settingregistry';
import * as jupyterlab_shared_models from '@jupyterlab/shared-models';
import * as jupyterlab_statedb from '@jupyterlab/statedb';
import * as jupyterlab_statusbar from '@jupyterlab/statusbar';
import * as jupyterlab_terminal from '@jupyterlab/terminal';
import * as jupyterlab_toc from '@jupyterlab/toc';
import * as jupyterlab_tooltip from '@jupyterlab/tooltip';
import * as jupyterlab_translation from '@jupyterlab/translation';
import * as jupyterlab_ui_components from '@jupyterlab/ui-components';
import * as lumino_algorithm from '@lumino/algorithm';
import * as lumino_application from '@lumino/application';
import * as lumino_commands from '@lumino/commands';
import * as lumino_coreutils from '@lumino/coreutils';
import * as lumino_datagrid from '@lumino/datagrid';
import * as lumino_disposable from '@lumino/disposable';
import * as lumino_domutils from '@lumino/domutils';
import * as lumino_dragdrop from '@lumino/dragdrop';
import * as lumino_messaging from '@lumino/messaging';
import * as lumino_properties from '@lumino/properties';
import * as lumino_signaling from '@lumino/signaling';
import * as lumino_virtualdom from '@lumino/virtualdom';
import * as lumino_widgets from '@lumino/widgets';
import * as react from 'react';
import * as react_dom from 'react-dom';

export const modules = {
  '@jupyter-widgets/base': jupyter_widgets_base,
  '@jupyterlab/application': jupyterlab_application,
  '@jupyterlab/apputils': jupyterlab_apputils,
  '@jupyterlab/codeeditor': jupyterlab_codeeditor,
  '@jupyterlab/codemirror': jupyterlab_codemirror,
  '@jupyterlab/completer': jupyterlab_completer,
  '@jupyterlab/console': jupyterlab_console,
  '@jupyterlab/coreutils': jupyterlab_coreutils,
  '@jupyterlab/debugger': jupyterlab_debugger,
  '@jupyterlab/docmanager': jupyterlab_docmanager,
  '@jupyterlab/docprovider': jupyterlab_docprovider,
  '@jupyterlab/docregistry': jupyterlab_docregistry,
  '@jupyterlab/documentsearch': jupyterlab_documentsearch,
  '@jupyterlab/extensionmanager': jupyterlab_extensionmanager,
  '@jupyterlab/filebrowser': jupyterlab_filebrowser,
  '@jupyterlab/fileeditor': jupyterlab_fileeditor,
  '@jupyterlab/imageviewer': jupyterlab_imageviewer,
  '@jupyterlab/inspector': jupyterlab_inspector,
  '@jupyterlab/launcher': jupyterlab_launcher,
  '@jupyterlab/logconsole': jupyterlab_logconsole,
  '@jupyterlab/mainmenu': jupyterlab_mainmenu,
  '@jupyterlab/markdownviewer': jupyterlab_markdownviewer,
  '@jupyterlab/notebook': jupyterlab_notebook,
  '@jupyterlab/outputarea': jupyterlab_outputarea,
  '@jupyterlab/rendermime': jupyterlab_rendermime,
  '@jupyterlab/rendermime-interfaces': jupyterlab_rendermime_interfaces,
  '@jupyterlab/services': jupyterlab_services,
  '@jupyterlab/settingeditor': jupyterlab_settingeditor,
  '@jupyterlab/settingregistry': jupyterlab_settingregistry,
  '@jupyterlab/shared-models': jupyterlab_shared_models,
  '@jupyterlab/statedb': jupyterlab_statedb,
  '@jupyterlab/statusbar': jupyterlab_statusbar,
  '@jupyterlab/terminal': jupyterlab_terminal,
  '@jupyterlab/toc': jupyterlab_toc,
  '@jupyterlab/tooltip': jupyterlab_tooltip,
  '@jupyterlab/translation': jupyterlab_translation,
  '@jupyterlab/ui-components': jupyterlab_ui_components,
  '@lumino/algorithm': lumino_algorithm,
  '@lumino/application': lumino_application,
  '@lumino/commands': lumino_commands,
  '@lumino/coreutils': lumino_coreutils,
  '@lumino/datagrid': lumino_datagrid,
  '@lumino/disposable': lumino_disposable,
  '@lumino/domutils': lumino_domutils,
  '@lumino/dragdrop': lumino_dragdrop,
  '@lumino/messaging': lumino_messaging,
  '@lumino/properties': lumino_properties,
  '@lumino/signaling': lumino_signaling,
  '@lumino/virtualdom': lumino_virtualdom,
  '@lumino/widgets': lumino_widgets,
  react: react,
  'react-dom': react_dom
};
