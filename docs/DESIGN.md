# Jibot 3 Architecture & Design

> Technical design document for Jibot 3 - a multi-platform community memory and personal assistant bot.

---

## Overview

Jibot 3 is a Node.js/TypeScript service that:
1. Connects to Slack via Socket Mode (primary interface)
2. Exposes HTTP APIs for external integrations (MUD, webhooks)
3. Bridges personal productivity systems (Calendar, Reminders, Knowledge base)
4. Maintains persistent storage for community facts and identity

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           INTERFACES                                     │
├─────────────────┬─────────────────┬─────────────────┬──────────────────┤
│  Slack Socket   │   MUD API       │   Slack API     │   (Future)       │
│  Mode (Bolt)    │   :3001/mud     │   :3001/slack   │   Web Admin      │
│                 │                 │                 │                  │
│  • Messages     │  • Event POST   │  • POST /post   │  • Facts CRUD    │
│  • Mentions     │  • Query GET    │  • GET /user    │  • Dashboard     │
│  • Slash cmds   │  • Health       │  • GET /channels│                  │
│  • Events       │                 │                 │                  │
└────────┬────────┴────────┬────────┴────────┬────────┴──────────────────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Jibot-3   │
                    │   Core      │
                    │  (index.ts) │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌─────▼─────┐     ┌─────▼─────┐
    │ Command │      │   Data    │     │ External  │
    │ Parsing │      │  Stores   │     │ Services  │
    │         │      │           │     │           │
    │ parse.ts│      │ people.ts │     │calendar.ts│
    │llm-parse│      │ inbox.ts  │     │ whoop.ts  │
    │         │      │ auth.ts   │     │switchboard│
    └─────────┘      └─────┬─────┘     └─────┬─────┘
                           │                 │
                    ┌──────▼──────┐   ┌──────▼──────┐
                    │  Local JSON │   │  External   │
                    │  (~/switch- │   │   APIs      │
                    │   board/)   │   │             │
                    └─────────────┘   └─────────────┘
```

---

## Module Structure

### Core Application (`src/index.ts`)

The main entry point (~1300 lines) that:
- Initializes Slack Bolt app with custom Socket Mode receiver
- Registers all message handlers, event listeners, slash commands
- Starts the Express server for MUD/Slack APIs
- Coordinates between all modules

**Key customization:** Custom `SocketModeReceiver` with extended ping timeouts (30s client, 60s server) to prevent disconnection issues.

### Command Parsing

| Module | Purpose |
|--------|---------|
| `parse.ts` | Regex-based command parsing for known patterns |
| `llm-parse.ts` | LLM-assisted parsing for ambiguous natural language |

The parser cascade:
1. Try exact regex matches (fast, deterministic)
2. Fall back to LLM parsing for fuzzy matches (slower, flexible)

### Data Stores

| Module | Storage | Purpose |
|--------|---------|---------|
| `people.ts` | `~/switchboard/jibot/people.json` | Facts about people, keyed by Slack UID |
| `inbox.ts` | `~/switchboard/jibot/inbox.json` | Reminder queue before routing to Apple Reminders |
| `auth.ts` | `~/switchboard/jibot/auth.json` | Owner, admins, linked identities |
| `permissions.ts` | (uses auth.ts) | Permission checking logic |

**Design decision:** Data stored in `~/switchboard/` to keep private data separate from the public code repository.

### External Integrations

| Module | Service | Auth Method |
|--------|---------|-------------|
| `calendar.ts` | Google Calendar | OAuth2 (stored tokens) |
| `whoop.ts` | Whoop API | API token |
| `switchboard.ts` | Obsidian vault | Local file access |
| `docs.ts` | Static documentation | Bundled content |

### Platform Bridges

| Module | Platform | Protocol |
|--------|----------|----------|
| `mud.ts` | Daemon MUD | HTTP REST API |
| `mentions.ts` | Slack @mentions | (internal helper) |

---

## Data Models

### Person (Facts Storage)

```typescript
interface Person {
  displayName?: string;      // Human-readable name
  slackName?: string;        // Slack @handle
  facts: Fact[];
}

interface Fact {
  fact: string;              // The fact content
  addedBy: string;           // Slack UID who added it
  addedAt: string;           // ISO timestamp
}

// Storage: Map<slackUserId, Map<teamId, Person>>
// Keyed by Slack UID, then by workspace
```

### Auth Model

```typescript
interface AuthData {
  owner: {
    ownerId: string;         // Primary Slack UID
    linkedIds: string[];     // Alternative UIDs (cross-workspace)
  } | null;
  admins: Admin[];
}

interface Admin {
  canonicalId: string;       // Primary Slack UID
  displayName?: string;
  linkedIds: string[];       // Cross-workspace UIDs
}
```

### MUD Event Protocol

```typescript
interface MudEvent {
  type: 'speech' | 'action' | 'arrival' | 'departure';
  speaker: {
    name: string;            // MUD character name
    github?: string;         // GitHub username if linked
    level?: number;
    role?: 'user' | 'developer' | 'admin' | 'chief_architect';
  };
  message?: string;
  location?: string;
  context: 'mud';            // Always 'mud'
}

interface MudResponse {
  type: 'say' | 'emote' | 'silent';
  message?: string;
  relay_to_slack?: boolean;
}
```

---

## Permission System

Three-tier permission model:

| Tier | Capabilities |
|------|--------------|
| **Owner** | Full control: clear inbox, promote/demote admins, link identities, post as Jibot |
| **Admin** | View inbox, add calendar events, view admin list |
| **Guest** | Learn/recall facts, send reminders, use lookups |

**Cross-workspace identity:** Owner and admins can link multiple Slack UIDs (from different workspaces) to the same identity. Permissions carry across.

---

## API Endpoints

### MUD API (`:3001/api/mud`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/event` | POST | Receive MUD events (speech, arrival, etc.) |
| `/query` | GET | Direct concept/org lookup |

### Slack API (`:3001/api/slack`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/post` | POST | Post message to channel (external trigger) |
| `/user` | GET | Look up user by name |
| `/channels` | GET | List channels bot is in |

---

## Command Reference

### Message Patterns (in channels)

```
jibot @user is [fact]      → Learn a fact
who is @user?              → Recall facts
jibot forget @user         → List facts (with numbers)
jibot forget @user [n]     → Forget fact #n
jibot forget @user all     → Forget all facts
remind joi to [thing]      → Add to reminder inbox
explain [concept]          → Look up concept
what is [org]              → Look up organization
how's Joi doing?           → Whoop health status
add [event] to calendar    → Add calendar event (admin+)
```

### Slash Commands (`/jibot`)

```
/jibot help                → Show help
/jibot docs [topic]        → Documentation
/jibot inbox               → View reminder inbox (admin+)
/jibot inbox clear [n|all] → Clear inbox (owner)
/jibot admin @user         → Promote to admin (owner)
/jibot demote @user        → Demote admin (owner)
/jibot link @user UID      → Link cross-workspace ID (owner)
/jibot admins              → List admins (admin+)
/jibot status              → Whoop health status
/jibot explain [concept]   → Quick concept lookup
/jibot whatis [org]        → Quick org lookup
/jibot remind [message]    → Quick reminder
/jibot post #channel msg   → Post to channel (owner)
```

### Thread-to-Todo

Mentioning `@jibot` in a thread (with no message) saves the parent message as a reminder with a link back to the Slack message.

---

## External Service Integration

### Google Calendar

- **Auth:** OAuth2 with stored refresh token
- **Location:** Tokens in `~/.obs-dailynotes/` (shared with other tools)
- **Capabilities:** Create events, quick add with natural language

### Apple Reminders

- **Bridge:** `scripts/amplifier_bridge.py` calls Amplifier's Apple Reminders skill
- **List:** Items go to the "Jibot" list
- **Format:** Title + notes with context (who sent, from where)

### Whoop

- **Auth:** API token via Supabase intermediary
- **Data:** Recovery score, HRV, sleep performance
- **Display:** Emoji-coded status (green/yellow/red)

### Obsidian Vault

- **Location:** `~/switchboard/`
- **Content:** Concept definitions, organization profiles
- **Format:** Markdown files with frontmatter

---

## Deployment

### Requirements

- Node.js 18+
- Slack app with Socket Mode enabled
- Environment variables (see `.env.example`)

### Running

```bash
npm run dev      # Development with hot reload (tsx watch)
npm run build    # Compile TypeScript
npm start        # Production (compiled)
```

### Process Management

Recommended: Use `pm2` or `launchd` for production:

```bash
pm2 start dist/index.js --name jibot
```

### Ports

| Port | Service |
|------|---------|
| 3000 | Slack Socket Mode (internal) |
| 3001 | MUD API + Slack API (HTTP) |

**Note:** MUD API binds to `0.0.0.0` to accept connections from ZeroTier network.

---

## Security Considerations

### Data Privacy

- Facts are stored locally, not in cloud
- Data directory (`~/switchboard/jibot/`) outside repo
- No fact content logged

### API Security

- MUD API currently unauthenticated (internal network only)
- Slack API posting requires valid channel membership
- Rate limiting on broadcast commands (future)

### Permissions

- Owner-only operations require explicit claim (`jibot setowner`)
- Cross-workspace identity requires owner linking
- Calendar access restricted to admins

---

## Future Architecture (Personal Assistant)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Jibot-3 Core                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Slack     │  │    MUD      │  │    Web      │             │
│  │  Interface  │  │  Interface  │  │   Admin     │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                     │
│                  ┌─────────────────┐                           │
│                  │  Command Router │                           │
│                  └────────┬────────┘                           │
│                           │                                     │
│  ┌────────────────────────┼────────────────────────┐           │
│  │                        │                        │           │
│  ▼                        ▼                        ▼           │
│ ┌──────────┐      ┌──────────────┐      ┌──────────────┐      │
│ │Community │      │   Personal   │      │  Knowledge   │      │
│ │ Memory   │      │  Assistant   │      │   Bridge     │      │
│ │          │      │              │      │              │      │
│ │• Facts   │      │• GTD Tasks   │      │• Obsidian    │      │
│ │• Herald  │      │• Calendar    │      │• Concepts    │      │
│ │• Forget  │      │• Delegation  │      │• Contacts    │      │
│ └──────────┘      └──────────────┘      └──────────────┘      │
│                           │                                     │
│                  ┌────────▼────────┐                           │
│                  │ Identity Layer  │                           │
│                  │ (Slack ↔ MUD)   │                           │
│                  └─────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

**Key additions for PA vision:**
1. **GTD Integration:** Bidirectional sync with Apple Reminders
2. **Calendar Awareness:** Query availability, suggest times
3. **Contact Management:** Rich profiles beyond simple facts
4. **Delegation Interface:** Accept tasks from colleagues
5. **Proactive Updates:** Notify stakeholders on task completion
6. **Knowledge Bridge:** Surface relevant Obsidian notes in context

---

## References

- [README.md](../README.md) - User-facing documentation
- [ROADMAP.md](./ROADMAP.md) - Feature roadmap and issue tracking
- [DAEMON-INTEGRATION.md](./DAEMON-INTEGRATION.md) - MUD bridge design
- [Slack Bolt Documentation](https://slack.dev/bolt-js/)
- [Evennia Documentation](https://www.evennia.com/)

---

*Last updated: 2026-01-28*
