import { TuTienClient } from './client/TuTienClient';
import { config } from './config';
import chalk from 'chalk';
import Table from 'cli-table3';

// --- Global exception handlers: log but DON'T exit on WS errors (let retry handle it) ---
process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  if (msg.includes('handshake has timed out') || msg.includes('Connect Timeout') || msg.includes('WebSocket') || msg.includes('ws')) {
    return; // don't crash, reconnect logic will retry
  }
  console.error(chalk.red('[UNHANDLED REJECTION]'), reason);
});
process.on('uncaughtException', (err) => {
  console.error(chalk.red('[UNCAUGHT EXCEPTION]'), err);
  // don't exit — let Node.js default behavior apply (it will crash, but PM2/Docker will restart)
  // The above WS handler prevents most crashes; for others we want visibility
});

console.clear();
console.log(chalk.cyan.bold('\n============================================='));
console.log(chalk.cyan.bold('          HỆ THỐNG TU TIÊN BOT V7.0         '));
console.log(chalk.cyan.bold('=============================================\n'));

if (!config.token) {
  console.log(chalk.red.bold('❌ LỖI NGHIÊM TRỌNG:'));
  console.log(chalk.red('Không tìm thấy DISCORD_TOKEN trong biến môi trường hoặc tệp .env!'));
  console.log(chalk.yellow('Đang thoát tiến trình...'));
  process.exit(1);
}

console.log(chalk.blue('ℹ️ Đang khởi tạo Client...'));

// Khởi tạo Custom Client
const client = new TuTienClient();

// --- Shard lifecycle logging (discord.js built-in reconnect handles retries) ---
client.on('shardReconnecting', (id) =>
  console.log(chalk.yellow(`[Shard ${id}] 🔄 Đang kết nối lại...`)));
client.on('shardResume', (id, replayed) =>
  console.log(chalk.green(`[Shard ${id}] ✅ Đã kết nối lại (replayed ${replayed} events).`)));
client.on('shardDisconnect', (event, id) =>
  console.error(chalk.red(`[Shard ${id}] ❌ Mất kết nối: ${event?.code ?? 'unknown'}`)));
client.on('error', (err) => {
  if (err.message?.includes('handshake has timed out') || err.message?.includes('WebSocket')) return;
  console.error(chalk.red('[Client]'), err);
});
// ponytail: When the session is invalidated (token revoked / Discord API session end),
// attempt re-login with retries. Give up after ~1 min.
client.on('invalidated', async () => {
  console.error(chalk.red('⚠️ Phiên đăng nhập đã hết hạn! Đang đăng nhập lại...'));
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await client.login(config.token);
      console.log(chalk.green('✅ Đã đăng nhập lại thành công.'));
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(chalk.red(`❌ Lần ${attempt}/5 đăng nhập lại thất bại: ${msg}`));
      if (attempt < 5) {
        await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 30_000)));
      }
    }
  }
  setTimeout(() => process.exit(1), 5000);
});

// ponytail: Exponential backoff handles transient network blips. Cap at ~8 min total.
// If Discord IPs are unreachable from the host, no amount of retries helps — but the
// hosting panel (Pterodactyl etc.) should auto-restart the process.
async function startWithRetry(maxRetries = 30): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await client.start(config.token);
      console.log(chalk.green.bold('\n✅ Bot đã khởi động thành công!'));
      return;
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      console.error(chalk.red(`\n❌ Lần ${attempt}/${maxRetries} thất bại: ${msg}`));

      if (msg.includes('Invalid token') || msg.includes('TOKEN_INVALID')) {
        console.error(chalk.red('Token không hợp lệ — dừng thử lại.'));
        process.exit(1);
      }

      // Connect Timeout = all Discord gateway IPs timed out — likely host firewall / DNS
      if (msg.includes('Connect Timeout')) {
        console.log(chalk.yellow('  ⚠️ Discord gateway không phản hồi. Kiểm tra tường lửa / DNS của host.'));
      }

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * 2 ** (attempt - 1), 120_000); // 1s, 2s, 4s, ... up to 120s
        console.log(chalk.yellow(`  ⏳ Thử lại sau ${delay / 1000}s...`));
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  console.error(chalk.red.bold(`❌ Đã thử ${maxRetries} lần nhưng không thể kết nối Discord Gateway.`));
  process.exit(1);
}

startWithRetry();
