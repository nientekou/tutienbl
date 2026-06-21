"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const TuTienClient_1 = require("./client/TuTienClient");
const config_1 = require("./config");
const chalk_1 = __importDefault(require("chalk"));
console.clear();
console.log(chalk_1.default.cyan.bold('\n============================================='));
console.log(chalk_1.default.cyan.bold('          HỆ THỐNG TU TIÊN BOT V7.0         '));
console.log(chalk_1.default.cyan.bold('=============================================\n'));
if (!config_1.config.token) {
    console.log(chalk_1.default.red.bold('❌ LỖI NGHIÊM TRỌNG:'));
    console.log(chalk_1.default.red('Không tìm thấy DISCORD_TOKEN trong biến môi trường hoặc tệp .env!'));
    console.log(chalk_1.default.yellow('Đang thoát tiến trình...'));
    process.exit(1);
}
console.log(chalk_1.default.blue('ℹ️ Đang khởi tạo Client...'));
// Khởi tạo Custom Client
const client = new TuTienClient_1.TuTienClient();
// Bắt đầu khởi động Client và nạp Handler
client.start(config_1.config.token).catch(error => {
    console.log(chalk_1.default.red.bold('\n❌ Thất bại khi khởi động bot:'));
    console.error(error);
});
