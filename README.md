# TUIZ情報王 - Backend

**Backend API server for TUIZ情報王** - Express + TypeScript + Socket.IO backend providing REST APIs and real-time WebSocket communication for the quiz platform.

## 📖 About

This is the **backend** repository for TUIZ情報王, a real-time interactive quiz platform. The backend provides:

- **REST API**: Game operations, quiz management, player management, and data queries
- **WebSocket Server**: Real-time game events, synchronization, and live updates
- **Database Management**: Supabase/PostgreSQL integration with Row Level Security
- **Authentication**: JWT verification and role-based access control

## 🎯 Quick Start

### For Developers

1. **Clone the repository**

   ```bash
   git clone https://github.com/PandaDev0069/tuiz-backend.git
   cd tuiz-backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Minimum required variables:

   ```env
   PORT=8080
   CLIENT_ORIGINS=http://localhost:3000
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```
   Server runs on `http://localhost:8080`

## 🏗️ Project Overview

This backend serves the TUIZ frontend application by providing:

- **Game Management**: Create games, manage players, control game flow
- **Quiz Operations**: CRUD operations for quizzes, questions, and answers
- **Real-time Communication**: WebSocket events for synchronized game progression
- **Player Data**: Answer submission, leaderboard calculation, statistics
- **Authentication**: JWT verification and session management

### Technology Stack

- **Node.js 22** - Runtime environment
- **Express 5** - Web framework
- **TypeScript** - Type safety
- **Socket.IO** - WebSocket server
- **Supabase** - Database and authentication
- **PostgreSQL** - Database (via Supabase)

## 🔗 Related Repositories

- **Frontend**: [tuiz-frontend](https://github.com/PandaDev0069/tuiz-frontend) - Next.js frontend application
  - User manual and documentation are in the frontend repository
  - See [frontend user-manual](https://github.com/PandaDev0069/tuiz-frontend/tree/main/user-manual) for comprehensive guides

## 📡 API Overview

### Base URL

- **Development**: `http://localhost:8080`
- **Production**: Configured via environment variables

### Main Endpoints

- `/games` - Game operations (create, join, manage)
- `/quiz` - Quiz CRUD operations
- `/quiz-library` - Quiz library and browsing
- `/auth` - Authentication endpoints
- `/profile` - User profile management
- `/upload` - File uploads

### WebSocket Events

Real-time events for game synchronization:

- `room:join` / `room:leave` - Room management
- `game:question:start` - Question progression
- `game:answer:reveal` - Answer reveal
- `game:phase:change` - Phase transitions
- `game:player-joined` / `game:player-left` - Player events

## 🗄️ Database

The backend uses **Supabase (PostgreSQL)** with:

- **Active Tables**: profiles, quiz_sets, questions, answers, games, players, game_flows, game_player_data
- **Analytics Tables**: websocket_connections, device_sessions, game_events, room_participants (for future use)
- **Row Level Security (RLS)**: Enabled on all tables
- **Migrations**: Managed in `supabase/migrations/` folder

For complete database documentation, see the [frontend database schema documentation](https://github.com/PandaDev0069/tuiz-frontend/blob/main/user-manual/04-DATABASE-SCHEMA.md).

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run compiled server
- `npm run typecheck` - TypeScript type checking
- `npm run lint` - Run ESLint
- `npm run format` - Check code formatting
- `npm run format:write` - Fix code formatting

### Project Structure

```
src/
├── app.ts              # Express app factory
├── server.ts           # HTTP server + Socket.IO
├── config/             # Configuration (env, CORS)
├── middleware/         # Auth, rate limiting, error handling
├── routes/             # API route handlers
├── services/           # Business logic services
├── types/              # TypeScript type definitions
├── utils/              # Utilities (logger, validation)
└── lib/                # External library wrappers

supabase/
└── migrations/         # Database migration files
```

### Code Quality

- **TypeScript** - Strict type checking
- **ESLint** - Code linting with flat config
- **Prettier** - Code formatting
- **Husky** - Git hooks
- **Conventional Commits** - Commit message standards

## 🔐 Environment Variables

See `.env.example` for all available variables. Minimum for local development:

```env
PORT=8080
CLIENT_ORIGINS=http://localhost:3000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 📦 Dependencies

### Core

- Express 5.1.0 - Web framework
- Socket.IO 4.8.1 - WebSocket server
- TypeScript 5.9.2 - Type safety
- Supabase JS 2.55.0 - Database client

### Utilities

- Zod 4.0.17 - Schema validation
- Pino 9.9.0 - Logging
- CORS 2.8.5 - CORS middleware
- Express Rate Limit 8.1.0 - Rate limiting

## 🧪 Testing

Test infrastructure includes:

- **Vitest** - Test framework
- **Supertest** - HTTP assertion library
- **Real Supabase Integration** - Tests against actual database

Run tests:

```bash
npm test              # Run all tests
npm run test:ui       # Interactive test UI
```

## 🛡️ Security

- **CORS**: Allowlist in production
- **Rate Limiting**: Applied to auth and host-control routes
- **Input Validation**: Zod schemas on all routes
- **Authentication**: JWT verification via Supabase
- **Row Level Security**: Database-level access control

## 📡 API Error Contract

All error responses follow a consistent format:

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "requestId": "optional_request_id"
}
```

## 🚀 Deployment

The backend can be deployed to:

- **Render** - Configured via `render.yaml`
- **Any Node.js hosting** - Standard Express deployment
- **Docker** - Containerized deployment (if configured)

### Production Requirements

- Node.js >= 22
- Environment variables configured
- Supabase project set up
- Database migrations applied

## 📄 License

Licensed under the Apache-2.0 License. See [LICENSE](./LICENSE) for details.

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📚 Documentation

For comprehensive documentation:

- **User Manual**: See [frontend user-manual](https://github.com/PandaDev0069/tuiz-frontend/tree/main/user-manual)
- **API Documentation**: See [frontend API docs](https://github.com/PandaDev0069/tuiz-frontend/blob/main/user-manual/05-API-DOCUMENTATION.md)
- **Database Schema**: See [frontend database docs](https://github.com/PandaDev0069/tuiz-frontend/blob/main/user-manual/04-DATABASE-SCHEMA.md)
- **Technical Details**: See [frontend technical docs](https://github.com/PandaDev0069/tuiz-frontend/blob/main/user-manual/02-TECHNICAL-DOCUMENTATION.md)

## 📞 Support

- **Issues**: Report bugs or request features via [GitHub Issues](https://github.com/PandaDev0069/tuiz-backend/issues)
- **Documentation**: All user-facing documentation is in the [frontend repository](https://github.com/PandaDev0069/tuiz-frontend)
- **Code Documentation**: File headers and inline comments describe implementation details

---

**TUIZ情報王 Backend** - Powering real-time interactive quiz experiences 🎮📚
