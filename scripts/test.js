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