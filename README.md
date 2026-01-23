# Jibot 3

A friendly Slack bot that learns about people and heralds them when they join channels.

## History & Lineage

Jibot has a long history dating back to 2004 as an IRC bot created by Joi Ito. It was designed to be a community memory - learning facts about people and sharing them when relevant.

**Lineage:**
- **Jibot 0.x (2004)** - Original IRC bot ([announcement](https://joi.ito.com/weblog/2004/04/23/jibot-06.html))
- **Jibot (Ruby)** - IRC version by [@imajes](https://github.com/imajes/jibot)
- **Jibot 3 (2026)** - Modern Slack bot (this project)

The core philosophy remains the same: help communities remember things about their members, making interactions more personal and welcoming.

## Features

### Learn About People
Teach jibot facts about anyone in your workspace:
```
jibot @alice is a tea ceremony teacher from Kyoto
jibot @bob is working on the new API
```

### Recall Facts
Ask jibot what it knows:
```
who is @alice?
→ "Alice is a tea ceremony teacher from Kyoto"
```

### Herald on Join
When someone joins a channel where jibot is present, it greets them with what it knows:
```
👋 Welcome Alice! (a tea ceremony teacher from Kyoto)
```

### Forget Facts
Manage stored information:
```
jibot forget @alice        # List all facts
jibot forget @alice 2      # Forget fact #2
jibot forget @alice all    # Forget everything
```

## Commands Reference

| Command | Description |
|---------|-------------|
| `jibot @user is [fact]` | Teach jibot about someone |
| `who is @user?` | Ask what jibot knows |
| `jibot forget @user` | List facts with numbers |
| `jibot forget @user [n]` | Forget specific fact |
| `jibot forget @user all` | Forget everything about someone |
| `jibot help` | Show help message |

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

### 3. Enable Events

**Event Subscriptions** → Subscribe to bot events:
- `member_joined_channel` - Herald when people join
- `message.channels` - Commands in channels
- `message.im` - Commands in DMs
- `app_mention` - @jibot mentions

### 4. Enable Socket Mode

**Socket Mode** → Enable and generate an App-Level Token with `connections:write` scope.

### 5. Install & Run

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

People facts are stored in `~/switchboard/jibot/people.json` - outside the repo to keep data private while code is public.

```json
{
  "U12345ABC": {
    "displayName": "Alice",
    "slackName": "alice",
    "facts": [
      {
        "fact": "a tea ceremony teacher from Kyoto",
        "addedBy": "U67890DEF",
        "addedAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

## Architecture

- **Runtime**: Node.js with TypeScript
- **Framework**: Slack Bolt
- **Connection**: Socket Mode (no public URL needed)
- **Storage**: Local JSON file (easily portable)

## Roadmap

### Near-term
- [ ] Web interface for viewing/editing facts
- [ ] Slack slash commands (`/jibot`)
- [ ] Import/export facts
- [ ] Fact categories or tags
- [ ] "On this day" - facts added on this date

### Personal Assistant Vision
The long-term vision for Jibot is to evolve into a personal assistant that interfaces between my personal systems and colleagues on Slack:

- [ ] **Task Integration**: Connect to my GTD system (Apple Reminders) — colleagues can ask Jibot what I'm working on or add items to my inbox
- [ ] **Calendar Awareness**: Know my schedule — answer "is Joi free Thursday?" or "when is Joi's next available slot?"
- [ ] **Knowledge Bridge**: Query my Obsidian vault and knowledge systems — surface relevant context during conversations
- [ ] **Contact Management**: Track relationships, conversation history, and context about people across systems
- [ ] **Delegation Interface**: Accept tasks via Slack that flow into my task management system
- [ ] **Proactive Updates**: Notify relevant people when tasks they're waiting on are completed

This would make Jibot the Slack-facing interface to my broader productivity and knowledge ecosystem.

## Philosophy

Jibot embodies the idea that communities are stronger when members know about each other. It's not about surveillance - it's about collective memory. Facts are added by community members, for community members.

> "jibot @joi is the mass and inertia in the group"  
> — from the original jibot

## License

MIT

## Author

[Joi Ito](https://joi.ito.com) - Original concept (2004) and Jibot 3 (2026)
