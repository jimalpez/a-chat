# A-Chat - Real-time Messaging

A modern, premium real-time chat application built with the T3 Stack. Features a polished UI with dark mode, Google OAuth, message replies, emoji reactions, file sharing, and more.

## Tech Stack

- **Next.js 15** (App Router, Turbopack)
- **TypeScript**
- **tRPC v11** - End-to-end type-safe API
- **Prisma** - Database ORM
- **PostgreSQL** (Supabase) - Database
- **Tailwind CSS v4** - Styling
- **Framer Motion** - Animations & micro-interactions
- **NextAuth v5** - Authentication (Credentials + Google OAuth)
- **Socket.io** - Real-time messaging & presence
- **Zustand** - Client state management
- **Supabase Storage** - File uploads

## Features

### Authentication
- Email/password registration & login with bcrypt hashing
- Google OAuth sign-in
- JWT session strategy

### Messaging
- Real-time 1-on-1 direct messages via WebSockets
- Group chat with member management
- Message replies (quote & reply)
- Emoji reactions (6 quick reactions per message)
- Edit & delete own messages
- File, image, and audio attachments
- Message read status (sent, delivered, read)
- Typing indicators
- Notification sound (toggleable)

### UI/UX
- Modern split-screen login/register with animated backgrounds
- Clean, minimal chat interface
- Light & dark mode (+ system preference)
- Consistent avatar colors per user (hash-based gradient assignment)
- Mobile-responsive with bottom navigation
- Instagram-style profile page with editable name, bio, and avatar
- Animated emoji reaction picker with staggered pop-in
- Skeleton loading states
- Smooth transitions with Framer Motion

### Profile
- Editable profile (name, bio, avatar photo)
- Stats display (contacts, groups, encryption)
- Notification settings (push notifications, sound toggle)
- Appearance settings (theme cycling)

### Real-time
- Online/offline presence indicators
- Typing indicators with animated dots
- Unread message badges
- Push notifications (Web Push API with VAPID)

### Security
- End-to-end encryption support (E2EE key management)
- Socket message sender validation (anti-spoofing)
- Rate limiting on all API procedures
- Explicit null checks on message/reaction authorization

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

   Required variables:
   | Variable | Description |
   |----------|-------------|
   | `DATABASE_URL` | PostgreSQL connection string (with pooling) |
   | `DIRECT_URL` | Direct PostgreSQL connection (for migrations) |
   | `AUTH_SECRET` | NextAuth JWT secret |
   | `AUTH_GOOGLE_ID` | Google OAuth Client ID |
   | `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
   | `NEXT_PUBLIC_SOCKET_URL` | Socket.io server URL (optional) |

3. **Set up the database:**
   ```bash
   npx prisma db push
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) and create an account.

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (Web application)
3. Add authorized JavaScript origins:
   - `http://localhost:3000` (dev)
   - `https://yourdomain.com` (production)
4. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://yourdomain.com/api/auth/callback/google` (production)
5. Copy Client ID and Client Secret to your `.env` file

### Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with Socket.io |
| `npm run dev:next` | Start Next.js only (no sockets) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Prisma Studio |
| `npm test` | Run tests |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint |

## Architecture

```
src/
├── app/                        # Next.js App Router pages
│   ├── login/                  # Login page (split-screen, Google OAuth)
│   ├── register/               # Registration page
│   └── page.tsx                # Main chat page (protected)
├── components/chat/            # Chat UI components
│   ├── Avatar.tsx              # User avatar with stable color gradients
│   ├── BottomNav.tsx           # Mobile bottom navigation
│   ├── ChatLayout.tsx          # Main layout + socket lifecycle
│   ├── ChatWindow.tsx          # Message display + header
│   ├── CreateGroupDialog.tsx   # Group creation modal
│   ├── MessageBubble.tsx       # Message bubble with replies & reactions
│   ├── MessageInput.tsx        # Text input with reply bar & file upload
│   ├── ProfilePage.tsx         # Instagram-style profile with edit sheet
│   └── Sidebar.tsx             # Conversation list + search + tabs
├── hooks/
│   └── useTheme.ts             # Theme management (light/dark/system)
├── lib/
│   ├── crypto.ts               # E2EE encryption utilities
│   ├── notification-sound.ts   # Audio notification (toggleable)
│   ├── push.ts                 # Push notification client
│   ├── socket.ts               # Socket.io client singleton
│   └── store.ts                # Zustand state management
├── server/
│   ├── api/routers/            # tRPC routers
│   │   ├── auth.ts             # Registration
│   │   ├── group.ts            # Group CRUD & messages
│   │   ├── message.ts          # Message CRUD, reactions, replies
│   │   ├── notification.ts     # Push notification subscriptions
│   │   └── user.ts             # User queries & profile updates
│   ├── auth/                   # NextAuth configuration
│   ├── db.ts                   # Prisma client
│   ├── push.ts                 # Web Push server
│   └── rate-limit.ts           # Rate limiting utilities
└── styles/globals.css          # Tailwind + custom animations

socket-server.ts                # Standalone Socket.io server
prisma/
└── schema.prisma               # Database schema (17 models)
```

## Database Models

- **User** - Profile with optional password (OAuth), bio, avatar
- **Message** - DM messages with replies, reactions, file attachments, E2EE
- **Group / GroupMember / GroupMessage** - Group chat system
- **Reaction / GroupMessageReaction** - Emoji reactions
- **MutedConversation** - Mute DMs or groups
- **PushSubscription** - Web Push notification endpoints
- **UserKeyPair** - E2EE public key storage
- **Account / Session / VerificationToken** - NextAuth
