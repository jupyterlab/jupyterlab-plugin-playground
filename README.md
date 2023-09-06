# JupyterLab Plugin Playground

[![Github Actions Status](https://github.com/jupyterlab/jupyterlab-plugin-playground/workflows/Build/badge.svg)](https://github.com/jupyterlab/jupyterlab-plugin-playground/actions/workflows/build.yml)
[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/jupyterlab/jupyterlab-plugin-playground/main?urlpath=lab)
[![JupyterLite](https://jupyterlite.rtfd.io/en/latest/_static/badge-launch.svg)](https://jupyterlab-plugin-playground.readthedocs.io/en/latest/lite/lab/)

A JupyterLab extension to write and load simple JupyterLab plugins inside JupyterLab.

## Install

This extension requires JupyterLab 3. Install this extension with pip:

```bash
pip install jupyterlab-plugin-playground
```

## How to use the Plugin Playground

This extension provides a new command, `Load Current File As Extension`, available in the text editor.

As an example, open the text editor by creating a new text file and paste this small JupyterLab plugin into it. This plugin will create a simple command `My Super Cool Toggle` in the command palette that can be toggled on and off.

```typescript
import { ICommandPalette } from '@jupyterlab/apputils';

const plugin = {
  id: 'my-super-cool-toggle:plugin',
  autoStart: true, // Activate this plugin immediately
  requires: [ICommandPalette],
  activate: function (app, palette) {
    let commandID = 'my-super-cool-toggle:toggle';
    let toggle = true; // The current toggle state
    app.commands.addCommand(commandID, {
      label: 'My Super Cool Toggle',
      isToggled: function () {
        return toggle;
      },
      execute: function () {
        // Toggle the state
        toggle = !toggle;
      }
    });

    palette.addItem({
      command: commandID,
      // Sort to the top for convenience
      category: 'AAA'
    });
  }
};

export default plugin;
```

While in the text editor, load this plugin in JupyterLab by invoking the Command Palette and executing `Load Current File As Extension`. Invoke the Command Palette again and you will see a new command "My Super Cool Toggle". Executing this new command will toggle the checkbox next to the command.

As another more advanced example, we load the [bqplot](https://bqplot.readthedocs.io) Jupyter Widget library from the cloud using RequireJS. This assumes you have the [ipywidgets JupyterLab extension](https://ipywidgets.readthedocs.io/en/stable/user_install.html#installing-in-jupyterlab-3-0) installed.

```typescript
// IJupyterWidgetRegistry token is provided with Plugin Playground
import { IJupyterWidgetRegistry } from '@jupyter-widgets/base';
// Use RequireJS to load the AMD module. '@*' selects the latest version
// and `/dist/index.js` loads the corresponding module containing bqplot
// from the CDN configured in Settings (`requirejsCDN`).
import bqplot from 'bqplot@*/dist/index';

const plugin = {
  id: 'mydynamicwidget',
  autoStart: true,
  requires: [IJupyterWidgetRegistry],
  activate: function (app, widgets: IJupyterWidgetRegistry) {
    widgets.registerWidget({
      name: 'bqplot',
      version: bqplot.version,
      exports: bqplot
    });
  }
};
export default plugin;
```

There are a few differences in how to write plugins in the Plugin Playground compared to writing plugins in a JupyterLab extension:

- The playground is more understanding: you can use JavaScript-like code rather than fully typed TypeScript and it will still compile.
- You can only load a plugin with a given id more than once, but the previous version will not be unloaded. If you make changes to your plugin, save it and refresh the JupyterLab page to be able to load it afresh again.
- To load code from an external package, RequireJS is used (it is hidden behind ES6-compatible import syntax) which means that the import statements need to be slightly modified to point to appropriate version or file in the package.
  - In addition to JupyterLab and Lumino packages, only AMD modules can be imported; ES6 modules and modules compiled for consumption by Webpack/Node will not work in the current version and an attempt to load such modules will result in `Uncaught SyntaxError: Unexpected token 'export'` error.
- While the playground will attempt to import relative files (with `.ts` suffix), SVG (as strings), and to load `plugin.json` schema, these are experimental features for rapid prototyping and details are subject to change; other resources like CSS styles are not yet supported (but the support is planned)

### Migrating from version 0.3.0

Version 0.3.0 supported only object-based plugins and `require.js` based imports.
While the object-based syntax for defining plugins remains supported, using `require` global reference is now deprecated.

A future version will remove `require` object to prevent confusion between `require` from `require.js`, and native `require` syntax;
please use `requirejs` (an alias function with the same signature) instead, or migrate to ES6-syntax plugins.
Require.js is not available in the ES6-syntax based plugins.

To migrate to the ES6-compatible syntax:

- assign the plugin object to a variable, e.g. `const plugin = { /* plugin code without changes */ };`,
- add `export default plugin;` line,
- convert `require()` calls to ES6 default imports.

## Advanced Settings

The Advanced Settings for the Plugin Playground enable you to configure plugins to load every time JupyterLab starts up. Automatically loaded plugins can be configured in two ways:

- `urls` is a list of URLs that will be fetched and loaded as plugins automatically when JupyterLab starts up. For example, you can point to a GitHub gist or a file you host on a local server that serves text files like the above examples.
- `plugins` is a list of strings of plugin text, like the examples above, that are loaded automatically when JupyterLab starts up. Since JSON strings cannot have multiple lines, you will need to encode any newlines in your plugin text directly as `\n\` (the second backslash is to allow the string to continue on the next line). For example, here is a user setting to encode a small plugin to run at startup:
  ```json5
  {
    plugins: [
      "{ \n\
        id: 'MyConsoleLoggingPlugin', \n\
        autoStart: true, \n\
        activate: function(app) { \n\
          console.log('Activated!'); \n\
        } \n\
      }"
    ]
  }
  ```

## Contributing

### Development install

You will need NodeJS to build the extension package.

```bash
# Clone the repo to your local environment
# Change directory to the jupyterlab-plugin-playground directory
# Install package in development mode
pip install -e .
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Rebuild extension Typescript source after making changes
jlpm run build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm run watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm run build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
pip uninstall jupyterlab-plugin-playground
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `@jupyterlab/plugin-playground` within that folder.

### Packaging the extension

See [RELEASE](RELEASE.md)
