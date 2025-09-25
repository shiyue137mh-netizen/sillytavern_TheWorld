/**
 * The World - Command Processor
 * @description Executes parsed commands by dispatching them to the correct managers.
 */
export class CommandProcessor {
    constructor({ audioManager, mapSystem, logger }) {
        this.audioManager = audioManager;
        this.mapSystem = mapSystem;
        this.logger = logger;
    }

    executeCommands(commands) {
        if (!commands || commands.length === 0) return;
        
        this.logger.log(`Executing ${commands.length} commands...`);
        
        commands.forEach(command => {
            const { module, function: func, args } = command;

            if (module === 'FX') {
                this._handleFxCommand(func, args);
            } else if (module === 'Map') {
                this._handleMapCommand(command);
            } else {
                this.logger.warn(`Unknown command module: ${module}`);
            }
        });
    }

    _handleMapCommand(command) {
        if (this.mapSystem && this.mapSystem.commandHandler) {
            this.mapSystem.commandHandler.executeCommand(command);
        } else {
            this.logger.error('MapSystem command handler not available in CommandProcessor.');
        }
    }

    _handleFxCommand(func, args) {
        switch (func) {
            case 'PlayAmbient':
                if (args[0] && typeof args[0] === 'string') {
                    this.audioManager.playAmbient({
                        path: args[0],
                        volume: args[1], // undefined is handled by the function
                        fade_duration: args[2]
                    });
                } else {
                    this.logger.error('PlayAmbient command requires a path string as the first argument.');
                }
                break;
            
            case 'StopAmbient':
                this.audioManager.stopAmbient({
                    fade_duration: args[0]
                });
                break;
            
            case 'PlaySound':
                if (Array.isArray(args[0])) {
                    this.audioManager.playSoundQueue(args[0]);
                } else {
                    this.logger.error('PlaySound command requires an array of sound objects.');
                }
                break;
            
            default:
                this.logger.warn(`Unknown FX function: ${func}`);
                break;
        }
    }
}