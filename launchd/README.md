# Jibot Launchd Setup

This directory contains launchd configuration for running Jibot as a persistent service.

## Jobs

| Job | Description |
|-----|-------------|
| `com.amplifier.jibot-primary` | Jibot for primary Slack workspace |
| `com.amplifier.jibot-workspace2` | Jibot for secondary Slack workspace |

## Installation

```bash
# Install and start both jibot instances
./launchd/install.sh

# Or install individually
./launchd/install.sh primary
./launchd/install.sh workspace2
```

## Management

```bash
# View status
launchctl list | grep jibot

# View logs
tail -f ~/jibot-3/jibot.log
tail -f ~/jibot-3/jibot2.log

# Stop a job
launchctl bootout gui/$(id -u)/com.amplifier.jibot-primary

# Start a job
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.amplifier.jibot-primary.plist

# Uninstall
./launchd/uninstall.sh
```

## Logs

- Primary: `~/jibot-3/jibot.log`
- Workspace2: `~/jibot-3/jibot2.log`
- Amplifier logs: `~/.amplifier/launchd/logs/com.amplifier.jibot-*.log`

## Environment

Each instance uses its own environment file:
- Primary: `.env` (symlinked from dotfiles-private)
- Workspace2: `.env.workspace2` (symlinked from dotfiles-private)
