# jupyterlab-dynext

A JupyterLab extension to load JupyterLab extensions (dynamically). 

One of the big impediments when developing JupyterLab (JLab) extensions is that it's currently required to 
rebuild JupyterLab – and that takes time. JavaScript _used_ to be so easy! 

This extension is trying to bring some of that old magic back, by dynamically loading and injecting JupyterLab extensions into JupyterLab.
Just refresh JupyterLab to re-load the extension, no recompilation necessary!

Note that for real deployments, it might still be a lot better to actually compile the extension *into* JLab, to benefit from proper minimization and, more importantly, deduplication.

jupyterlab-dynext uses require.js to dynamically load the extensions, and require.js supports the AMD module syntax. Using an AMD module, you can also dynamically load widget extensions to jupyterlab -- however, there is one caveat -- the widget needs to be loaded before opening the first notebook.

As a dynamic extension cannot just use the JupyterLab modules, we dynamically look up the modules in the required section, and inject them from JLab. Here is an example for a dynamic extension:

```js
return function()
{
  return {
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
  };
}
```

As you can see, the dynamic extension returns exactly the same dictionary as one would from a regular JupyterLab extension.
Part of the magic is in the `requires` -- these strings (TokenIDs) are inspected, and the live instance of the mentioned plugins is used to call the `activate` function (`app` always comes as default). In this case we are reqiring the `CommandPalette` in order to attach a new command to it.

If you want to register a new widget library, for example, you would require the `"jupyter.extensions.jupyterWidgetRegistry"` instead.
These tokens can be a little arbitrary, so at this point it might require some digging into the JupyterLab source code to figure out 

Here is one example of dynamically loading the `bqplot` widget library from unpkg.com:

```js
return function()
{
  return {
    id: 'mydynamicwidget',
    autoStart: true,
    requires: ["jupyter.extensions.jupyterWidgetRegistry"],
    activate: function(app, widgets) {
      require.config({
        // take the widget from `unpkg.com`
        baseUrl: "https://unpkg.com/"
      });

      let widget = 'bqplot';
      // note that we are using require js here to load the AMD module
      // requirejs is automatically loaded with jupyterlab-dynext.
      // * (star) selects the latest version from unpkg, and then loads the `/dist/index.js` file
      // the final URL will be something like https://unpkg.com/bqplot@^0.5.2/dist/index.js
      require([widget + "@*/dist/index"], function(plugin) {
        widgets.registerWidget({
            name: widget,
            version: plugin.version,
            exports: plugin
        });
      });
    }
  };
}
```

If you want to test some dynamic scripts locally, then there is also a small test server available under `/scripts` which serves the directory content.

### Loading from URL or current file

In the JupyterLab settings you can configure some URL's to load scripts automatically from (e.g. GitHub gists).

And last but not least, you can also edit a JavaScript file inside JupyterLab, and then run the command "Load current file as extension" to load the current file as a JupyterLab extension. Note: currently it's only possible to run this command once for each `id`. To support loading the same widget multiple times, we would need to clear the previous extension - but this might not be side-effect free. We currently don't have a solution for this, but we could either add a `deactivate` function to call on clear, or we could just have the author of the extension make sure that reloading the extension is possible without breaking everything.

## Prerequisites

* JupyterLab

## Installation

**not distributed as a package yet, follow dev install**

## Development

For a development install (requires npm version 4 or later), do the following in the repository directory:

```bash
conda install jupyterlab nodejs yarn -c conda-forge
yarn install
jupyterlab labextension build . // OR
jupyter labextension link .
```
