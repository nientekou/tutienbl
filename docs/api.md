# API Reference — Vạn Thế Tu Tiên Bot

## Overview
This document provides a comprehensive API reference for the Vạn Thế Tu Tiên Discord bot.

## Commands

### General Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `/hoso` | View profile | `/hoso [@user]` |
| `/lamviec` | Work for resources | `/lamviec` |
| `/linhdien` | View leyline | `/linhdien` |
| `/tongmon` | Sect management | `/tongmon` |
| `/leothap` | Roguelike tower | `/leothap trangthai` |
| `/nhiemvu` | View quests | `/nhiemvu` |
| `/shop` | Shop | `/shop` |
| `/trangbi` | Equipment | `/trangbi` |
| `/kynang` | Skills | `/kynang xem` |
| `/tamphap` | Heart Law | `/tamphap` |
| `/linhcan` | Spiritual Root | `/linhcan` |

### Combat Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `/arena` | PvP Arena | `/arena` |
| `/bicanh` | Elite Dungeon | `/bicanh` |
| `/worldboss` | World Boss | `/worldboss` |

### Life Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `/chetao` | Crafting | `/chetao` |
| `/dongphu` | Cave | `/dongphu` |
| `/luyendan` | Alchemy | `/luyendan` |

## Prefix Commands
| Prefix | Description | Example |
|--------|-------------|---------|
| `bhoso` | Profile | `bhoso` |
| `blamviec` | Work | `blamviec` |
| `blinhdien` | Leyline | `blinhdien` |
| `btongmon` | Sect | `btongmon` |
| `bleothap` | Tower | `bleothap` |
| `bnhiemvu` | Quests | `bnhiemvu` |
| `bshop` | Shop | `bshop` |

## Game Systems

### Cultivation
- **Leveling**: EXP from meditation, work, combat
- **Breakthrough**: Major realm transitions (Luyện Khí → Trúc Cơ → ...)
- **Prestige**: Reset at max level for permanent bonuses

### Combat
- **Skills**: 6 elemental skills with mastery system
- **Equipment**: Enhance, reforge, set bonuses
- **Pets**: Combat companions with passives

### Social
- **Sects**: Guilds with levels, skills, shops
- **Marriage**: Partner system with joint skills
- **Mentor**: Teaching system with rewards

### Economy
- **Market**: Player trading with dynamic tax
- **Crafting**: Alchemy, forging, cooking with mastery
- **Exploration**: Find treasures and rare items

## Error Codes
| Code | Description |
|------|-------------|
| `INVALID_INPUT` | User input validation failed |
| `INSUFFICIENT_FUNDS` | Not enough currency |
| `COOLDOWN` | Action on cooldown |
| `NOT_FOUND` | Resource not found |
| `UNAUTHORIZED` | No permission |

## Rate Limits
| Action | Per Minute | Per Hour | Per Day |
|--------|-----------|----------|---------|
| Default | 30 | 500 | 5000 |
| Combat | 10 | 200 | 2000 |
| Trading | 5 | 100 | 1000 |
| Social | 20 | 300 | 3000 |
