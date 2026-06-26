# Deployment Guide — Vạn Thế Tu Tiên

## Prerequisites

### System Requirements
- Node.js 18+
- npm 9+
- SQLite 3.x
- Discord Bot Token

### Environment Variables
```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
DATABASE_PATH=./data/tutien.db
NODE_ENV=production
```

## Deployment Steps

### 1. Clone Repository
```bash
git clone <repository-url>
cd tutienbl
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your settings
```

### 4. Build
```bash
npm run build
```

### 5. Initialize Database
```bash
npm run db:init
```

### 6. Start Bot
```bash
npm start
```

## Configuration

### Database
- **Path**: `DATABASE_PATH` env var
- **Backup**: Run `npm run db:backup` regularly
- **WAL Mode**: Enabled for better performance

### Performance
- **Cache Size**: 64MB (configurable)
- **Mmap Size**: 256MB
- **Busy Timeout**: 5 seconds
- **Page Size**: 4096 bytes

### Monitoring
- **Logs**: Check `logs/` directory
- **Metrics**: Use `/selftest` command
- **Memory**: Use MemoryOptimizer utility

## Scaling

### Horizontal Scaling
- Multiple bot instances possible
- Share same database
- Use Redis for shared cache

### Vertical Scaling
- Increase Node.js memory limit
- Optimize database queries
- Use connection pooling

## Troubleshooting

### Common Issues
1. **Database locked**: Increase busy_timeout
2. **Memory leaks**: Use MemoryOptimizer
3. **Slow queries**: Check indexes
4. **Rate limiting**: Adjust rate limits

### Debug Mode
```bash
NODE_ENV=development npm start
```

## Backup & Recovery

### Backup
```bash
npm run db:backup
```

### Recovery
```bash
cp backup/latest.db data/tutien.db
npm start
```
