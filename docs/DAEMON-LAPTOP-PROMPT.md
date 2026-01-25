# Daemon Laptop Development Prompt - Jibot Integration

> **Use this as context when working on ~/daemon on the laptop**

---

## Situation

You're implementing the Daemon side of the Jibot MUD integration. The Jibot-3 service is running on **macazbd (172.16.0.118:3001)** and is ready to receive requests.

**Already done on macazbd:**
- Jibot-3 MUD API running at `http://172.16.0.118:3001/api/mud`
- Endpoints tested and working:
  - `POST /api/mud/event` - handles speech, arrival, departure, action events
  - `GET /api/mud/health` - health check
  - `GET /api/mud/query` - direct concept/org lookups

**Already exists in ~/daemon:**
- `server/daemon_server/typeclasses/joiito_npcs.py` - JibotNPC typeclass with async service calls
- But it's hardcoded to `localhost:3001` - needs env var support

---

## Tasks to Implement

### 1. Add Environment Variable Support to JibotNPC

**File:** `server/daemon_server/typeclasses/joiito_npcs.py`

**Current code (line ~169):**
```python
JIBOT_SERVICE_URL = "http://localhost:3001/api/mud"
```

**Change to:**
```python
import os

# In the class:
JIBOT_SERVICE_URL = os.environ.get(
    "JIBOT_SERVICE_URL", 
    "http://localhost:3001/api/mud"
)
```

### 2. Create Jibot Commands

**File to create:** `server/daemon_server/commands/jibot.py`

```python
"""
Jibot interaction commands.

Commands for talking to Jibot, the Archive of #joiito.
Jibot is a bridge NPC connecting the MUD to the external Jibot-3 service.
"""

import asyncio
from evennia import Command, CmdSet
from evennia.utils.search import search_object


class CmdAskJibot(Command):
    """
    Ask Jibot a question.

    Usage:
        ask jibot <question>
        ask jibot who is <name>
        ask jibot what is <thing>

    Examples:
        ask jibot who is joi
        ask jibot what is MIT Media Lab
        ask jibot explain blockchain
        ask jibot help
    """

    key = "ask"
    locks = "cmd:all()"
    help_category = "Communication"

    def func(self):
        caller = self.caller

        if not self.args:
            caller.msg("Usage: ask jibot <question>")
            return

        # Parse "jibot <message>" or just treat whole args as target + message
        args = self.args.strip()
        
        # Check if asking jibot specifically
        if not args.lower().startswith("jibot"):
            # Could be asking another NPC - fall through or handle
            caller.msg("Usage: ask jibot <question>")
            return
        
        # Extract the question (everything after "jibot")
        question = args[5:].strip()  # Remove "jibot" prefix
        if not question:
            caller.msg("What would you like to ask Jibot?")
            return

        # Find Jibot in the current room or globally
        jibot = None
        
        # First check current room
        for obj in caller.location.contents:
            if obj.key.lower() == "jibot" or getattr(obj.db, "is_bridge_npc", False):
                jibot = obj
                break
        
        # If not in room, search globally (Jibot might be elsewhere)
        if not jibot:
            results = search_object("Jibot")
            if results:
                jibot = results[0]
        
        if not jibot:
            caller.msg("|xJibot is not available right now.|n")
            return

        # Check if JibotNPC has the respond method
        if not hasattr(jibot, "respond_to_speech"):
            caller.msg("|xThis NPC cannot answer questions.|n")
            return

        # Call the async method
        # Evennia supports running async code via utils.run_async
        from evennia.utils import run_async

        def handle_response(response):
            if response:
                # Jibot speaks to the room
                if jibot.location:
                    jibot.location.msg_contents(
                        f'|cJibot|n says, "{response}"',
                        exclude=[]
                    )
            else:
                caller.msg("|x*Jibot's text flickers but says nothing*|n")

        # Announce the question
        caller.location.msg_contents(
            f'{caller.key} asks Jibot, "{question}"',
            exclude=[caller]
        )
        caller.msg(f'You ask Jibot, "{question}"')

        # Get response asynchronously
        run_async(
            jibot.respond_to_speech(caller, question),
            callback=handle_response
        )


class CmdTellJibot(Command):
    """
    Tell Jibot something (teach a fact or give a command).

    Usage:
        tell jibot <name> is <fact>
        tell jibot broadcast <message>
        tell jibot forget <name>

    Examples:
        tell jibot joi is the founder of Creative Commons
        tell jibot broadcast Hello from the Grid!
    """

    key = "tell"
    locks = "cmd:all()"
    help_category = "Communication"

    def func(self):
        caller = self.caller

        if not self.args:
            caller.msg("Usage: tell jibot <statement>")
            return

        args = self.args.strip()
        
        if not args.lower().startswith("jibot"):
            caller.msg("Usage: tell jibot <statement>")
            return
        
        statement = args[5:].strip()
        if not statement:
            caller.msg("What would you like to tell Jibot?")
            return

        # Find Jibot
        jibot = None
        for obj in caller.location.contents:
            if obj.key.lower() == "jibot" or getattr(obj.db, "is_bridge_npc", False):
                jibot = obj
                break
        
        if not jibot:
            results = search_object("Jibot")
            if results:
                jibot = results[0]
        
        if not jibot:
            caller.msg("|xJibot is not available right now.|n")
            return

        if not hasattr(jibot, "respond_to_speech"):
            caller.msg("|xThis NPC cannot process statements.|n")
            return

        from evennia.utils import run_async

        def handle_response(response):
            if response:
                if jibot.location:
                    jibot.location.msg_contents(
                        f'|cJibot|n says, "{response}"',
                        exclude=[]
                    )

        caller.location.msg_contents(
            f'{caller.key} tells Jibot, "{statement}"',
            exclude=[caller]
        )
        caller.msg(f'You tell Jibot, "{statement}"')

        run_async(
            jibot.respond_to_speech(caller, statement),
            callback=handle_response
        )


class JibotCmdSet(CmdSet):
    """
    Commands for interacting with Jibot.
    """

    key = "JibotCmdSet"

    def at_cmdset_creation(self):
        self.add(CmdAskJibot())
        self.add(CmdTellJibot())
```

### 3. Register the Command Set

**File:** `server/daemon_server/typeclasses/characters.py` (or wherever Operative is defined)

Add to the character's default cmdset:
```python
from ..commands.jibot import JibotCmdSet

# In the Operative class at_object_creation or cmdset setup:
self.cmdset.add(JibotCmdSet, persistent=True)
```

Or add to the default character cmdset in `commands/__init__.py`.

### 4. Wire Up Room Hooks (Optional Enhancement)

To make Jibot respond when players just "say" something with "jibot" in it:

**File:** `server/daemon_server/typeclasses/joiito_npcs.py`

The `at_say` hook already exists but is commented as needing command system. The commands above handle this.

---

## Testing

### 1. Set the Environment Variable

Before starting the daemon dev server:
```bash
export JIBOT_SERVICE_URL="http://172.16.0.118:3001/api/mud"
```

Or add to your `.env` file if using python-dotenv.

### 2. Verify Connectivity

From your laptop, test that you can reach macazbd:
```bash
curl -X POST http://172.16.0.118:3001/api/mud/event \
  -H "Content-Type: application/json" \
  -d '{"type":"speech","speaker":{"name":"Test"},"message":"help","context":"mud"}'
```

You should get a JSON response with Jibot's help text.

### 3. Start Daemon Dev Server

```bash
cd ~/daemon
evennia start  # or however you run the dev server
```

### 4. Connect and Test

Connect to the MUD and try:
```
ask jibot help
ask jibot who is joi
tell jibot test user is a developer
```

---

## API Reference

### POST /api/mud/event

**Request:**
```json
{
  "type": "speech|arrival|departure|action",
  "speaker": {
    "name": "PlayerName",
    "github": "optional-github-username",
    "level": 5,
    "role": "user|developer|admin|chief_architect"
  },
  "message": "the message or action text",
  "location": "Room Name",
  "context": "mud"
}
```

**Response:**
```json
{
  "type": "say|emote|silent",
  "message": "Jibot's response text",
  "relay_to_slack": false
}
```

### Event Types

| Type | When | Speaker Fields |
|------|------|----------------|
| `speech` | Player talks to Jibot | name, message required |
| `arrival` | Player enters Jibot's room | name, github, level optional |
| `departure` | Player leaves | name required |
| `action` | Player emotes near Jibot | name, message (the action) |

### Speech Commands Jibot Understands

| Pattern | Example | What it does |
|---------|---------|--------------|
| `who is [name]` | "who is joi" | Look up facts about someone |
| `[name] is [fact]` | "alice is a designer" | Learn a new fact |
| `explain [concept]` | "explain blockchain" | Look up concept definition |
| `what is [thing]` | "what is MIT" | Look up org or concept |
| `broadcast [msg]` | "broadcast hello world" | Relay to Slack (returns flag) |
| `help` | "help" | Show available commands |

---

## Files Changed Summary

| File | Change |
|------|--------|
| `typeclasses/joiito_npcs.py` | Add `os.environ.get()` for JIBOT_SERVICE_URL |
| `commands/jibot.py` | **New file** - CmdAskJibot, CmdTellJibot |
| `commands/__init__.py` or `typeclasses/characters.py` | Register JibotCmdSet |

---

## Beads Issue

This work closes: `daemon-4zk.3` (Create Jibot Spirit NPC)

Related: `jibot-3-li1` (Basic MUD query/response flow)

When done, sync beads:
```bash
cd ~/daemon
bd close daemon-4zk.3 --reason "Implemented ask/tell jibot commands, wired to jibot-3 service at macazbd"
```

---

## Network Diagram

```
┌─────────────────────────────┐         ┌─────────────────────────────┐
│  YOUR LAPTOP                │         │  macazbd                    │
│                             │         │                             │
│  ~/daemon (Evennia)         │  HTTP   │  ~/jibot-3 (Node.js)        │
│  ┌─────────────────────┐    │ ──────► │  ┌─────────────────────┐    │
│  │ JibotNPC            │    │         │  │ MUD API             │    │
│  │ - ask jibot         │────┼─────────┼──│ /api/mud/event      │    │
│  │ - tell jibot        │    │         │  │                     │    │
│  │ - respond_to_speech │    │         │  │ handleSpeech()      │    │
│  └─────────────────────┘    │         │  │ handleArrival()     │    │
│                             │         │  └─────────────────────┘    │
│  JIBOT_SERVICE_URL=         │         │                             │
│  http://172.16.0.118:3001   │         │  Listening on :3001         │
│                             │         │                             │
└─────────────────────────────┘         └─────────────────────────────┘
```

---

*Generated by Amplifier on macazbd for laptop daemon development*
