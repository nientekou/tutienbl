import db from '../database/database';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

class BackupService {
  private backupInterval: NodeJS.Timeout | null = null;
  private readonly backupLimit = 48; // Giữ tối đa 48 bản sao lưu (24 giờ)

  public getBackupDir(): string {
    const backupDir = path.join(path.dirname(config.dbPath), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    return backupDir;
  }

  public async createBackup(label: string = 'auto'): Promise<string> {
    const backupDir = this.getBackupDir();
    const now = new Date();
    const timestamp = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') + '_' +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');
    
    const filename = `backup_${timestamp}_${label}.db`;
    const destPath = path.join(backupDir, filename);

    try {
      await db.backup(destPath);
      console.log(`[BackupService] ✅ Đã tạo bản sao lưu thành công: ${filename}`);
      this.cleanupOldBackups();
      return filename;
    } catch (err) {
      console.warn('[BackupService] Lỗi khi dùng db.backup, chuyển sang copy tệp trực tiếp:', err);
      try {
        fs.copyFileSync(config.dbPath, destPath);
        console.log(`[BackupService] ✅ Đã copy tệp sao lưu thành công: ${filename}`);
        this.cleanupOldBackups();
        return filename;
      } catch (copyErr) {
        console.error('[BackupService] Lỗi nghiêm trọng khi sao lưu cơ sở dữ liệu:', copyErr);
        throw copyErr;
      }
    }
  }

  private cleanupOldBackups(): void {
    try {
      const backupDir = this.getBackupDir();
      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
        .map(f => {
          const filePath = path.join(backupDir, f);
          const stat = fs.statSync(filePath);
          return { name: f, path: filePath, time: stat.mtimeMs };
        });

      if (files.length <= this.backupLimit) return;

      // Sắp xếp từ cũ nhất đến mới nhất
      files.sort((a, b) => a.time - b.time);

      const toDelete = files.slice(0, files.length - this.backupLimit);
      for (const f of toDelete) {
        fs.unlinkSync(f.path);
        console.log(`[BackupService] 🧹 Đã dọn dẹp bản sao lưu cũ: ${f.name}`);
      }
    } catch (err) {
      console.error('[BackupService] Lỗi khi dọn dẹp sao lưu cũ:', err);
    }
  }

  public listBackups(): Array<{ filename: string; size: number; ageMinutes: number; createdAt: Date }> {
    try {
      const backupDir = this.getBackupDir();
      if (!fs.existsSync(backupDir)) return [];

      const now = Date.now();
      return fs.readdirSync(backupDir)
        .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
        .map(f => {
          const filePath = path.join(backupDir, f);
          const stat = fs.statSync(filePath);
          const ageMs = now - stat.mtimeMs;
          return {
            filename: f,
            size: stat.size,
            ageMinutes: Math.round(ageMs / 60000),
            createdAt: stat.mtime
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Mới nhất lên đầu
    } catch (err) {
      console.error('[BackupService] Lỗi khi liệt kê danh sách sao lưu:', err);
      return [];
    }
  }

  public async rollbackToBackup(filename: string, adminId: string): Promise<void> {
    const backupDir = this.getBackupDir();
    const backupPath = path.join(backupDir, filename);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Tệp sao lưu ${filename} không tồn tại.`);
    }

    console.log(`[BackupService] ⚠️ Đang thực hiện khôi phục dữ liệu từ: ${filename} (Yêu cầu bởi: ${adminId})`);
    
    // Ghi audit log trước khi close DB
    const { systemConfigService } = require('./SystemConfigService');
    systemConfigService.writeAuditLog(adminId, 'admin_rollback_execute', { backupFile: filename });

    // Đợi 1 giây để đảm bảo log ghi xong
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      // Đóng connection DB hiện tại
      db.close();
      console.log(`[BackupService] 🔒 Đã đóng kết nối SQLite Database.`);

      // Sao chép tệp backup đè lên database chính
      fs.copyFileSync(backupPath, config.dbPath);
      console.log(`[BackupService] 🔄 Đã khôi phục ghi đè tệp cơ sở dữ liệu.`);

      // Thoát tiến trình để bot tự động khởi động lại qua process manager
      console.log(`[BackupService] 🚀 Đang khởi động lại tiến trình Bot để nạp lại dữ liệu khôi phục...`);
      process.exit(0);
    } catch (err) {
      console.error('[BackupService] Lỗi nghiêm trọng khi khôi phục cơ sở dữ liệu:', err);
      throw err;
    }
  }

  public startScheduler(): void {
    if (this.backupInterval) return;

    // Chạy sao lưu ngay khi khởi động
    this.createBackup('startup').catch(err => console.error('Startup backup failed:', err));

    // Lên lịch chạy mỗi 30 phút
    this.backupInterval = setInterval(() => {
      this.createBackup('auto').catch(err => console.error('Auto backup failed:', err));
    }, 30 * 60 * 1000);
  }
}

export const backupService = new BackupService();
