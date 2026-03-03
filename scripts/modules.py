from jupyterlab.coreconfig import CoreConfig
import jupyterlab


# Additional modules to include in the generated known-module map.
# These augment the modules discovered from CoreConfig.
EXTRA_MODULES = {
    '@jupyterlab/attachments',
    '@jupyterlab/cells',
    '@jupyterlab/csvviewer',
    '@jupyterlab/docregistry',
    '@jupyterlab/nbconvert-css',
    '@jupyterlab/nbformat',
    '@jupyterlab/observables',
    '@jupyterlab/outputarea',
    '@jupyterlab/property-inspector',
    '@jupyterlab/running',
    '@jupyter-widgets/base',
    '@lumino/datagrid'
}

# modules which are implementation detail and unlikely to be used directly in playground
IGNORED_MODULES = {
    'yjs'
}

TEMPLATE = """\
import type {{ IModule }} from './types';


export function loadKnownModule(name: string): Promise<IModule | null> {{
  switch (name) {{
    {key_map_string}
    default:
      return Promise.resolve(null);
  }}
}};
"""


def create_modules_map(core_modules, extra_modules, ignored_modules):
    modules_to_export = sorted({
        *core_modules,
        *extra_modules
    } - set(ignored_modules))

    key_map = [
        f"case '{module}':\n      return import('{module}') as any;"
        for module in modules_to_export
    ]

    modules_dot_ts = TEMPLATE.format(
        key_map_string='\n    '.join(key_map)
    )
    return modules_dot_ts


if __name__ == '__main__':
    print(f'Creating module map against JupyterLab {jupyterlab.__version__}')
    config = CoreConfig()
    core_modules = config.singletons.keys()
    modules_map = create_modules_map(core_modules, EXTRA_MODULES, IGNORED_MODULES)
    with open('src/modules.ts', 'w') as f:
        f.write(modules_map)
