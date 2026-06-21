import db from '../src/database/database';
import { systemConfigService } from '../src/services/SystemConfigService';

console.log('Current maintenance mode:', systemConfigService.isMaintenanceMode());
systemConfigService.setMaintenanceMode(false);
console.log('Set maintenance mode to false. New value:', systemConfigService.isMaintenanceMode());
