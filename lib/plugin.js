var coreutils = require('@jupyterlab/coreutils');
var apputils = require('@jupyterlab/apputils');
var editor = require('@jupyterlab/fileeditor');

async function load_plugin(js_body, app) {
    let token_map = new Map(Array.from(app._serviceMap.keys()).map(t => [t.name, t]));

    var module_fct = new Function(js_body)();
    let module_obj = module_fct();

    module_obj.requires = module_obj.requires.map(value => token_map.get(value));

    app.registerPluginModule(module_obj);
    if (module_obj.autoStart) {
        await app.activatePlugin(module_obj.id);
    }
}

async function get_module(url, app)
{
    let response = await fetch(url);
    let js_body = await response.text();
    load_plugin(js_body, app);
}

module.exports = [{
    id: 'jupyterlab-dynext',
    autoStart: true,
    requires: [coreutils.ISettingRegistry, apputils.ICommandPalette, editor.IEditorTracker],
    activate: function(app, settingRegistry, commandPalette, editorTracker) {
        (function(d, script) {
            script = d.createElement('script');
            script.type = 'text/javascript';
            script.async = true;
            script.onload = function() {

                let commandID = "LoadCurrentFileAsExtension";
                let toggle = true;
                app.commands.addCommand(commandID, {
                    label: 'Load current file as extension',
                    isEnabled: () => editorTracker.currentWidget !== null &&
                                     editorTracker.currentWidget === app.shell.currentWidget,
                    execute: async () => {
                        let currentText = editorTracker.currentWidget.context.model.toString();
                        load_plugin(currentText, app);
                    }
                });

                commandPalette.addItem({
                    command: commandID,
                    category: 'Dynamic Extension Loader',
                    args: {}
                });

                app.restored.then(async () => {
                    let settings = await settingRegistry.load('jupyterlab-dynext:settings');
                    for (u of settings.composite.urls) {
                        await get_module(u, app);
                    }
                    for (t of settings.composite.extensions) {
                        await load_plugin(t, app);
                    }
                });
            };
            script.src = 'https://requirejs.org/docs/release/2.3.6/comments/require.js';
            d.getElementsByTagName('head')[0].appendChild(script);
        }(window.document));
    }
}];
