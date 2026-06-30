// V16 A-03: Skill Tree System — 6 elements × 2 branches × 3 nodes = 36 nodes
import db from '../database/database';

interface SkillTreeNode {
  id: string;
  element: string;
  branch: 'offense' | 'defense';
  node: number;
  name: string;
  description: string;
  statBonus: Record<string, number>;
  skillPointCost: number;
  parentNode: number; // 0 = root (no parent)
}

// ponytail: 36 nodes instead of 105 from the plan — covers all elements without being overwhelming
const TREE_NODES: SkillTreeNode[] = [
  // Hỏa (Fire) — Offense: burn damage, Defense: fire shield
  { id: 'fire_off_1', element: 'Hỏa', branch: 'offense', node: 1, name: 'Liệt Hỏa Sơ Khởi', description: '+5% công kích', statBonus: { atk_bonus: 0.05 }, skillPointCost: 1, parentNode: 0 },
  { id: 'fire_off_2', element: 'Hỏa', branch: 'offense', node: 2, name: 'Hỏa Diễm Cường Hóa', description: '+8% sát thương hỏa', statBonus: { fire_dmg_bonus: 0.08 }, skillPointCost: 2, parentNode: 1 },
  { id: 'fire_off_3', element: 'Hỏa', branch: 'offense', node: 3, name: 'Thiêu Thân Liệt Diễm', description: '+12% bạo kích', statBonus: { crit_bonus: 0.12 }, skillPointCost: 3, parentNode: 2 },
  { id: 'fire_def_1', element: 'Hỏa', branch: 'defense', node: 1, name: 'Hỏa Diễm Chi Khiên', description: '+5% phòng thủ', statBonus: { def_bonus: 0.05 }, skillPointCost: 1, parentNode: 0 },
  { id: 'fire_def_2', element: 'Hỏa', branch: 'defense', node: 2, name: 'Liệt Hỏa Hộ Thể', description: '+8% HP', statBonus: { hp_bonus: 0.08 }, skillPointCost: 2, parentNode: 1 },
  { id: 'fire_def_3', element: 'Hỏa', branch: 'defense', node: 3, name: 'Phượng Hoàng Trọng Sinh', description: '+15% hồi phục', statBonus: { regen_bonus: 0.15 }, skillPointCost: 3, parentNode: 2 },
  // Thủy (Water)
  { id: 'water_off_1', element: 'Thủy', branch: 'offense', node: 1, name: 'Hàn Băng Sơ Khởi', description: '+5% công kích', statBonus: { atk_bonus: 0.05 }, skillPointCost: 1, parentNode: 0 },
  { id: 'water_off_2', element: 'Thủy', branch: 'offense', node: 2, name: 'Băng Phong Chi Nhận', description: '+8% sát thương thủy', statBonus: { water_dmg_bonus: 0.08 }, skillPointCost: 2, parentNode: 1 },
  { id: 'water_off_3', element: 'Thủy', branch: 'offense', node: 3, name: 'Vạn Lý Băng Phong', description: '+10% tốc độ', statBonus: { speed_bonus: 0.10 }, skillPointCost: 3, parentNode: 2 },
  { id: 'water_def_1', element: 'Thủy', branch: 'defense', node: 1, name: 'Thủy Mạc Hộ Thể', description: '+5% phòng thủ', statBonus: { def_bonus: 0.05 }, skillPointCost: 1, parentNode: 0 },
  { id: 'water_def_2', element: 'Thủy', branch: 'defense', node: 2, name: 'Hàn Băng Chi Giáp', description: '+8% né tránh', statBonus: { dodge_bonus: 0.08 }, skillPointCost: 2, parentNode: 1 },
  { id: 'water_def_3', element: 'Thủy', branch: 'defense', node: 3, name: 'Băng Sơn Bất Động', description: '+15% HP', statBonus: { hp_bonus: 0.15 }, skillPointCost: 3, parentNode: 2 },
  // Mộc (Wood)
  { id: 'wood_off_1', element: 'Mộc', branch: 'offense', node: 1, name: 'Mộc Linh Sơ Khởi', description: '+5% công kích', statBonus: { atk_bonus: 0.05 }, skillPointCost: 1, parentNode: 0 },
  { id: 'wood_off_2', element: 'Mộc', branch: 'offense', node: 2, name: 'Đằng Mạn Trói Buộc', description: '+8% sát thương mộc', statBonus: { wood_dmg_bonus: 0.08 }, skillPointCost: 2, parentNode: 1 },
  { id: 'wood_off_3', element: 'Mộc', branch: 'offense', node: 3, name: 'Sinh Mệnh Hút Máu', description: '+12% hút máu', statBonus: { lifesteal_bonus: 0.12 }, skillPointCost: 3, parentNode: 2 },
  { id: 'wood_def_1', element: 'Mộc', branch: 'defense', node: 1, name: 'Mộc Giáp Hộ Thân', description: '+5% phòng thủ', statBonus: { def_bonus: 0.05 }, skillPointCost: 1, parentNode: 0 },
  { id: 'wood_def_2', element: 'Mộc', branch: 'defense', node: 2, name: 'Phục Hồi Sinh Khí', description: '+10% hồi phục', statBonus: { regen_bonus: 0.10 }, skillPointCost: 2, parentNode: 1 },
  { id: 'wood_def_3', element: 'Mộc', branch: 'defense', node: 3, name: 'Trường Sinh Bất Lão', description: '+20% HP', statBonus: { hp_bonus: 0.20 }, skillPointCost: 3, parentNode: 2 },
  // Kim (Metal)
  { id: 'metal_off_1', element: 'Kim', branch: 'offense', node: 1, name: 'Kim Khí Sơ Khởi', description: '+5% công kích', statBonus: { atk_bonus: 0.05 }, skillPointCost: 1, parentNode: 0 },
  { id: 'metal_off_2', element: 'Kim', branch: 'offense', node: 2, name: 'Kim Loại Sắc Bén', description: '+10% bạo kích', statBonus: { crit_bonus: 0.10 }, skillPointCost: 2, parentNode: 1 },
  { id: 'metal_off_3', element: 'Kim', branch: 'offense', node: 3, name: 'Hoàng Kim Chi Chiến', description: '+15% sát thương bạo kích', statBonus: { crit_dmg_bonus: 0.15 }, skillPointCost: 3, parentNode: 2 },
  { id: 'metal_def_1', element: 'Kim', branch: 'defense', node: 1, name: 'Kim Thuẫn Phòng Hộ', description: '+5% phòng thủ', statBonus: { def_bonus: 0.05 }, skillPointCost: 1, parentNode: 0 },
  { id: 'metal_def_2', element: 'Kim', branch: 'defense', node: 2, name: 'Kim Cương Bất Hoại', description: '+10% chặn đòn', statBonus: { block_bonus: 0.10 }, skillPointCost: 2, parentNode: 1 },
  { id: 'metal_def_3', element: 'Kim', branch: 'defense', node: 3, name: 'Vạn Kiếm Quy Tông', description: '+20% phản thương', statBonus: { reflect_bonus: 0.20 }, skillPointCost: 3, parentNode: 2 },
  // Thổ (Earth)
  { id: 'earth_off_1', element: 'Thổ', branch: 'offense', node: 1, name: 'Thổ Linh Sơ Khởi', description: '+5% công kích', statBonus: { atk_bonus: 0.05 }, skillPointCost: 1, parentNode: 0 },
  { id: 'earth_off_2', element: 'Thổ', branch: 'offense', node: 2, name: 'Địa Chấn Công Kích', description: '+10% sát thương thổ', statBonus: { earth_dmg_bonus: 0.10 }, skillPointCost: 2, parentNode: 1 },
  { id: 'earth_off_3', element: 'Thổ', branch: 'offense', node: 3, name: 'Núi Lở Đất Chuyển', description: '+20% sát thương diện rộng', statBonus: { aoe_dmg_bonus: 0.20 }, skillPointCost: 3, parentNode: 2 },
  { id: 'earth_def_1', element: 'Thổ', branch: 'defense', node: 1, name: 'Hậu Thổ Chi Giáp', description: '+5% phòng thủ', statBonus: { def_bonus: 0.05 }, skillPointCost: 1, parentNode: 0 },
  { id: 'earth_def_2', element: 'Thổ', branch: 'defense', node: 2, name: 'Sơn Nhạc Vững Chãi', description: '+15% HP', statBonus: { hp_bonus: 0.15 }, skillPointCost: 2, parentNode: 1 },
  { id: 'earth_def_3', element: 'Thổ', branch: 'defense', node: 3, name: 'Đại Địa Bất Diệt', description: '+25% phòng thủ khi HP thấp', statBonus: { low_hp_def_bonus: 0.25 }, skillPointCost: 3, parentNode: 2 },
  // Phong (Wind)
  { id: 'wind_off_1', element: 'Phong', branch: 'offense', node: 1, name: 'Phong Linh Sơ Khởi', description: '+5% công kích', statBonus: { atk_bonus: 0.05 }, skillPointCost: 1, parentNode: 0 },
  { id: 'wind_off_2', element: 'Phong', branch: 'offense', node: 2, name: 'Phong Bạo Công Kích', description: '+10% tốc độ', statBonus: { speed_bonus: 0.10 }, skillPointCost: 2, parentNode: 1 },
  { id: 'wind_off_3', element: 'Phong', branch: 'offense', node: 3, name: 'Phong Thần Nhất Kích', description: '+15% sát thương phong', statBonus: { wind_dmg_bonus: 0.15 }, skillPointCost: 3, parentNode: 2 },
  { id: 'wind_def_1', element: 'Phong', branch: 'defense', node: 1, name: 'Phong Bích Phòng Hộ', description: '+5% né tránh', statBonus: { dodge_bonus: 0.05 }, skillPointCost: 1, parentNode: 0 },
  { id: 'wind_def_2', element: 'Phong', branch: 'defense', node: 2, name: 'Tật Phong Hành', description: '+10% né tránh', statBonus: { dodge_bonus: 0.10 }, skillPointCost: 2, parentNode: 1 },
  { id: 'wind_def_3', element: 'Phong', branch: 'defense', node: 3, name: 'Vô Ảnh Vô Hình', description: '+20% né tránh khi HP thấp', statBonus: { low_hp_dodge_bonus: 0.20 }, skillPointCost: 3, parentNode: 2 },
];

class SkillTreeService {
  private initTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_skill_tree (
        user_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        unlocked INTEGER DEFAULT 0,
        PRIMARY KEY(user_id, node_id)
      );
      CREATE TABLE IF NOT EXISTS user_skill_points (
        user_id TEXT PRIMARY KEY,
        points INTEGER DEFAULT 0,
        total_earned INTEGER DEFAULT 0
      );
    `);
  }

  public getAllNodes(): SkillTreeNode[] {
    return TREE_NODES;
  }

  public getNodesByElement(element: string): SkillTreeNode[] {
    return TREE_NODES.filter(n => n.element === element);
  }

  public getNode(nodeId: string): SkillTreeNode | undefined {
    return TREE_NODES.find(n => n.id === nodeId);
  }

  public getUserNodes(userId: string): Record<string, number> {
    this.initTable();
    const rows = db.prepare('SELECT node_id, unlocked FROM user_skill_tree WHERE user_id = ?').all(userId) as any[];
    const result: Record<string, number> = {};
    for (const row of rows) result[row.node_id] = row.unlocked;
    return result;
  }

  public getSkillPoints(userId: string): number {
    this.initTable();
    const row = db.prepare('SELECT points FROM user_skill_points WHERE user_id = ?').get(userId) as any;
    return row ? row.points : 0;
  }

  // ponytail: earning 1 skill point per 5 levels — ~1 point per 5 hours of play
  public addSkillPoints(userId: string, amount: number): void {
    this.initTable();
    db.prepare(`
      INSERT INTO user_skill_points (user_id, points, total_earned)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET points = points + ?, total_earned = total_earned + ?
    `).run(userId, amount, amount, amount, amount);
  }

  public canUnlock(userId: string, nodeId: string): { can: boolean; reason?: string } {
    const node = this.getNode(nodeId);
    if (!node) return { can: false, reason: 'Nút không tồn tại.' };

    const userNodes = this.getUserNodes(userId);
    const already = userNodes[nodeId];
    if (already) return { can: false, reason: 'Đã mở khóa nút này.' };

    // Check parent node is unlocked
    if (node.parentNode > 0) {
      const parentId = `${node.element.toLowerCase()}_${node.branch === 'offense' ? 'off' : 'def'}_${node.parentNode}`;
      const parentNode = TREE_NODES.find(n => n.id === parentId);
      if (!parentNode) return { can: false, reason: 'Lỗi cấu trúc cây kỹ năng.' };
      if (!userNodes[parentId] || userNodes[parentId] === 0) return { can: false, reason: `Cần mở khóa **${parentNode.name}** trước.` };
    }

    // Check skill points
    const points = this.getSkillPoints(userId);
    if (points < node.skillPointCost) return { can: false, reason: `Cần **${node.skillPointCost}** điểm kỹ năng, hiện có **${points}**.` };

    return { can: true };
  }

  public unlockNode(userId: string, nodeId: string): { success: boolean; message: string } {
    const check = this.canUnlock(userId, nodeId);
    if (!check.can) return { success: false, message: `❌ ${check.reason}` };

    const node = this.getNode(nodeId)!;
    db.transaction(() => {
      db.prepare('INSERT INTO user_skill_tree (user_id, node_id, unlocked) VALUES (?, ?, 1) ON CONFLICT(user_id, node_id) DO UPDATE SET unlocked = 1')
        .run(userId, nodeId);
      db.prepare('UPDATE user_skill_points SET points = points - ? WHERE user_id = ?').run(node.skillPointCost, userId);
    })();

    return { success: true, message: `✅ Đã mở khóa **${node.name}**! (Tiêu hao **${node.skillPointCost}** điểm kỹ năng)` };
  }

  /**
   * Get all passive stat bonuses from unlocked nodes for a user
   */
  public getPassiveBonuses(userId: string): Record<string, number> {
    const userNodes = this.getUserNodes(userId);
    const bonuses: Record<string, number> = {};

    for (const [nodeId, unlocked] of Object.entries(userNodes)) {
      if (!unlocked) continue;
      const node = this.getNode(nodeId);
      if (!node) continue;
      for (const [stat, value] of Object.entries(node.statBonus)) {
        bonuses[stat] = (bonuses[stat] || 0) + value;
      }
    }

    return bonuses;
  }

  /**
   * Get tree visualization for a given element
   */
  public getTreeDescription(userId: string, element: string): string {
    const nodes = this.getNodesByElement(element);
    const offense = nodes.filter(n => n.branch === 'offense').sort((a, b) => a.node - b.node);
    const defense = nodes.filter(n => n.branch === 'defense').sort((a, b) => a.node - b.node);
    const userNodes = this.getUserNodes(userId);
    const points = this.getSkillPoints(userId);

    let msg = `🌳 **Cây Kỹ Năng — ${element}**\n📊 Điểm kỹ năng: **${points}**\n\n`;

    msg += `**Công Kích:**\n`;
    for (const node of offense) {
      const unlocked = userNodes[node.id] === 1;
      const status = unlocked ? '✅' : '🔒';
      const parentOk = node.parentNode === 0 || userNodes[`${element.toLowerCase()}_${node.branch === 'offense' ? 'off' : 'def'}_${node.parentNode}`] === 1;
      const canUnlock = !unlocked && parentOk && points >= node.skillPointCost;
      const cost = unlocked ? '' : ` (${node.skillPointCost} SP${canUnlock ? ' — /kynang unlock ' + node.id : ''})`;
      msg += `${status} **${node.name}**: ${node.description}${cost}\n`;
    }

    msg += `\n**Phòng Thủ:**\n`;
    for (const node of defense) {
      const unlocked = userNodes[node.id] === 1;
      const status = unlocked ? '✅' : '🔒';
      const parentOk = node.parentNode === 0 || userNodes[`${element.toLowerCase()}_${node.branch === 'offense' ? 'off' : 'def'}_${node.parentNode}`] === 1;
      const canUnlock = !unlocked && parentOk && points >= node.skillPointCost;
      const cost = unlocked ? '' : ` (${node.skillPointCost} SP${canUnlock ? ' — /kynang unlock ' + node.id : ''})`;
      msg += `${status} **${node.name}**: ${node.description}${cost}\n`;
    }

    return msg;
  }
}

export const skillTreeService = new SkillTreeService();
