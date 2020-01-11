return function()
{
  return {
    id: 'adynamicwidget',
    autoStart: true,
    requires: ["jupyter.extensions.jupyterWidgetRegistry"],
    activate: function(app, widgets) {
      require.config({
        baseUrl: "https://unpkg.com/"
      });

      let widget = 'bqplot';
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