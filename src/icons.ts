import { LabIcon } from '@jupyterlab/ui-components';

import tokenSidebarIconSvgstr from '!!raw-loader!../style/icons/token-sidebar.svg';

export const tokenSidebarIcon = new LabIcon({
  name: 'plugin-playground:token-sidebar',
  svgstr: tokenSidebarIconSvgstr
});
