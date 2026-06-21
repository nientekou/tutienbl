import db, { initDatabase } from '../src/database/database';
import { mountService } from '../src/services/MountService';

async function main() {
  initDatabase();
  console.log('Testing getMounts...');
  try {
    const mounts = mountService.getMounts('test_user_all_fixes');
    console.log('getMounts success:', mounts);
  } catch (e) {
    console.error('getMounts failed:', e);
  }

  console.log('Testing getActiveMount...');
  try {
    const active = mountService.getActiveMount('test_user_all_fixes');
    console.log('getActiveMount success:', active);
  } catch (e) {
    console.error('getActiveMount failed:', e);
  }
}

main();
