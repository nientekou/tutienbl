"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.noituService = exports.NoituService = void 0;
const discord_js_1 = require("discord.js");
const uiSystem_1 = require("../utils/uiSystem");
const UserRepository_1 = require("../database/repositories/UserRepository");
const database_1 = __importDefault(require("../database/database"));
const API_BASE = 'https://dict.minhqnd.com/api/v1';
// ── Constants ──
const TURN_TIME_MS = 45_000;
const MAX_NO_ANSWER = 5;
const WIN_REWARD = 500;
const STARTING_WORDS = [
    // ── Thiên nhiên ──
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
    // ── Đời sống ──
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
    // ── Đồ vật ──
    'bút thước', 'giấy tờ', 'bản đồ', 'la bàn', 'ổ khóa',
    'chìa khóa', 'két sắt', 'giỏ quà', 'nến thơm', 'khung ảnh',
    'gương soi', 'bàn chải', 'kéo cắt', 'dao cắt', 'búa đập',
    'đinh vít', 'tua vít', 'cờ lê', 'kìm cắt', 'tivi',
    'tàu chiến', 'tàu ngầm',
    // ── Động vật ──
    'con mèo', 'con chó', 'con gà', 'con vịt', 'con ngựa',
    'con bò', 'con heo', 'con dê', 'con cừu', 'con voi',
    'con hổ', 'con báo', 'con gấu', 'con sói', 'con thỏ',
    'con nai', 'con công', 'con quạ', 'con diều', 'con én',
    'con sẻ', 'con vẹt', 'con cú', 'con rắn', 'con ếch',
    'con tôm', 'con cua', 'con mực', 'con cá', 'con sò',
    'con ong', 'con bướm', 'con kiến', 'con mối', 'con sâu',
    'con sam', 'con ngao', 'con ốc',
    // ── Cảm xúc ──
    'vui vẻ', 'hạnh phúc', 'buồn bã', 'giận dữ', 'sợ hãi',
    'ngạc nhiên', 'tự hào', 'nhớ nhung', 'yêu thương', 'thân thiện',
    'tự tin', 'can đảm', 'kiên cường', 'phấn khởi', 'hào hứng',
    'thất vọng', 'chán nản', 'lo lắng', 'bồn chồn', 'hoang mang',
    'kinh ngạc', 'ngỡ ngàng', 'thương nhớ', 'mong nhớ', 'mến mộ',
    'tôn kính', 'ngưỡng mộ', 'chân thành', 'thật thà', 'quyết đoán',
    // ── Xianxia / Tu tiên ──
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
    // ── Cơ thể ──
    'đầu óc', 'mắt sáng', 'tai nghe', 'miệng cười', 'răng trắng',
    'vai rộng', 'tay chân', 'ngón tay', 'bàn tay', 'cánh tay',
    'lưng thẳng', 'đầu gối', 'bắp chân', 'xương sống', 'máu nóng',
    'tim đập', 'phổi thở', 'dạ dày', 'não bộ', 'mạch máu',
    // ── Thời gian ──
    'buổi sáng', 'buổi trưa', 'buổi chiều', 'buổi tối', 'nửa đêm',
    'mùa xuân', 'mùa hè', 'mùa thu', 'mùa đông', 'năm mới',
    'ngày lễ', 'ngày nghỉ', 'giờ phút', 'giây khắc', 'bình minh',
    // ── Giáo dục ──
    'sách vở', 'vở viết', 'bút chì', 'bút mực', 'cặp sách',
    'điểm số', 'đề thi', 'bài thi', 'câu hỏi', 'đáp án',
    'giáo trình', 'bài giảng', 'bài tập', 'luận văn',
    // ── Sức khỏe ──
    'khám bệnh', 'tiêm phòng', 'uống thuốc', 'bệnh viện', 'nhà thuốc',
    'phẫu thuật', 'hồi phục', 'điều trị',
    'dinh dưỡng', 'vitamin', 'thực phẩm',
    // ── Du lịch ──
    'vé máy bay', 'khách sạn', 'homestay', 'hành lý',
    'địa điểm', 'danh lam', 'thắng cảnh', 'di tích', 'lịch sử',
    'văn hóa', 'ẩm thực', 'mua sắm', 'giải trí', 'nghỉ dưỡng',
    // ── Khoa học ──
    'vũ trụ', 'hành tinh', 'thiên hà', 'vật lý', 'hóa học',
    'sinh học', 'toán học', 'nguyên tử', 'năng lượng', 'đại dương',
    // ── Nghệ thuật ──
    'âm nhạc', 'hội họa', 'điêu khắc', 'thơ ca', 'văn chương',
    'sân khấu', 'điện ảnh', 'nhiếp ảnh', 'ca múa',
    'tranh lụa', 'tranh vẽ', 'màu nước',
    'đàn piano', 'đàn guitar', 'sáo trúc', 'đàn tranh',
    // ── Địa lý ──
    'châu Á', 'châu Âu', 'châu Phi', 'châu Mỹ',
    'đại dương', 'lục địa', 'biển Đông',
    'sông Hồng', 'hồ Gươm', 'núi Bà', 'đà Lạt',
    'Phú Quốc', 'Hạ Long', 'Hội An', 'Huế cổ', 'Sapa',
    'Nha Trang', 'Hà Nội', 'Sài Gòn',
    // ── Thể thao ──
    'bóng đá', 'bóng rổ', 'bóng chuyền', 'bóng bàn',
    'cầu lông', 'quần vợt', 'đua xe', 'bơi lội',
    'điền kinh', 'vật lộn', 'cử tạ', 'yoga',
    // ── Công nghệ ──
    'phần mềm', 'phần cứng', 'máy chủ', 'công nghệ',
    'trí tuệ', 'nhân tạo', 'robot',
    'điện toán', 'an ninh', 'dữ liệu', 'thuật toán',
    'lập trình', 'ứng dụng', 'website',
    // ── Kinh tế ──
    'thu nhập', 'chi tiêu', 'tiết kiệm', 'đầu tư', 'kinh doanh',
    'lợi nhuận', 'ngân hàng', 'chứng khoán', 'vàng bạc', 'tiền tệ',
    // ── Đồ ăn thức uống ──
    'trà xanh', 'trà sữa', 'nước chanh', 'nước cam', 'nước dừa',
    'sinh tố', 'nước ép', 'kem ly', 'bia lạnh', 'rượu vang',
    'rau muống', 'rau cải', 'cà rốt', 'cà chua', 'khoai tây',
    'hành tây', 'gừng tươi', 'ớt đỏ', 'tiêu đen', 'muối trắng',
    'đường phèn', 'nước mắm', 'dầu ăn', 'đậu hũ', 'đậu nành',
    'thịt bò', 'thịt gà', 'thịt heo', 'cá hồi', 'cá ngừ',
    'tôm sú', 'tôm hùm', 'ghẹ biển', 'cua biển', 'sò huyết',
    'mực ống', 'bạch tuộc', 'trứng gà', 'trứng vịt', 'trứng lộn',
    // ── Gia đình ──
    'ông bà', 'cha mẹ', 'anh chị', 'em út', 'cháu nhỏ',
    'chú bác', 'cô dì', 'vợ chồng', 'bạn đời', 'người yêu',
    // ── Xã hội ──
    'cộng đồng', 'xã hội', 'dân cư', 'đô thị', 'nông thôn',
    'báo chí', 'truyền hình', 'internet', 'điện tử',
    // ── Tôn giáo ──
    'đạo Phật', 'thiền định', 'cầu nguyện', 'giác ngộ', 'từ bi',
];
// ── In-memory state ──
const globalAny = global;
if (!globalAny.__activeNoituGames) {
    globalAny.__activeNoituGames = new Map();
}
// ── API helpers ──
async function lookupWord(word) {
    try {
        const res = await fetch(`${API_BASE}/lookup?word=${encodeURIComponent(word)}&lang=vi`);
        if (!res.ok)
            return false;
        const data = await res.json();
        return data.exists === true;
    }
    catch {
        return false;
    }
}
// ── Service ──
class NoituService {
    games = globalAny.__activeNoituGames;
    // Skip vote state per game
    skipVotes = new Map();
    getGame(gameKey) {
        return this.games.get(gameKey);
    }
    startGame(guildId, channelId) {
        const gameKey = `${guildId}:${channelId}`;
        this.stopGame(gameKey);
        const word = STARTING_WORDS[Math.floor(Math.random() * STARTING_WORDS.length)].toLowerCase();
        const game = {
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
        };
        this.games.set(gameKey, game);
        this.startTimer(game);
        return game;
    }
    stopGame(gameKey) {
        const game = this.games.get(gameKey);
        if (game?.timer)
            clearTimeout(game.timer);
        this.games.delete(gameKey);
    }
    async handleWord(gameKey, userId, username, word) {
        const game = this.games.get(gameKey);
        if (!game)
            return { accepted: false, message: 'Không có ván nào!' };
        const w = word.trim().toLowerCase();
        if (game.usedWords.has(w))
            return { accepted: false, message: `**"${w}"** đã dùng rồi!` };
        if (this.firstSyl(w) !== game.lastSyllable)
            return { accepted: false, message: `Phải bắt đầu bằng **"${game.lastSyllable}"**!` };
        if (w.split(/\s+/).length < 2)
            return { accepted: false, message: 'Cần ít nhất 2 âm tiết!' };
        const valid = await lookupWord(w);
        if (!valid)
            return { accepted: false, message: `**"${w}"** không có trong từ điển!` };
        // Valid
        game.usedWords.add(w);
        game.currentWord = w;
        game.lastSyllable = this.lastSyl(w);
        game.lastAnswererId = userId;
        game.lastAnswererName = username;
        game.turnNumber++;
        game.noAnswerStreak = 0;
        if (game.timer)
            clearTimeout(game.timer);
        this.startTimer(game);
        return { accepted: true, message: '' };
    }
    handleTimeout(gameKey) {
        const game = this.games.get(gameKey);
        if (!game)
            return { action: 'stop', oldSyllable: '', winnerName: '' };
        const oldSyllable = game.lastSyllable;
        const winnerName = game.lastAnswererName;
        game.noAnswerStreak++;
        game.turnNumber++;
        if (game.noAnswerStreak >= MAX_NO_ANSWER) {
            this.games.delete(gameKey);
            return { action: 'stop', oldSyllable, winnerName };
        }
        // Pick new word
        const newWord = this.pickNewWord(game);
        game.currentWord = newWord;
        game.lastSyllable = this.lastSyl(newWord);
        game.usedWords.add(newWord);
        this.startTimer(game);
        return { action: 'continue', oldSyllable, winnerName };
    }
    startTimer(game) {
        if (game.timer)
            clearTimeout(game.timer);
        game.turnExpiry = Date.now() + TURN_TIME_MS;
        const gameKey = `${game.guildId}:${game.channelId}`;
        game.timer = setTimeout(() => {
            const { action, oldSyllable, winnerName } = this.handleTimeout(gameKey);
            if (!game.client)
                return;
            const channel = game.client.channels.cache.get(game.channelId);
            if (!channel || !('send' in channel))
                return;
            if (action === 'stop') {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('Nối Từ Kết Thúc')
                    .setColor(uiSystem_1.EMBED_COLORS.GOLD)
                    .setDescription([
                    `**${MAX_NO_ANSWER} lượt liên tiếp không ai nối.**`,
                    '',
                    winnerName
                        ? `🏆 **${winnerName}** thắng — nhận **${WIN_REWARD}** Hạ Phẩm Linh Thạch!`
                        : 'Không có ai chiến thắng.',
                ].join('\n'));
                channel.send({ embeds: [embed] }).catch(() => { });
                // Give reward
                if (winnerName) {
                    const g = this.games.get(gameKey);
                    if (g?.lastAnswererId) {
                        const user = UserRepository_1.userRepository.get(g.lastAnswererId);
                        if (user) {
                            UserRepository_1.userRepository.update(g.lastAnswererId, { coin_ha_pham: user.coin_ha_pham + WIN_REWARD });
                        }
                    }
                }
            }
            else {
                const g = this.games.get(gameKey);
                if (!g)
                    return;
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('Hết Thời Gian')
                    .setColor(uiSystem_1.EMBED_COLORS.WARNING)
                    .setDescription([
                    winnerName
                        ? `🏆 **${winnerName}** thắng ván này — nhận **${WIN_REWARD}** Hạ Phẩm Linh Thạch!`
                        : `Không ai nối **"${oldSyllable}"**`,
                    '',
                    `🔄 **Ván mới:**`,
                    `📜 **${g.currentWord}** → *${g.lastSyllable}*`,
                    `⏱ 45s  •  Từ #${g.turnNumber}`,
                    '',
                    `💬 Gõ từ bắt đầu bằng **${g.lastSyllable}**`,
                ].join('\n'))
                    .setTimestamp();
                channel.send({ embeds: [embed] }).catch(() => { });
                // Give reward
                if (winnerName && g.lastAnswererId) {
                    const user = UserRepository_1.userRepository.get(g.lastAnswererId);
                    if (user) {
                        UserRepository_1.userRepository.update(g.lastAnswererId, { coin_ha_pham: user.coin_ha_pham + WIN_REWARD });
                    }
                }
            }
        }, TURN_TIME_MS);
    }
    pickNewWord(game) {
        let word = STARTING_WORDS[Math.floor(Math.random() * STARTING_WORDS.length)].toLowerCase();
        let tries = 0;
        while (game.usedWords.has(word) && tries < 50) {
            word = STARTING_WORDS[Math.floor(Math.random() * STARTING_WORDS.length)].toLowerCase();
            tries++;
        }
        return word;
    }
    lastSyl(word) {
        return word.trim().split(/\s+/).pop() || word;
    }
    firstSyl(word) {
        return word.trim().split(/\s+/)[0] || word;
    }
    buildGameEmbed(game, extra) {
        const timeLeft = Math.max(0, Math.ceil((game.turnExpiry - Date.now()) / 1000));
        const lines = [];
        if (extra)
            lines.push(extra, '');
        lines.push(`📜 **${game.currentWord}** → *${game.lastSyllable}*`, `⏱ ${timeLeft}s  •  Từ #${game.turnNumber}`);
        if (game.noAnswerStreak > 0) {
            lines.push(`⚠️ ${game.noAnswerStreak}/${MAX_NO_ANSWER} lượt chưa ai nối`);
        }
        lines.push('', `💬 Gõ từ bắt đầu bằng **${game.lastSyllable}**`);
        return new discord_js_1.EmbedBuilder()
            .setTitle('Nối Từ')
            .setColor(uiSystem_1.EMBED_COLORS.INFO)
            .setDescription(lines.join('\n'))
            .setTimestamp();
    }
    // ── Word count ──
    getWordCount() {
        const row = database_1.default.prepare('SELECT COUNT(*) as c FROM noitu_words').get();
        return row.c;
    }
    // ── Suggestions ──
    getPendingSuggestions() {
        return database_1.default.prepare('SELECT id, word, suggested_by, suggested_at FROM noitu_word_suggestions WHERE status = \'pending\' ORDER BY suggested_at DESC').all();
    }
    suggestWord(word, userId) {
        const exists = database_1.default.prepare('SELECT 1 FROM noitu_words WHERE word = ?').get(word);
        if (exists)
            return 'exists';
        const pending = database_1.default.prepare('SELECT 1 FROM noitu_word_suggestions WHERE word = ? AND status = \'pending\'').get(word);
        if (pending)
            return 'pending_exists';
        database_1.default.prepare('INSERT INTO noitu_word_suggestions (word, suggested_by, suggested_at) VALUES (?, ?, ?)').run(word, userId, Math.floor(Date.now() / 1000));
        return 'ok';
    }
    bulkApproveSuggestions(userId) {
        const pending = database_1.default.prepare('SELECT id, word FROM noitu_word_suggestions WHERE status = \'pending\'').all();
        if (pending.length === 0)
            return 0;
        const tx = database_1.default.transaction(() => {
            for (const s of pending) {
                database_1.default.prepare('INSERT OR IGNORE INTO noitu_words (word, source) VALUES (?, ?)').run(s.word, 'suggestion');
                database_1.default.prepare('UPDATE noitu_word_suggestions SET status = \'approved\', reviewed_by = ?, reviewed_at = ? WHERE id = ?').run(userId, Math.floor(Date.now() / 1000), s.id);
            }
        });
        tx();
        return pending.length;
    }
    reviewSuggestion(id, action, userId) {
        const row = database_1.default.prepare('SELECT id, status, word FROM noitu_word_suggestions WHERE id = ?').get(id);
        if (!row)
            return 'not_found';
        if (row.status !== 'pending')
            return 'already_reviewed';
        const now = Math.floor(Date.now() / 1000);
        if (action === 'approve') {
            database_1.default.prepare('INSERT OR IGNORE INTO noitu_words (word, source) VALUES (?, ?)').run(row.word, 'suggestion');
        }
        database_1.default.prepare('UPDATE noitu_word_suggestions SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?').run(action === 'approve' ? 'approved' : 'rejected', userId, now, id);
        return 'ok';
    }
    // ── Skip vote ──
    SKIP_VOTE_THRESHOLD = 3;
    startSkipVote(gameKey) {
        if (this.skipVotes.has(gameKey))
            return null;
        const game = this.games.get(gameKey);
        if (!game)
            return null;
        this.skipVotes.set(gameKey, { voters: new Set(), channelId: game.channelId });
        return {
            embed: this.buildSkipVoteEmbed(game),
            row: this.buildSkipVoteRow(gameKey),
        };
    }
    handleSkipVote(gameKey, userId) {
        const game = this.games.get(gameKey);
        if (!game)
            return 'no_game';
        const vote = this.skipVotes.get(gameKey);
        if (!vote)
            return 'no_game';
        if (vote.voters.has(userId))
            return 'already_voted';
        vote.voters.add(userId);
        if (vote.voters.size >= this.SKIP_VOTE_THRESHOLD) {
            this.skipVotes.delete(gameKey);
            return 'skip_passed';
        }
        return 'voted';
    }
    buildSkipVoteEmbed(game) {
        const vote = this.skipVotes.get(`${game.guildId}:${game.channelId}`);
        const count = vote ? vote.voters.size : 0;
        return new discord_js_1.EmbedBuilder()
            .setTitle('🗳️ Bỏ Phiếu Bỏ Qua')
            .setColor(uiSystem_1.EMBED_COLORS.WARNING)
            .setDescription(`📜 Từ hiện tại: **${game.currentWord}** → *${game.lastSyllable}*\n\n` +
            `👥 **${count}/${this.SKIP_VOTE_THRESHOLD}** phiếu cần để bỏ qua\n\n` +
            `_Nhấn nút bên dưới để bỏ phiếu._`)
            .setTimestamp();
    }
    buildSkipVoteRow(gameKey) {
        return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`noituskip_${gameKey}`)
            .setLabel('🗳️ Bỏ Phiếu Bỏ Qua')
            .setStyle(discord_js_1.ButtonStyle.Primary));
    }
    buildSkipPassedEmbed(winnerName, game) {
        const extra = winnerName
            ? `🏆 **${winnerName}** thắng — nhận **${WIN_REWARD}** Hạ Phẩm Linh Thạch!`
            : 'Không có ai chiến thắng.';
        return new discord_js_1.EmbedBuilder()
            .setTitle('✅ Đã Bỏ Qua Từ')
            .setColor(uiSystem_1.EMBED_COLORS.SUCCESS)
            .setDescription(`Từ **"${game.currentWord}"** đã được bỏ qua.\n` +
            `${extra}\n\n` +
            `🔄 **Từ mới:** *${game.lastSyllable}*\n` +
            `💬 Gõ từ bắt đầu bằng **${game.lastSyllable}**`)
            .setTimestamp();
    }
}
exports.NoituService = NoituService;
exports.noituService = new NoituService();
