"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const TuTienClient_1 = require("./client/TuTienClient");
const CommandHandler_1 = require("./handlers/CommandHandler");
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
async function deploy() {
    const client = new TuTienClient_1.TuTienClient();
    client.token = config_1.config.token; // Inject token manually for deploy script
    const commandHandler = new CommandHandler_1.CommandHandler(client);
    await commandHandler.loadAll(path_1.default.join(__dirname, 'commands'));
    // Set fake client user ID for deploy API
    client.user = { id: process.env.CLIENT_ID || '1250367332247506984' };
    console.log('Deploying...');
    await commandHandler.deploy();
    console.log('Done!');
    process.exit(0);
}
deploy();
