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