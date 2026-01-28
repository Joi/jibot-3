# Jibot 3

A friendly Slack bot that learns about people, heralds them when they join channels, and bridges communities across platforms.

## History & Lineage

Jibot has a long history dating back to 2004 as an IRC bot created by Joi Ito. It was designed to be a community memory - learning facts about people and sharing them when relevant.

**Lineage:**
- **Jibot 0.x (2004)** - Original IRC bot ([announcement](https://joi.ito.com/weblog/2004/04/23/jibot-06.html))
- **Jibot (Ruby)** - IRC version by [@imajes](https://github.com/imajes/jibot)
- **Jibot 3 (2026)** - Modern Slack bot with MUD integration (this project)

The core philosophy remains the same: help communities remember things about their members, making interactions more personal and welcoming.

## Features

### Community Memory

Teach jibot facts about anyone in your workspace:
```
jibot @alice is a tea ceremony teacher from Kyoto
jibot @bob is working on the new API
```

Ask jibot what it knows:
```
who is @alice?
→ "Alice is a tea ceremony teacher from Kyoto"
```

Manage stored information:
```
jibot forget @alice        # List all facts
jibot forget @alice 2      # Forget fact #2
jibot forget @alice all    # Forget everything
```

### Herald on Join

When someone joins a channel where jibot is present, it greets them with what it knows:
```
👋 Welcome Alice! (a tea ceremony teacher from Kyoto)
```

### Reminder Inbox

Send reminders to Joi's Apple Reminders:
```
remind joi to review the grant proposal
→ Added to Joi's "Jibot" reminders list
```

### Knowledge Lookup

Look up concepts and organizations from the knowledge base:
```
explain DAOs
→ 💡 DAOs: Decentralized Autonomous Organizations are...

what is Digital Garage
→ 🏢 Digital Garage: A Tokyo-based technology company...
```

### Health Status (Whoop)

Check Joi's Whoop recovery data:
```
how's Joi doing today?
→ 📊 Joi's Whoop Status: 🟢 Recovery 85%, HRV 45ms...
```

### Calendar Integration

Admins can add events to Joi's calendar:
```
@jibot add meeting with Alice tomorrow at 2pm to calendar
→ ✅ Created: meeting with Alice (Jan 29, 2pm)
```

### MUD Integration (Daemon)

Jibot exists as an NPC in the [Daemon MUD](https://github.com/Joi/daemon), allowing players on the Grid to interact with the same bot that runs in Slack.

```
> ask jibot about joi
Jibot says, "*scrolls through memories* Joi is the Chief Architect of this place..."

> tell jibot explain web3
Jibot says, "*projects holographic text* Web3: The next evolution of the internet..."
```

### Owner Capabilities

The owner can post messages as Jibot to any channel:
```
/jibot post #general Hello everyone!
/jibot post @alice Hey, check this out!
```

## Commands Reference

### Message Commands (in channels)

| Command | Description |
|---------|-------------|
| `jibot @user is [fact]` | Teach jibot about someone |
| `who is @user?` | Ask what jibot knows |
| `jibot forget @user` | List facts with numbers |
| `jibot forget @user [n]` | Forget specific fact |
| `jibot forget @user all` | Forget everything about someone |
| `remind joi to [thing]` | Add to reminder inbox |
| `explain [concept]` | Look up a concept |
| `what is [org]` | Look up an organization |
| `how's Joi doing?` | Whoop health status |
| `add [event] to calendar` | Add calendar event (admin+) |

### Slash Commands

| Command | Description | Access |
|---------|-------------|--------|
| `/jibot help` | Show help | Everyone |
| `/jibot docs [topic]` | Documentation | Everyone |
| `/jibot status` | Whoop health status | Everyone |
| `/jibot explain [concept]` | Quick concept lookup | Everyone |
| `/jibot whatis [org]` | Quick org lookup | Everyone |
| `/jibot remind [message]` | Quick reminder | Everyone |
| `/jibot inbox` | View reminder queue | Admin+ |
| `/jibot inbox clear [n\|all]` | Clear reminders | Owner |
| `/jibot admin @user` | Promote to admin | Owner |
| `/jibot demote @user` | Demote admin | Owner |
| `/jibot admins` | List admins | Admin+ |
| `/jibot post #channel msg` | Post as Jibot | Owner |

### Thread-to-Todo

Mention `@jibot` in a thread (with no message) to save the parent message as a reminder with a link back.

## Setup

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Name it "Jibot" and select your workspace

### 2. Configure Permissions

**OAuth & Permissions** → Bot Token Scopes:
- `channels:history` - Read messages in public channels
- `channels:read` - View channel info
- `chat:write` - Send messages
- `users:read` - Get user display names
- `im:history` - Read DM messages (for DM commands)
- `im:read` - View DM info
- `commands` - Slash commands

### 3. Enable Events

**Event Subscriptions** → Subscribe to bot events:
- `member_joined_channel` - Herald when people join
- `message.channels` - Commands in channels
- `message.im` - Commands in DMs
- `app_mention` - @jibot mentions

### 4. Enable Socket Mode

**Socket Mode** → Enable and generate an App-Level Token with `connections:write` scope.

### 5. Create Slash Command

**Slash Commands** → Create new command:
- Command: `/jibot`
- Description: "Jibot commands"
- Usage hint: `[help|status|explain|remind|...]`

### 6. Install & Run

```bash
git clone https://github.com/Joi/jibot-3.git
cd jibot-3
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Slack tokens

# Run
npm run dev      # Development with auto-reload
npm run build && npm start  # Production
```

## Data Storage

Data is stored in `~/switchboard/jibot/` - outside the repo to keep private data separate from public code.

| File | Purpose |
|------|---------|
| `people.json` | Facts about people |
| `inbox.json` | Reminder queue |
| `auth.json` | Owner and admins |

## Architecture

- **Runtime**: Node.js with TypeScript
- **Framework**: Slack Bolt (Socket Mode)
- **HTTP API**: Express (for MUD integration)
- **Storage**: Local JSON files

### Ports

| Port | Service |
|------|---------|
| 3000 | Slack Socket Mode |
| 3001 | MUD API + Slack API |

See [docs/DESIGN.md](docs/DESIGN.md) for full architecture details.

## Documentation

| Document | Description |
|----------|-------------|
| [DESIGN.md](docs/DESIGN.md) | Architecture and technical design |
| [ROADMAP.md](docs/ROADMAP.md) | Feature roadmap and issue tracking |
| [DAEMON-INTEGRATION.md](docs/DAEMON-INTEGRATION.md) | MUD bridge design |

## Roadmap

### Current Focus: MUD Bridge
- [x] MUD API endpoint
- [x] JibotNPC typeclass in Daemon
- [ ] Basic query/response flow
- [ ] Slack ↔ MUD relay
- [ ] Cross-platform identity linking

### Future: Personal Assistant
- [ ] GTD task integration
- [ ] Calendar awareness ("Is Joi free Thursday?")
- [ ] Knowledge bridge to Obsidian vault
- [ ] Contact management
- [ ] Delegation interface
- [ ] Proactive updates

See [docs/ROADMAP.md](docs/ROADMAP.md) for full roadmap with issue tracking.

## Issue Tracking

Issues are tracked using [beads](https://github.com/Dicklesworthstone/beads_viewer) in `.beads/`.

```bash
bd ready              # See what's ready to work on
bd list --status=open # All open issues
bd show <id>          # Issue details
```

## Philosophy

Jibot embodies the idea that communities are stronger when members know about each other. It's not about surveillance - it's about collective memory. Facts are added by community members, for community members.

> "jibot @joi is the mass and inertia in the group"  
> — from the original jibot

## License

MIT

## Author

[Joi Ito](https://joi.ito.com) - Original concept (2004) and Jibot 3 (2026)
