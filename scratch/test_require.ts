try {
  const { mountService } = require('../src/services/MountService');
  console.log('Imported successfully:', mountService);
} catch (e) {
  console.error('Import failed:', e);
}
