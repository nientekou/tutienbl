import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/tutien.db');

// Đảm bảo thư mục chứa database tồn tại
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const config = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  dbPath,
};
