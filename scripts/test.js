return function()
{
  return {
    id: 'antoher',
    autoStart: true,
    requires: [],
    activate: function(app) {
      require.config({
        baseUrl: "https://unpkg.com/",
        paths: {
            "@jupyter-widgets/base": "http://localhost:8003/@jupyter-widgets"
        }
      });
      require(["bqplot@0.5.2/dist/index"], function(module) {
        console.log(module);
      });
    }
  };
}