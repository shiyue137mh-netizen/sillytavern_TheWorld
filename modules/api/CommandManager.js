/**
 * The World - API Slash Command Manager
 * @description Registers all /tw_... slash commands for developers.
 */
export class CommandManager {
    constructor({ context, state, mapSystem, audioManager, dataManager, uiController, logger, win }) {
        this.context = context;
        this.state = state;
        this.mapSystem = mapSystem;
        this.audioManager = audioManager;
        this.dataManager = dataManager;
        this.uiController = uiController;
        this.logger = logger;
        this.SlashCommandParser = win.SillyTavern.SlashCommandParser;
    }

    registerAll() {
        this.logger.log('[CommandManager] Registering all "The World" slash commands...');
        this.register_tw_set_state();
        this.register_tw_player_move();
        this.register_tw_node_create_update();
        this.register_tw_node_delete();
        this.register_tw_play_sound();
        this.register_tw_play_ambient();
        this.register_tw_stop_ambient();
        this.logger.success('[CommandManager] All slash commands registered.');
    }

    _findNode(idOrName) {
        if (!idOrName) return null;
        if (this.mapSystem.mapDataManager.nodes.has(idOrName)) {
            return this.mapSystem.mapDataManager.nodes.get(idOrName);
        }
        for (const node of this.mapSystem.mapDataManager.nodes.values()) {
            if (node.name === idOrName) {
                return node;
            }
        }
        return null;
    }

    register_tw_set_state() {
        const command = this.SlashCommandParser.createCommand('tw_set_state');
        command.addNamedArgument('key', this.context.ARGUMENT_TYPE.STRING, 'The state key to set (e.g., 天气, 时段).', true);
        command.addNamedArgument('value', this.context.ARGUMENT_TYPE.STRING, 'The new value for the state key.', true);
        command.setCallback(async (args) => {
            const { key, value } = args;
            if (!this.state.latestWorldStateData) {
                this.state.latestWorldStateData = {};
            }
            this.state.latestWorldStateData[key] = value;
            this.dataManager.saveState();
            await this.uiController.updateAllPanes();
            this.logger.log(`[Command] Set WorldState '${key}' to '${value}'.`);
        });
        command.register();
    }

    register_tw_player_move() {
        const command = this.SlashCommandParser.createCommand('tw_player_move');
        command.addNamedArgument('target', this.context.ARGUMENT_TYPE.STRING, 'The ID or name of the destination node.', true);
        command.setCallback(async (args) => {
            const { target } = args;
            const node = this._findNode(target);
            if (!node) {
                this.logger.error(`[Command] Player move failed. Node not found: ${target}`);
                return `Error: Node "${target}" not found.`;
            }
            await this.mapSystem.locatorManager.updateLocator(node.id);
            await this.uiController.updateAllPanes();
            this.logger.log(`[Command] Player moved to '${node.name}' (${node.id}).`);
            return `Player moved to ${node.name}.`;
        });
        command.register();
    }

    register_tw_node_create_update() {
        const command = this.SlashCommandParser.createCommand('tw_node_update', ['tw_node_create']);
        command.addNamedArgument('id', this.context.ARGUMENT_TYPE.STRING, 'The unique ID for the node.', true);
        command.addNamedArgument('name', this.context.ARGUMENT_TYPE.STRING, 'The display name for the node.');
        command.addNamedArgument('parentId', this.context.ARGUMENT_TYPE.STRING, 'The ID of the parent node.');
        command.addNamedArgument('type', this.context.ARGUMENT_TYPE.STRING, 'The type of the node (e.g., city, region).');
        command.addNamedArgument('coords', this.context.ARGUMENT_TYPE.STRING, 'The coordinates "x,y" (0-1000).');
        command.addNamedArgument('description', this.context.ARGUMENT_TYPE.STRING, 'A description for the node.');
        command.addNamedArgument('illustration', this.context.ARGUMENT_TYPE.STRING, 'An illustration filename.');
        command.addNamedArgument('status', this.context.ARGUMENT_TYPE.STRING, 'The status (e.g., safe, danger).');
        
        command.setCallback(async (args) => {
            const { id, ...details } = args;
            
            // Filter out null/undefined values from optional args
            const updateDetails = Object.fromEntries(Object.entries(details).filter(([_, v]) => v != null));

            const existingNode = this.mapSystem.mapDataManager.nodes.get(id);
            if (!existingNode && !updateDetails.name) {
                return `Error: 'name' is required when creating a new node.`;
            }
            
            const nodeUpdate = { op: 'add_or_update', id, ...updateDetails };

            await this.mapSystem.mapDataManager.processMapUpdate([nodeUpdate]);
            await this.mapSystem.atlasManager.updateAtlas();
            await this.uiController.updateAllPanes();

            this.logger.log(`[Command] Created/Updated node '${id}'.`);
            return `Node ${id} created/updated successfully.`;
        });
        command.register();
    }

    register_tw_node_delete() {
        const command = this.SlashCommandParser.createCommand('tw_node_delete');
        command.addNamedArgument('target', this.context.ARGUMENT_TYPE.STRING, 'The ID or name of the node to delete.', true);
        command.setCallback(async (args) => {
            const { target } = args;
            const node = this._findNode(target);
            if (!node) {
                return `Error: Node "${target}" not found.`;
            }

            if (!confirm(`Are you sure you want to delete the map node "${node.name}" (${node.id})? This cannot be undone.`)) {
                return `Deletion of node ${node.name} cancelled.`;
            }
            
            const nodeUpdate = { op: 'remove', id: node.id };
            await this.mapSystem.mapDataManager.processMapUpdate([nodeUpdate]);
            await this.mapSystem.atlasManager.updateAtlas();
            await this.uiController.updateAllPanes();

            this.logger.log(`[Command] Deleted node '${node.id}'.`);
            return `Node ${node.name} deleted successfully.`;
        });
        command.register();
    }

    register_tw_play_sound() {
        const command = this.SlashCommandParser.createCommand('tw_play_sound');
        command.addNamedArgument('path', this.context.ARGUMENT_TYPE.STRING, 'The filename of the sound effect.', true);
        command.addNamedArgument('volume', this.context.ARGUMENT_TYPE.NUMBER, 'Volume from 0.0 to 1.0.');
        command.addNamedArgument('pan', this.context.ARGUMENT_TYPE.NUMBER, 'Stereo pan from -1.0 (left) to 1.0 (right).');
        command.addNamedArgument('delay', this.context.ARGUMENT_TYPE.NUMBER, 'Delay in seconds before playing.');
        command.setCallback((args) => {
            const soundObject = { ...args }; // All args match the queue object
            this.audioManager.playSoundQueue([soundObject]);
            this.logger.log(`[Command] Playing sound: ${args.path}.`);
        });
        command.register();
    }

    register_tw_play_ambient() {
        const command = this.SlashCommandParser.createCommand('tw_play_ambient');
        command.addNamedArgument('path', this.context.ARGUMENT_TYPE.STRING, 'The filename of the ambient sound.', true);
        command.addNamedArgument('volume', this.context.ARGUMENT_TYPE.NUMBER, 'Volume from 0.0 to 1.0.');
        command.addNamedArgument('fade', this.context.ARGUMENT_TYPE.NUMBER, 'Fade duration in seconds.');
        command.setCallback((args) => {
            this.audioManager.playAmbient({
                path: args.path,
                volume: args.volume,
                fade_duration: args.fade
            });
            this.logger.log(`[Command] Playing ambient sound: ${args.path}.`);
        });
        command.register();
    }

    register_tw_stop_ambient() {
        const command = this.SlashCommandParser.createCommand('tw_stop_ambient');
        command.addNamedArgument('fade', this.context.ARGUMENT_TYPE.NUMBER, 'Fade duration in seconds.');
        command.setCallback((args) => {
            this.audioManager.stopAmbient({ fade_duration: args.fade });
            this.logger.log(`[Command] Stopping ambient sound.`);
        });
        command.register();
    }
}