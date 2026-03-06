import { LabIcon } from '@jupyterlab/ui-components';

import tokenSidebarIconSvgstr from '!!raw-loader!../style/icons/token-sidebar.svg';
import examplesSidebarIconSvgstr from '!!raw-loader!../style/icons/examples-sidebar.svg';

export const tokenSidebarIcon = new LabIcon({
  name: 'plugin-playground:token-sidebar',
  svgstr: tokenSidebarIconSvgstr
});

export const examplesSidebarIcon = new LabIcon({
  name: 'plugin-playground:examples-sidebar',
  svgstr: examplesSidebarIconSvgstr
});
