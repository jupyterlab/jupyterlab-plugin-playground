/**
 * This is an example hello world plugin.
 * Open Command Palette with Ctrl+Shift+C
 * (Command+Shift+C on Mac) and select
 * "Load Current File as Extension"
 */
const plugin = {
  id: 'hello-world:plugin',
  autoStart: true,
  activate: (app) => {
    alert('Hello World!');
  },
};

export default plugin;
