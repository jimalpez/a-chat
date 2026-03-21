# ChatApp - Real-time Messaging

A modern real-time chat application built with the T3 Stack.

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **tRPC** - End-to-end type-safe API
- **Prisma** - Database ORM
- **PostgreSQL** - Database
- **Tailwind CSS v4** - Styling
- **NextAuth v5** - Authentication (Credentials provider)
- **Socket.io** - Real-time messaging & presence
- **Zustand** - Client state management

## Features

- User registration & login with secure password hashing (bcrypt)
- Real-time 1-on-1 messaging via WebSockets
- Online/offline presence indicators
- Typing indicators
- Message read status
- User search
- Dark mode toggle
- Responsive design (mobile-friendly)
- Unread message badges

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Supabase)
- npm

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your `DATABASE_URL`, `DIRECT_URL`, and `AUTH_SECRET`.

3. **Set up the database:**
   ```bash
   npx prisma db push
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) and create an account.

### Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with Socket.io |
| `npm run dev:next` | Start Next.js only (no sockets) |
| `npm run build` | Build for production |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Prisma Studio |

## Architecture

```
src/
├── app/                    # Next.js App Router pages
│   ├── login/              # Login page
│   ├── register/           # Registration page
│   └── page.tsx            # Main chat page (protected)
├── components/chat/        # Chat UI components
│   ├── Avatar.tsx          # User avatar with initials
│   ├── ChatLayout.tsx      # Main layout + socket lifecycle
│   ├── ChatWindow.tsx      # Message display + header
│   ├── MessageBubble.tsx   # Individual message bubble
│   ├── MessageInput.tsx    # Text input with typing indicator
│   └── Sidebar.tsx         # User list + search + settings
├── lib/
│   ├── socket.ts           # Socket.io client singleton
│   └── store.ts            # Zustand state management
├── server/
│   ├── api/routers/        # tRPC routers
│   │   ├── auth.ts         # Registration
│   │   ├── message.ts      # Message CRUD
│   │   └── user.ts         # User queries
│   ├── auth/               # NextAuth configuration
│   └── db.ts               # Prisma client
└── styles/globals.css      # Tailwind + custom styles

server.ts                   # Custom server with Socket.io
prisma/
└── schema.prisma           # Database schema
```
