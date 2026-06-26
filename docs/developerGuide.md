# Developer Guide — Vạn Thế Tu Tiên

## Architecture Overview

### Project Structure
```
src/
├── commands/          # Slash commands
│   ├── general/       # General commands
│   ├── combat/        # Combat commands
│   └── life/          # Life skill commands
├── services/          # Business logic
├── database/          # Database layer
├── config/            # Configuration
├── handlers/          # Event handlers
├── utils/             # Utilities
└── structures/        # Base classes
```

### Key Patterns
- **Service Pattern**: Business logic in service classes
- **Repository Pattern**: Database access in repository classes
- **Event-Driven**: Discord events trigger handlers
- **Caching**: CacheService for frequently accessed data

## Code Standards

### TypeScript
- Use strict TypeScript
- Prefer interfaces over types
- Use async/await over callbacks
- Document public methods

### Naming Conventions
- **Files**: camelCase (e.g., `cultivationService.ts`)
- **Classes**: PascalCase (e.g., `CultivationService`)
- **Methods**: camelCase (e.g., `getLevelDetails`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_LEVEL`)

### Error Handling
- Use try-catch for database operations
- Return meaningful error messages
- Log errors for debugging

## Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Discord Bot Token

### Setup
1. Clone repository
2. Install dependencies: `npm install`
3. Configure `.env` file
4. Run: `npm start`

### Testing
- Unit tests: `npm test`
- Integration tests: `npm run test:integration`

## Contributing
1. Fork repository
2. Create feature branch
3. Make changes
4. Submit pull request
