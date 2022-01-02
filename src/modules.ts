import * as jupyterlab_application from '@jupyterlab/application';
import * as jupyterlab_apputils from '@jupyterlab/apputils';
import * as jupyter_widgets_base from '@jupyter-widgets/base';
import * as jupyterlab_ui_components from '@jupyterlab/ui-components';
//import * as jupyterlab_filebrowser from '@jupyterlab/filebrowser';

export const modules = {
  '@jupyterlab/application': jupyterlab_application,
  '@jupyterlab/apputils': jupyterlab_apputils,
  //'@jupyterlab/filebrowser': jupyterlab_filebrowser,
  '@jupyterlab/ui-components': jupyterlab_ui_components,
  '@jupyter-widgets/base': jupyter_widgets_base
};
