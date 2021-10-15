# JupyterLab Plugin Playground

[![Github Actions Status](https://github.com/jupyterlab/jupyterlab-plugin-playground/workflows/Build/badge.svg)](https://github.com/jupyterlab/jupyterlab-plugin-playground/actions/workflows/build.yml)[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/jupyterlab/jupyterlab-plugin-playground/master?urlpath=lab)

A JupyterLab extension to write and load simple JupyterLab plugins inside JupyterLab.


## Install

This extension requires JupyterLab 3. Install this extension with pip:

```bash
pip install jupyterlab-plugin-playground
```

## How to use the Plugin Playground

This extension provides a new command, `Load current file as extension`, available in the text editor.

As an example, open the text editor by creating a new text file and paste this small JupyterLab plugin into it. This plugin will create a simple command `My Super Cool Toggle` in the command palette that can be toggled on and off.

```js
{
  id: 'MySuperCoolTogglePlugin',
  autoStart: true, // Activate this plugin immediately
  requires: ["@jupyterlab/apputils:ICommandPalette"],
  activate: function(app, palette) {
    let commandID = "MySuperCoolToggle";
    let toggle = true; // The current toggle state
    app.commands.addCommand(commandID, {
      label: 'My Super Cool Toggle',
      isToggled: function() {
        return toggle;
      },
      execute: function() {
        // Toggle the state
        toggle = !toggle;
      }
    });

    palette.addItem({
      command: commandID,
      // Sort to the top for convenience
      category: "AAA"
    });
  }
}
```
While in the text editor, load this plugin in JupyterLab by invoking the Command Palette and executing `Load current file as extension`. Invoke the Command Palette again and you will see a new command "My Super Cool Toggle". Executing this new command will toggle the checkbox next to the command.

As another more advanced example, we load the [bqplot](https://bqplot.readthedocs.io) Jupyter Widget library from the cloud using RequireJS. This assumes you have the [ipywidgets JupyterLab extension](https://ipywidgets.readthedocs.io/en/stable/user_install.html#installing-in-jupyterlab-3-0) installed.

```js
{
  id: 'mydynamicwidget',
  autoStart: true,
  requires: ["jupyter.extensions.jupyterWidgetRegistry"],
  activate: function(app, widgets) {
    // Set up RequireJS to pull packages from the jsdelivr CDN.
    require.config({
      baseUrl: "https://cdn.jsdelivr.net/npm"
    });
    // Use RequireJS to load the AMD module. '@*' selects the latest version
    // and `/dist/index.js` loads the corresponding module containing bqplot.
    require(["bqplot@*/dist/index"], function(plugin) {
      widgets.registerWidget({
          name: 'bqplot',
          version: plugin.version,
          exports: plugin
      });
    });
  }
}
```

There are a few differences in how to write plugins in the Plugin Playground compared to writing plugins in a JupyterLab extension:

* Plugins cannot import tokens from other packages, so we use the token names as strings in the `requires` and `optional` plugin fields rather than imported tokens. For example, we used the [ICommandPalette](https://github.com/jupyterlab/jupyterlab/blob/4169b7b684f6160b5a9ab093391ec531399dfa82/packages/apputils/src/tokens.ts#L16-L18) token name in the `requires` field above. The Plugin Playground will automatically change the token names to the corresponding tokens registered with the current JupyterLab when it loads the plugin. This means you can use token names for any extension currently loaded in JupyterLab, including non-core extensions.
* To load code from a separate package, you can use RequireJS as in the example above to load bqplot. RequireJS comes with the Plugin Playground and can be used to load any AMD module.
* You can only load a plugin with a given id once. If you make changes to your plugin, save it and refresh the JupyterLab page to be able to load it again.

## Advanced Settings

The Advanced Settings for the Plugin Playground enable you to configure plugins to load every time JupyterLab starts up. Automatically loaded plugins can be configured in two ways:

* `urls` is a list of URLs that will be fetched and loaded as plugins automatically when JupyterLab starts up. For example, you can point to a GitHub gist or a file you host on a local server that serves text files like the above examples.
* `plugins` is a list of strings of plugin text, like the examples above, that are loaded automatically when JupyterLab starts up. Since JSON strings cannot have multiple lines, you will need to encode any newlines in your plugin text directly as `\n\` (the second backslash is to allow the string to continue on the next line). For example, here is a user setting to encode a small plugin to run at startup:
  ```json5
  {
    plugins: [
      "{ \n\
        id: 'MyConsoleLoggingPlugin', \n\
        autoStart: true, \n\
        activate: function(app, palette) { \n\
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
