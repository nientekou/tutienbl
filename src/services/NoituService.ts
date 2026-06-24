import { TuTienClient } from '../client/TuTienClient';
import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { EMBED_COLORS, toV2Payload, safeV2Update } from '../utils/uiSystem';
import { userRepository } from '../database/repositories/UserRepository';
import db from '../database/database';

// ── Types ──

export interface NoituGameState {
  guildId: string;
  channelId: string;
  currentWord: string;
  lastSyllable: string;
  lastAnswererId: string;
  lastAnswererName: string;
  timer: ReturnType<typeof setTimeout> | null;
  turnExpiry: number;
  turnNumber: number;
  usedWords: Set<string>;
  noAnswerStreak: number;
  client?: TuTienClient;
  skipVotes: Set<string>;
  skipMessageId: string | null;
}

// ── Constants ──

const TURN_TIME_MS = 3_600_000; // ponytail: 1 hour per turn (was 45s)
const MAX_NO_ANSWER = 5;
const WIN_REWARD = 500;

const STARTING_WORDS = [
  'mặt trời', 'mặt trăng', 'ngôi sao', 'bầu trời', 'gió mát',
  'mưa rơi', 'tuyết rơi', 'sấm chớp', 'cầu vồng', 'mây trắng',
  'biển cả', 'sông dài', 'núi cao', 'đồng bằng', 'thung lũng',
  'hồ nước', 'suối nhỏ', 'rừng xanh', 'cỏ dại', 'lá rơi',
  'hoa nở', 'hoa hồng', 'hoa cúc', 'hoa mai', 'hoa đào',
  'hoa sen', 'hoa lan', 'giọt sương', 'ánh nắng', 'tia sáng',
  'nắng vàng', 'mưa phùn', 'sương mù', 'đá cuội', 'cát trắng',
  'nước sạch', 'lửa cháy', 'núi lửa', 'hòn đảo', 'bờ biển',
  'cồn cát', 'khói bụi', 'tro tàn', 'nước đá', 'mây đen',
  'gió mạnh', 'trời quang', 'sương giá', 'hơi nước', 'đá xanh',
  'học sinh', 'giáo viên', 'bác sĩ', 'kỹ sư', 'nông dân',
  'thợ máy', 'lái xe', 'ngư dân', 'thợ rèn', 'bếp trưởng',
  'nhà văn', 'nhà thơ', 'họa sĩ', 'nhạc sĩ', 'diễn viên',
  'cơm tấm', 'phở bò', 'bún chả', 'bánh mì', 'bánh xèo',
  'bánh chưng', 'cháo gà', 'mì Quảng', 'bún bò', 'trà đá',
  'nước mía', 'cà phê', 'sữa chua', 'kem dừa', 'chè đậu',
  'đường phố', 'ngõ hẻm', 'phố cổ', 'nhà thờ', 'cầu treo',
  'bến phà', 'ga tàu', 'sân bay', 'bến xe', 'đèo cao',
  'xe buýt', 'xe tải', 'xe máy', 'xe đạp', 'tàu hỏa',
  'máy bay', 'đồng hồ', 'máy tính', 'điện thoại', 'máy ảnh',
  'quạt mát', 'đèn pin', 'nồi cơm', 'tủ lạnh', 'máy giặt',
  'giường ngủ', 'gối ôm', 'bàn học', 'ghế ngồi', 'tủ kính',
  'tường nhà', 'mái nhà', 'sân vườn', 'cổng sắt', 'hàng rào',
  'cửa gỗ', 'cửa kính', 'cửa sổ', 'phòng ngủ', 'phòng khách',
  'nhà bếp', 'phòng tắm', 'sân thượng', 'ban công', 'cầu thang',
  'bút thước', 'giấy tờ', 'bản đồ', 'la bàn', 'ổ khóa',
  'chìa khóa', 'két sắt', 'giỏ quà', 'nến thơm', 'khung ảnh',
  'gương soi', 'bàn chải', 'kéo cắt', 'dao cắt', 'búa đập',
  'con mèo', 'con chó', 'con gà', 'con vịt', 'con ngựa',
  'con bò', 'con heo', 'con dê', 'con cừu', 'con voi',
  'con hổ', 'con báo', 'con gấu', 'con sói', 'con thỏ',
  'con nai', 'con công', 'con quạ', 'con diều', 'con én',
  'con sẻ', 'con vẹt', 'con cú', 'con rắn', 'con ếch',
  'con tôm', 'con cua', 'con mực', 'con cá', 'con sò',
  'con ong', 'con bướm', 'con kiến', 'con mối', 'con sâu',
  'vui vẻ', 'hạnh phúc', 'buồn bã', 'giận dữ', 'sợ hãi',
  'ngạc nhiên', 'tự hào', 'nhớ nhung', 'yêu thương', 'thân thiện',
  'tự tin', 'can đảm', 'kiên cường', 'phấn khởi', 'hào hứng',
  'linh khí', 'linh mạch', 'linh căn', 'linh dược', 'linh thạch',
  'linh thảo', 'linh thú', 'linh đan', 'linh phù',
  'tu luyện', 'tu sĩ', 'đắc đạo', 'phi thăng', 'thiên kiếp',
  'pháp bảo', 'pháp khí', 'pháp trận', 'pháp thuật', 'pháp quyết',
  'đan dược', 'đan lô', 'đan phương', 'đan sư',
  'kiếm khí', 'kiếm thuật', 'kiếm ý', 'kiếm phong', 'kiếm linh',
  'công pháp', 'công lực', 'đấu pháp', 'ngũ hành',
  'thiên địa', 'nhật nguyệt', 'hư không', 'huyền huyễn',
  'bí cảnh', 'tiên cảnh', 'phật cảnh', 'ma cảnh', 'quỷ vực',
  'thần thông', 'thần lực', 'thần kiếm', 'thần đan',
  'tiên nữ', 'tiên tử', 'tiên đan', 'tiên khí',
  'ma vương', 'ma kiếm', 'ma pháp', 'ma lực',
  'phật tổ', 'phật pháp', 'phật tâm',
  'long tộc', 'rồng vàng', 'rồng bạc', 'rồng đen', 'rồng đỏ',
  'phượng hoàng', 'phượng vũ',
  'cửu thiên', 'tam giới', 'lục đạo', 'bát quái',
  'đấu giá', 'thương hội', 'thánh địa', 'tông môn',
  'đệ tử', 'trưởng lão', 'chưởng môn', 'tông chủ',
  'trận pháp', 'phong ấn', 'đạo lý', 'đạo pháp',
  'linh mục', 'linh điền', 'linh tuyền', 'linh sơn',
  'kiếm trận', 'đao pháp', 'quyền pháp', 'thân pháp',
  'thiên cơ', 'phong thủy', 'bát tự',
  'đại la', 'kim tiên', 'chân tiên', 'thiên tiên',
  'tiên thiên', 'căn cơ', 'phúc duyên', 'nghiệp lực',
  'yêu tinh', 'đại yêu', 'yêu vương',
  'quỷ đế', 'huyết quỷ', 'hung quỷ',
  'thiên mệnh', 'nhân hòa', 'thiên thời', 'địa lợi',
  'bất diệt', 'vô cùng', 'vô hạn', 'vô song', 'vô địch',
  'đại đạo', 'tiểu đạo', 'chánh đạo', 'thiên đạo',
  'đầu óc', 'mắt sáng', 'tai nghe', 'miệng cười', 'răng trắng',
  'vai rộng', 'tay chân', 'ngón tay', 'bàn tay', 'cánh tay',
  'buổi sáng', 'buổi trưa', 'buổi chiều', 'buổi tối', 'nửa đêm',
  'mùa xuân', 'mùa hè', 'mùa thu', 'mùa đông', 'năm mới',
  'sách vở', 'vở viết', 'bút chì', 'bút mực', 'cặp sách',
  'điểm số', 'đề thi', 'bài thi', 'câu hỏi', 'đáp án',
  'khám bệnh', 'tiêm phòng', 'uống thuốc', 'bệnh viện', 'nhà thuốc',
  'vé máy bay', 'khách sạn', 'homestay', 'hành lý',
  'vũ trụ', 'hành tinh', 'thiên hà', 'vật lý', 'hóa học',
  'sinh học', 'toán học', 'nguyên tử', 'năng lượng', 'đại dương',
  'âm nhạc', 'hội họa', 'điêu khắc', 'thơ ca', 'văn chương',
  'sân khấu', 'điện ảnh', 'nhiếp ảnh', 'ca múa',
  'châu Á', 'châu Âu', 'châu Phi', 'châu Mỹ',
  'bóng đá', 'bóng rổ', 'bóng chuyền', 'bóng bàn',
  'cầu lông', 'quần vợt', 'đua xe', 'bơi lội',
  'phần mềm', 'phần cứng', 'máy chủ', 'công nghệ',
  'thu nhập', 'chi tiêu', 'tiết kiệm', 'đầu tư', 'kinh doanh',
  'trà xanh', 'trà sữa', 'nước chanh', 'nước cam', 'nước dừa',
  'rau muống', 'rau cải', 'cà rốt', 'cà chua', 'khoai tây',
  'thịt bò', 'thịt gà', 'thịt heo', 'cá hồi', 'cá ngừ',
  'ông bà', 'cha mẹ', 'anh chị', 'em út', 'cháu nhỏ',
  'cộng đồng', 'xã hội', 'dân cư', 'đô thị', 'nông thôn',
  'đạo Phật', 'thiền định', 'cầu nguyện', 'giác ngộ', 'từ bi',
];

// ── In-memory state ──

const globalAny: any = global;
if (!globalAny.__activeNoituGames) {
  globalAny.__activeNoituGames = new Map<string, NoituGameState>();
}

// ── API sources cho từ điển mở rộng ──
// ponytail: Thêm URL vào mảng này để mở rộng nguồn tra. Response parser (`isWordValid`) tự động nhận dạng
//           { exists: boolean }, { valid: boolean }, hoặc array (tồn tại nếu length > 0).
const API_SOURCES = [
  'https://dict.minhqnd.com/api/v1/lookup?word=${word}&lang=vi',
  'https://vietnamese-dictionary-api.vercel.app/api/search?word=${word}',
  'https://freedictionaryapi.com/api/v1/entries/vi/${word}',
  'https://api.dictionaryapi.dev/api/v2/entries/vi/${word}',
];

// ── DB helpers ──

function isValidWord(word: string): boolean {
  const row = db.prepare('SELECT 1 FROM noitu_words WHERE word = ?').get(word.trim().toLowerCase());
  return !!row;
}

function addWord(word: string, source: string): void {
  db.prepare('INSERT OR IGNORE INTO noitu_words (word, source) VALUES (?, ?)').run(word.trim().toLowerCase(), source);
}

async function lookupExternal(word: string): Promise<boolean> {
  const results = await Promise.allSettled(
    API_SOURCES.map(url => {
      const full = url.replace('${word}', encodeURIComponent(word));
      return fetch(full, { signal: AbortSignal.timeout(5000) })
        .then(r => (r.ok ? r.json() : null))
        .then(d => isWordValid(d));
    })
  );
  return results.some(r => r.status === 'fulfilled' && r.value === true);
}

function isWordValid(data: unknown): boolean {
  if (!data) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.exists === true) return true;
  if (d.valid === true) return true;
  return false;
}

async function validateAndCache(word: string): Promise<boolean> {
  const clean = word.trim().toLowerCase();
  if (isValidWord(clean)) return true;
  const valid = await lookupExternal(clean);
  if (valid) addWord(clean, 'api_cache');
  return valid;
}

export interface PendingSuggestion {
  id: number;
  word: string;
  suggested_by: string;
  suggested_at: number;
}

function moduleGetPendingSuggestions(): PendingSuggestion[] {
  return db.prepare(
    "SELECT id, word, suggested_by, suggested_at FROM noitu_word_suggestions WHERE status = 'pending' ORDER BY suggested_at ASC"
  ).all() as PendingSuggestion[];
}

function moduleGetSuggestionCount(): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM noitu_word_suggestions WHERE status = 'pending'").get() as { c: number };
  return row.c;
}

function giveReward(userId: string): void {
  if (!userId) return;
  try {
    const user = userRepository.get(userId);
    if (user) {
      userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham + WIN_REWARD });
    }
  } catch {}
}

// ── Word suggestion helpers ──

export type SuggestResult = 'exists' | 'pending_exists' | 'submitted';

function moduleSuggestWord(word: string, userId: string): SuggestResult {
  const clean = word.trim().toLowerCase();
  const syls = clean.split(/\s+/);
  if (syls.length < 2) return 'submitted'; // `too_short` catches this before calling us

  if (isValidWord(clean)) return 'exists';

  const existing = db.prepare("SELECT status FROM noitu_word_suggestions WHERE word = ?").get(clean) as { status: string } | undefined;
  if (existing) return 'pending_exists';

  db.prepare(
    'INSERT INTO noitu_word_suggestions (word, suggested_by, suggested_at) VALUES (?, ?, ?)'
  ).run(clean, userId, Math.floor(Date.now() / 1000));

  return 'submitted';
}

export type ReviewResult = 'approved' | 'rejected' | 'not_found' | 'already_reviewed';

function moduleReviewSuggestion(id: number, action: 'approve' | 'reject', reviewerId: string): ReviewResult {
  const suggestion = db.prepare('SELECT * FROM noitu_word_suggestions WHERE id = ?').get(id) as any;
  if (!suggestion) return 'not_found';
  if (suggestion.status !== 'pending') return 'already_reviewed';

  if (action === 'approve') {
    addWord(suggestion.word, 'suggested');
  }

  db.prepare(
    'UPDATE noitu_word_suggestions SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?'
  ).run(action === 'approve' ? 'approved' : 'rejected', reviewerId, Math.floor(Date.now() / 1000), id);

  return action === 'approve' ? 'approved' : 'rejected';
}

function moduleBulkApproveSuggestions(reviewerId: string): number {
  const pending = db.prepare(
    "SELECT id, word FROM noitu_word_suggestions WHERE status = 'pending'"
  ).all() as { id: number; word: string }[];

  if (pending.length === 0) return 0;

  const now = Math.floor(Date.now() / 1000);
  const tx = db.transaction(() => {
    for (const s of pending) {
      addWord(s.word, 'suggested');
      db.prepare(
        'UPDATE noitu_word_suggestions SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?'
      ).run('approved', reviewerId, now, s.id);
    }
  });
  tx();
  return pending.length;
}

// ── Service ──

export class NoituService {
  private games = globalAny.__activeNoituGames as Map<string, NoituGameState>;

  getGame(gameKey: string): NoituGameState | undefined {
    return this.games.get(gameKey);
  }

  startGame(guildId: string, channelId: string): NoituGameState {
    const gameKey = `${guildId}:${channelId}`;
    this.stopGame(gameKey);

    const word = STARTING_WORDS[Math.floor(Math.random() * STARTING_WORDS.length)].toLowerCase();
    const game: NoituGameState = {
      guildId,
      channelId,
      currentWord: word,
      lastSyllable: this.lastSyl(word),
      lastAnswererId: '',
      lastAnswererName: '',
      timer: null,
      turnExpiry: 0,
      turnNumber: 1,
      usedWords: new Set([word]),
      noAnswerStreak: 0,
      skipVotes: new Set(),
      skipMessageId: null,
    };

    this.games.set(gameKey, game);
    this.startTimer(game);
    return game;
  }

  stopGame(gameKey: string): void {
    const game = this.games.get(gameKey);
    if (game?.timer) clearTimeout(game.timer);
    if (game) {
      game.skipVotes.clear();
      game.skipMessageId = null;
    }
    this.games.delete(gameKey);
  }

  async handleWord(gameKey: string, userId: string, username: string, word: string): Promise<'valid' | 'wrong_start' | 'wrong_api' | 'already_used' | 'too_short' | 'no_game' | 'same_user'> {
    const game = this.games.get(gameKey);
    if (!game) return 'no_game';

    const w = word.trim().toLowerCase();

    if (game.lastAnswererId === userId) return 'same_user';
    if (game.usedWords.has(w)) return 'already_used';
    if (this.firstSyl(w) !== game.lastSyllable) return 'wrong_start';
    if (w.split(/\s+/).length < 2) return 'too_short';

    const valid = await validateAndCache(w);
    if (!valid) return 'wrong_api';

    this.clearSkipVote(gameKey);

    game.usedWords.add(w);
    game.currentWord = w;
    game.lastSyllable = this.lastSyl(w);
    game.lastAnswererId = userId;
    game.lastAnswererName = username;
    game.turnNumber++;
    game.noAnswerStreak = 0;

    if (game.timer) clearTimeout(game.timer);
    this.startTimer(game);

    return 'valid';
  }

  private startTimer(game: NoituGameState): void {
    if (game.timer) clearTimeout(game.timer);
    game.turnExpiry = Date.now() + TURN_TIME_MS;

    const gameKey = `${game.guildId}:${game.channelId}`;
    const turnAtStart = game.turnNumber;

    game.timer = setTimeout(() => {
      const g = this.games.get(gameKey);
      if (!g || g.turnNumber !== turnAtStart) return;

      const oldSyllable = g.lastSyllable;
      const winnerName = g.lastAnswererName;
      const winnerId = g.lastAnswererId;

      g.skipVotes.clear();
      g.skipMessageId = null;
      g.noAnswerStreak++;
      g.turnNumber++;

      if (g.noAnswerStreak >= MAX_NO_ANSWER) {
        giveReward(winnerId);
        this.games.delete(gameKey);

        const channel = g.client?.channels.cache.get(g.channelId);
        if (channel && 'send' in channel) {
          (channel as any).send(
            winnerName
              ? `Không còn từ để nối tiếp. **${winnerName}** thắng và nhận **${WIN_REWARD}** Hạ Phẩm Linh Thạch.`
              : `Không còn từ để nối tiếp. Không có ai chiến thắng.`
          ).catch(() => {});
        }
        return;
      }

      giveReward(winnerId);

      const newWord = this.pickNewWord(g);
      g.currentWord = newWord;
      g.lastSyllable = this.lastSyl(newWord);
      g.usedWords.add(newWord);
      g.lastAnswererId = '';
      g.lastAnswererName = '';

      g.turnExpiry = Date.now() + TURN_TIME_MS;
      const nextTurn = g.turnNumber;
      g.timer = setTimeout(() => {
        const g2 = this.games.get(gameKey);
        if (!g2 || g2.turnNumber !== nextTurn) return;
        this.handleTimeoutFire(gameKey);
      }, TURN_TIME_MS);

      const channel = g.client?.channels.cache.get(g.channelId);
      if (channel && 'send' in channel) {
        const embed = this.buildWinEmbed(winnerName, oldSyllable, g.currentWord, g.lastSyllable);
        (channel as any).send(toV2Payload([embed])).catch(() => {});
      }
    }, TURN_TIME_MS);
  }

  private handleTimeoutFire(gameKey: string): void {
    const g = this.games.get(gameKey);
    if (!g) return;

    const oldSyllable = g.lastSyllable;
    const winnerName = g.lastAnswererName;
    const winnerId = g.lastAnswererId;

    g.skipVotes.clear();
    g.skipMessageId = null;
    g.noAnswerStreak++;
    g.turnNumber++;

    if (g.noAnswerStreak >= MAX_NO_ANSWER) {
      giveReward(winnerId);
      this.games.delete(gameKey);

      const channel = g.client?.channels.cache.get(g.channelId);
      if (channel && 'send' in channel) {
        const embed = this.buildEndEmbed(winnerName);
        (channel as any).send(toV2Payload([embed])).catch(() => {});
      }
      return;
    }

    giveReward(winnerId);

    const newWord = this.pickNewWord(g);
    g.currentWord = newWord;
    g.lastSyllable = this.lastSyl(newWord);
    g.usedWords.add(newWord);
    g.lastAnswererId = '';
    g.lastAnswererName = '';

    g.turnExpiry = Date.now() + TURN_TIME_MS;
    const nextTurn = g.turnNumber;
    g.timer = setTimeout(() => {
      const g2 = this.games.get(gameKey);
      if (!g2 || g2.turnNumber !== nextTurn) return;
      this.handleTimeoutFire(gameKey);
    }, TURN_TIME_MS);

    const channel = g.client?.channels.cache.get(g.channelId);
    if (channel && 'send' in channel) {
      const embed = this.buildWinEmbed(winnerName, oldSyllable, g.currentWord, g.lastSyllable);
      (channel as any).send(toV2Payload([embed])).catch(() => {});
    }
  }

  private pickNewWord(game: NoituGameState): string {
    let word = STARTING_WORDS[Math.floor(Math.random() * STARTING_WORDS.length)].toLowerCase();
    let tries = 0;
    while (game.usedWords.has(word) && tries < 50) {
      word = STARTING_WORDS[Math.floor(Math.random() * STARTING_WORDS.length)].toLowerCase();
      tries++;
    }
    return word;
  }

  private lastSyl(word: string): string {
    return word.trim().split(/\s+/).pop() || word;
  }

  private firstSyl(word: string): string {
    return word.trim().split(/\s+/)[0] || word;
  }

  buildStartMessage(game: NoituGameState): string {
    return `Nối từ bắt đầu. Từ hiện tại: **${game.currentWord}**. Viết từ bắt đầu bằng **${game.lastSyllable}** (thời gian: 1 tiếng).`;
  }

  // ── Skip vote ──

  buildSkipVoteEmbed(game: NoituGameState): EmbedBuilder {
    const votes = game.skipVotes.size;
    const needed = 3;
    return new EmbedBuilder()
      .setTitle('⏭ Bỏ phiếu bỏ qua từ')
      .setColor(EMBED_COLORS.WARNING)
      .setDescription(
        `Từ hiện tại: **${game.currentWord}**\n` +
        `Bỏ phiếu bỏ qua từ này? (${votes}/${needed})\n` +
        `Người trả lời cuối: **${game.lastAnswererName || 'Chưa có'}** sẽ nhận thưởng nếu bỏ qua.`
      );
  }

  buildSkipVoteRow(gameKey: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`noituskip_${gameKey}`)
        .setLabel('Đồng ý bỏ qua')
        .setStyle(ButtonStyle.Danger)
    );
  }

  buildSkipPassedEmbed(winnerName: string, game: NoituGameState): EmbedBuilder {
    const lines = [
      `⏭ Đã bỏ qua từ cũ.`,
      winnerName
        ? `**${winnerName}** nhận **${WIN_REWARD}** Hạ Phẩm Linh Thạch.`
        : '',
      '',
      `Ván mới tiếp tục bắt đầu:`,
      `**${game.currentWord}** → Viết từ bắt đầu bằng chữ **${game.lastSyllable}**`,
    ];
    return new EmbedBuilder()
      .setTitle('Nối Từ')
      .setColor(EMBED_COLORS.SUCCESS)
      .setDescription(lines.filter(Boolean).join('\n'));
  }

  startSkipVote(gameKey: string): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } | null {
    const game = this.games.get(gameKey);
    if (!game) return null;
    if (game.skipVotes.size > 0) return null;

    game.skipVotes = new Set<string>();
    return {
      embed: this.buildSkipVoteEmbed(game),
      row: this.buildSkipVoteRow(gameKey),
    };
  }

  handleSkipVote(gameKey: string, userId: string): 'already_voted' | 'voted' | 'skip_passed' | 'no_game' {
    const game = this.games.get(gameKey);
    if (!game) return 'no_game';

    if (game.skipVotes.has(userId)) return 'already_voted';

    game.skipVotes.add(userId);

    if (game.skipVotes.size >= 3) {
      this.executeSkip(gameKey);
      return 'skip_passed';
    }

    return 'voted';
  }

  executeSkip(gameKey: string): void {
    const game = this.games.get(gameKey);
    if (!game) return;

    const winnerId = game.lastAnswererId;
    giveReward(winnerId);

    if (game.timer) clearTimeout(game.timer);

    const newWord = this.pickNewWord(game);
    game.currentWord = newWord;
    game.lastSyllable = this.lastSyl(newWord);
    game.usedWords.add(newWord);
    game.lastAnswererId = '';
    game.lastAnswererName = '';
    game.turnNumber++;
    game.noAnswerStreak = 0;

    this.startTimer(game);

    game.skipVotes = new Set();
    game.skipMessageId = null;
  }

  clearSkipVote(gameKey: string): void {
    const game = this.games.get(gameKey);
    if (!game) return;
    // Delete stale skip vote message if exists
    if (game.skipMessageId && game.client) {
      const channel = game.client.channels.cache.get(game.channelId);
      if (channel && 'messages' in channel) {
        (channel as any).messages.delete(game.skipMessageId).catch(() => {});
      }
    }
    game.skipVotes = new Set();
    game.skipMessageId = null;
  }

  private buildWinEmbed(winnerName: string, oldSyllable: string, newWord?: string, newSyllable?: string): EmbedBuilder {
    if (winnerName) {
      const lines = [
        `**${winnerName}** là người chiến thắng và nhận **${WIN_REWARD}** Hạ Phẩm Linh Thạch.`,
        '',
        `Ván mới tiếp tục bắt đầu:`,
        `**${newWord || '???'}** → Viết từ bắt đầu bằng chữ **${newSyllable || '???'}**`,
      ];
      return new EmbedBuilder()
        .setTitle('Nối Từ')
        .setColor(EMBED_COLORS.SUCCESS)
        .setDescription(lines.join('\n'));
    }
    const lines = [
      `Không ai nối **${oldSyllable}** trong 1 tiếng.`,
      '',
      `Ván mới tiếp tục bắt đầu:`,
      `**${newWord || '???'}** → Viết từ bắt đầu bằng chữ **${newSyllable || '???'}**`,
    ];
    return new EmbedBuilder()
      .setTitle('Nối Từ')
      .setColor(EMBED_COLORS.WARNING)
      .setDescription(lines.join('\n'));
  }

  private buildEndEmbed(winnerName: string): EmbedBuilder {
    if (winnerName) {
      return new EmbedBuilder()
        .setTitle('Nối Từ')
        .setColor(EMBED_COLORS.GOLD)
        .setDescription(`Không còn từ để nối tiếp.\n${winnerName} thắng và nhận **${WIN_REWARD}** Hạ Phẩm Linh Thạch.`);
    }
    return new EmbedBuilder()
      .setTitle('Nối Từ')
      .setColor(EMBED_COLORS.NEUTRAL)
      .setDescription(`Không còn từ để nối tiếp. Không có ai chiến thắng.`);
  }

  getWordCount(): number {
    const row = db.prepare('SELECT COUNT(*) as c FROM noitu_words').get() as { c: number };
    return row.c;
  }

  suggestWord(word: string, userId: string): SuggestResult {
    return moduleSuggestWord(word, userId);
  }

  getPendingSuggestions(): PendingSuggestion[] {
    return moduleGetPendingSuggestions();
  }

  getSuggestionCount(): number {
    return moduleGetSuggestionCount();
  }

  reviewSuggestion(id: number, action: 'approve' | 'reject', reviewerId: string): ReviewResult {
    return moduleReviewSuggestion(id, action, reviewerId);
  }

  bulkApproveSuggestions(reviewerId: string): number {
    return moduleBulkApproveSuggestions(reviewerId);
  }
}

export const noituService = new NoituService();
