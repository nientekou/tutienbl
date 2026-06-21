import { TuTienClient } from './client/TuTienClient';
import { config } from './config';
import chalk from 'chalk';
import Table from 'cli-table3';

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

// Bắt đầu khởi động Client và nạp Handler
client.start(config.token).catch(error => {
  console.log(chalk.red.bold('\n❌ Thất bại khi khởi động bot:'));
  console.error(error);
});
