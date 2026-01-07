# Jibot 3

A friendly Slack bot that learns about people and heralds them when they join channels.

## Lineage

Jibot 3 is a descendant of:
- [jibot (2004)](https://github.com/imajes/jibot) - The original IRC bot
- [jibot 0.6 announcement](https://joi.ito.com/weblog/2004/04/23/jibot-06.html)

## Features

- **Learn about people**: `jibot @alice is a tea ceremony teacher`
- **Recall facts**: `who is @alice?` → "Alice is a tea ceremony teacher"
- **Herald on join**: When someone joins a channel, jibot greets them with what it knows
- **Forget facts**: `jibot forget @alice` to manage stored information

## Commands

| Command | Description |
|---------|-------------|
| `jibot @user is [fact]` | Teach jibot about someone |
| `who is @user?` | Ask what jibot knows |
| `jibot forget @user` | List facts to choose from |
| `jibot forget @user [n]` | Forget specific fact |
| `jibot forget @user all` | Forget everything about someone |
| `jibot help` | Show help message |

## Setup

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name it "Jibot" and select your workspace

### 2. Configure the App

**OAuth & Permissions** - Add these Bot Token Scopes:
- `channels:history` - Read messages in public channels
- `channels:read` - View basic channel info
- `chat:write` - Send messages
- `users:read` - View user info

**Event Subscriptions** - Enable and subscribe to:
- `member_joined_channel` - For heralding
- `message.channels` - For commands in channels
- `app_mention` - For @mentions

**Socket Mode** - Enable Socket Mode and create an App-Level Token with `connections:write` scope

### 3. Install & Run

```bash
# Clone the repo
git clone https://github.com/Joi/jibot-3.git
cd jibot-3

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your Slack tokens

# Run in development
npm run dev

# Or build and run in production
npm run build
npm start
```

## Data Storage

People facts are stored in `~/switchboard/jibot/people.json` (outside the repo for privacy).

The data structure:
```json
{
  "U12345ABC": {
    "displayName": "Alice",
    "slackName": "alice",
    "facts": [
      {
        "fact": "a tea ceremony teacher",
        "addedBy": "U67890DEF",
        "addedAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

## Future Ideas

- Web interface for viewing/editing facts
- Slack slash commands
- More sophisticated NLP for learning
- Integration with other services
- Customizable herald messages per channel

## License

MIT
