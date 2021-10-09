# jupyterlab-pluginplayground

[![Github Actions Status](https://github.com/wolfv/jupyterlab-pluginplayground/workflows/Build/badge.svg)](https://github.com/wolfv/jupyterlab-pluginplayground/actions/workflows/build.yml)[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/wolfv/jupyterlab-pluginplayground/main?urlpath=lab)

A JupyterLab extension to load JupyterLab extensions (dynamically). 

One of the big impediments when developing JupyterLab (JLab) extensions is that it's currently required to 
rebuild JupyterLab – and that takes time. JavaScript _used_ to be so easy! 

This extension is trying to bring some of that old magic back, by dynamically loading and injecting JupyterLab extensions into JupyterLab.
Just refresh JupyterLab to re-load the extension, no recompilation necessary!

Note that for real deployments, it might still be a lot better to actually compile the extension *into* JLab, to benefit from proper minimization and, more importantly, deduplication.

jupyterlab-pluginplayground uses require.js to dynamically load the extensions, and require.js supports the AMD module syntax. Using an AMD module, you can also dynamically load widget extensions to jupyterlab -- however, there is one caveat -- the widget needs to be loaded before opening the first notebook.

As a dynamic extension cannot just use the JupyterLab modules, we dynamically look up the modules in the required section, and inject them from JLab. Here is an example for a dynamic extension:

```js
{
  id: 'mydynamicplugin',
  autoStart: true,
  requires: ["@jupyterlab/apputils:ICommandPalette"],
  activate: function(app, palette) {
    console.log("Hello from a dynamically loaded plugin!");

    // We can use `.app` here to do something with the JupyterLab
    // app instance, such as adding a new command
    let commandID = "MySuperCoolDynamicCommand";
    let toggle = true;
    app.commands.addCommand(commandID, {
      label: 'My Super Cool Dynamic Command',
      isToggled: function() {
        return toggle;
      },
      execute: function() {
        console.log("Executed " + commandID);
        toggle = !toggle;
      }
    });

    palette.addItem({
      command: commandID,
      // make it appear right at the top!
      category: 'AAA',
      args: {}
    });
  }
}
```

As you can see, the dynamic extension returns exactly the same dictionary as one would from a regular JupyterLab extension.
Part of the magic is in the `requires` -- these strings (TokenIDs) are inspected, and the live instance of the mentioned plugins is used to call the `activate` function (`app` always comes as default). In this case we are reqiring the `CommandPalette` in order to attach a new command to it.

If you want to register a new widget library, for example, you would require the `"jupyter.extensions.jupyterWidgetRegistry"` instead.
These tokens can be a little arbitrary, so at this point it might require some digging into the JupyterLab source code to figure out 

Here is one example of dynamically loading the `bqplot` widget library from unpkg.com:

```js
{
  id: 'mydynamicwidget',
  autoStart: true,
  requires: ["jupyter.extensions.jupyterWidgetRegistry"],
  activate: function(app, widgets) {
    require.config({
      // take the widget from jsdelivr
      baseUrl: "https://cdn.jsdelivr.net/npm"
    });

    let widget = 'bqplot';
    // note that we are using require js here to load the AMD module
    // requirejs is automatically loaded with jupyterlab-pluginplayground.
    // * (star) selects the latest version from jsdelivr, and then loads the `/dist/index.js` file
    // the final URL will be something like https://cdn.jsdelivr.net/npm/bqplot@*/dist/index.js
    require([widget + "@*/dist/index"], function(plugin) {
      widgets.registerWidget({
          name: widget,
          version: plugin.version,
          exports: plugin
      });
    });
  }
}

```

If you want to test some dynamic scripts locally, then there is also a small test server available under `/scripts` which serves the directory content.

### Loading from URL or current file

In the JupyterLab settings you can configure some URL's to load scripts automatically from (e.g. GitHub gists).

And last but not least, you can also edit a JavaScript file inside JupyterLab, and then run the command "Load current file as extension" to load the current file as a JupyterLab extension. Note: currently it's only possible to run this command once for each `id`. To support loading the same widget multiple times, we would need to clear the previous extension - but this might not be side-effect free. We currently don't have a solution for this, but we could either add a `deactivate` function to call on clear, or we could just have the author of the extension make sure that reloading the extension is possible without breaking everything.



## Requirements

* JupyterLab >= 3.0

## Install

To install the extension, execute:

```bash
pip install jupyterlab-pluginplayground
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall jupyterlab-pluginplayground
```


## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the jupyterlab-pluginplayground directory
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
pip uninstall jupyterlab-pluginplayground
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `jupyterlab-pluginplayground` within that folder.

### Packaging the extension

See [RELEASE](RELEASE.md)
