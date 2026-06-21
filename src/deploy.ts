import { TuTienClient } from './client/TuTienClient';
import { CommandHandler } from './handlers/CommandHandler';
import path from 'path';
import { config } from './config';

async function deploy() {
  const client = new TuTienClient();
  client.token = config.token; // Inject token manually for deploy script

  const commandHandler = new CommandHandler(client);
  await commandHandler.loadAll(path.join(__dirname, 'commands'));
  
  // Set fake client user ID for deploy API
  client.user = { id: process.env.CLIENT_ID || '1250367332247506984' } as any; 

  console.log('Deploying...');
  await commandHandler.deploy();
  console.log('Done!');
  process.exit(0);
}

deploy();
