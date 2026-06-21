import db from '../src/database/database';

function check() {
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 15').all() as any[];
  console.log('--- RECENT AUDIT LOGS ---');
  for (const l of logs) {
    const time = new Date(l.created_at * 1000).toLocaleString('vi-VN');
    console.log(`[${time}] ID: ${l.id}, User: ${l.user_id}, Action: ${l.action}, Details: ${l.details}`);
  }
}

check();
