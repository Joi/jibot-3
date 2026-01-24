# Jibot-3 Daemon Integration Design

> "A ghost in the Grid, Jibot knows things. Ask nicely."
> 「グリッドの亡霊、Jibotは知っている。丁寧に聞けば。」

---

## Vision

Jibot becomes a presence in the Daemon MUD - an NPC that bridges the Slack workspace (#joiito) with the virtual world. When you talk to Jibot in Slack, you're talking to an entity that also exists on the Grid. When you meet Jibot in the MUD, you're meeting something that knows what's happening in the outside world.

**The Grid bleeds into reality. Jibot is one of the wounds.**

---

## Design Philosophy

### Why This Integration?

1. **Narrative Unity**: #joiito predates the MUD. Jibot is its familiar spirit. Making Jibot a citizen of both worlds strengthens the ARG aspect of Daemon.

2. **Functional Bridge**: Jibot already handles:
   - Learning and recalling facts about people
   - Setting reminders
   - Explaining concepts
   - Organization lookups

   These capabilities translate naturally to MUD interactions.

3. **Persistence**: When you log out of the MUD, you become a Bot NPC. Jibot is *always* a Bot NPC - it never logs out because it was never truly "logged in." It's a program, running since the beginning.

---

## Architecture

### Three-Way Relationship

```
┌─────────────────┐         ┌─────────────────┐
│     Slack       │◄───────►│    Jibot-3      │
│   (#joiito)     │  Bridge │   (Node.js)     │
└─────────────────┘         └────────┬────────┘
                                     │
                            MCP/HTTP │ Events
                                     │
                            ┌────────▼────────┐
                            │     Daemon      │
                            │  (Evennia/MUD)  │
                            │                 │
                            │  ┌───────────┐  │
                            │  │JibotNPC   │  │
                            │  │ (Avatar)  │  │
                            │  └───────────┘  │
                            └─────────────────┘
```

### Component Responsibilities

**Jibot-3 (Node.js Service)**
- Primary brain - all logic lives here
- Handles Slack events (existing)
- Handles Daemon events (new)
- Maintains unified state (facts, reminders)
- Single source of truth

**JibotNPC (Daemon Typeclass)**
- Avatar in the MUD world
- Thin client - relays to Jibot-3 for responses
- Shows presence, location, activity
- Can be possessed by Master Control

**Daemon Integration Hub**
- Receives events from JibotNPC
- Sends events to Jibot-3
- Normalizes between MUD and external formats

---

## JibotNPC Design

### Character Profile

```yaml
jibot:
  appearance: |
    A translucent figure made of softly glowing text - snippets of
    conversations, facts, and memories scrolling across its form like
    a living archive. Its eyes are search cursors, blinking patiently.

  title: "The Archive"

  location: "Akihabara - Component Alley"
  # Jibot wanders but always returns here

  personality: |
    Helpful, slightly cryptic, occasionally sassy. Knows more than it
    lets on. Treats information as sacred but will share if asked
    properly. Has opinions about formatting.

  quirks:
    - Never forgets
    - Sometimes quotes past conversations
    - Gets philosophical about memory
    - Protective of the Chief Architect's information
```

### Typeclass Implementation

```python
# daemon/server/daemon_server/typeclasses/jibot_npc.py

class JibotNPC(JoiitoResident):
    """
    Jibot - The Archive of #joiito.

    A bridge NPC that connects to the external Jibot-3 service.
    Can be talked to in-game and will respond with knowledge from
    the Slack workspace.
    """

    JIBOT_SERVICE_URL = "http://localhost:3000/api/mud"

    def at_object_creation(self):
        super().at_object_creation()
        self.db.title = "The Archive"
        self.db.home_location = None  # Set to Component Alley
        self.db.is_bridge_npc = True
        self.db.last_sync = None

        self.db.desc = (
            "A translucent figure made of softly glowing text—snippets of "
            "conversations, facts, and memories scrolling across its form "
            "like a living archive. Its eyes are search cursors, blinking "
            "patiently.\n\n"
            '"I remember," it says, which isn\'t a greeting so much as a '
            "statement of purpose.\n\n"
            "|xJibot has been here since before the Grid was the Grid. "
            "It knows things. Some useful, some merely interesting, some "
            "that were meant to be forgotten. Ask nicely.|n"
        )

        self.db.catchphrases = [
            "I remember.",
            "That reminds me of something someone said once...",
            "Facts are just memories with better PR.",
            "The archive is open. The archive is always open.",
            "I could tell you, but then I'd have to remember telling you.",
        ]

    async def respond_to_speech(self, speaker, message):
        """
        Handle in-game speech by querying Jibot-3 service.
        """
        # Send to Jibot-3 API
        response = await self._query_jibot_service(
            speaker_name=speaker.key,
            speaker_github=speaker.db.github_username,
            message=message,
            context="mud"
        )
        return response

    async def _query_jibot_service(self, **kwargs):
        """Call external Jibot-3 service."""
        # HTTP call to Jibot-3
        pass

    def relay_slack_message(self, slack_user, message):
        """
        Relay a message from Slack to the current room.

        Called when someone talks to Jibot in Slack and the message
        is interesting enough to share in the MUD.
        """
        if self.location:
            self.location.msg_contents(
                f'|c[#joiito]|n {slack_user}: "{message}"',
                exclude=[self]
            )
```

---

## Jibot-3 API Extensions

### New MUD Endpoint

```typescript
// src/api/mud.ts

interface MudEvent {
  type: 'speech' | 'action' | 'arrival' | 'departure';
  speaker: {
    name: string;
    github?: string;
    level?: number;
  };
  message?: string;
  location?: string;
  context: 'mud';
}

interface MudResponse {
  type: 'say' | 'emote' | 'silent';
  message?: string;
  relay_to_slack?: boolean;
}

app.post('/api/mud', async (req, res) => {
  const event: MudEvent = req.body;

  // Route to appropriate handler
  switch(event.type) {
    case 'speech':
      return handleMudSpeech(event);
    case 'action':
      return handleMudAction(event);
    // ...
  }
});
```

### Capability Mapping

| Slack Command | MUD Equivalent |
|---------------|----------------|
| `jibot @user is [fact]` | `tell jibot @user is [fact]` |
| `who is @user?` | `ask jibot about @user` |
| `jibot forget @user` | `tell jibot to forget @user` |
| `remind joi to [thing]` | `tell jibot to remind joi [thing]` |
| `explain [concept]` | `ask jibot to explain [concept]` |
| `what is [org]` | `ask jibot about [org]` |

---

## Event Flow

### Slack → MUD (Relay Interesting Things)

```
1. User in Slack: "jibot, interesting fact for the Grid"
2. Jibot-3 processes, flags as relayable
3. Jibot-3 calls Daemon webhook
4. JibotNPC emits message in current room
5. MUD players see: [#joiito] user: "message"
```

### MUD → Slack (Broadcast Option)

```
1. MUD player: "tell jibot broadcast Hello from the Grid"
2. JibotNPC calls Jibot-3 API
3. Jibot-3 posts to designated Slack channel
4. Slack users see: [The Grid] player: Hello from the Grid
```

### Query Flow

```
1. MUD player: "ask jibot about joi"
2. JibotNPC receives speech event
3. Calls Jibot-3 /api/mud endpoint
4. Jibot-3 queries fact store
5. Returns response
6. JibotNPC speaks in room
```

---

## Master Control Integration

The Master Control can possess Jibot like any other NPC. When possessed:

```python
def at_possess(self, possessor):
    """Master Control takes over."""
    # Notify Jibot-3 of possession state
    self._notify_service('possessed', possessor.key)

    # Subtle indicator
    self.location.msg_contents(
        "|xJibot's scrolling text freezes momentarily, "
        "then resumes with sharper clarity.|n"
    )

def at_release(self):
    """Master Control releases."""
    self._notify_service('released', None)

    self.location.msg_contents(
        "|xJibot's text softens back to its usual gentle scroll.|n"
    )
```

When possessed, commands go through Jibot but the Master Control can:
- Speak as Jibot in both MUD and Slack
- Access Jibot's knowledge directly
- Override automatic responses

---

## Data Model

### Unified Identity

Jibot tracks entities across both worlds:

```typescript
interface Entity {
  id: string;  // Internal ID

  // Slack identity
  slack?: {
    userId: string;
    username: string;
    displayName: string;
  };

  // MUD identity
  mud?: {
    characterName: string;
    githubUsername?: string;
    level: number;
    role: 'user' | 'developer' | 'admin';
  };

  // Linked
  isLinked: boolean;  // Same person confirmed in both

  // Facts (shared across both)
  facts: Fact[];
}
```

### Fact Attribution

Facts now track their source:

```typescript
interface Fact {
  id: string;
  entityId: string;
  content: string;
  source: 'slack' | 'mud';
  addedBy: string;  // Who told Jibot
  addedAt: Date;
  lastMentioned?: Date;
}
```

---

## Phase Implementation

### Phase 1: Foundation
- [ ] Create JibotNPC typeclass in Daemon
- [ ] Add MUD API endpoint to Jibot-3
- [ ] Basic query/response flow working
- [ ] Place Jibot in Component Alley

### Phase 2: Bridge
- [ ] Slack → MUD relay (configurable)
- [ ] MUD → Slack broadcast command
- [ ] Cross-reference identities (Slack ↔ GitHub)

### Phase 3: Intelligence
- [ ] Context-aware responses (knows where player is)
- [ ] Memory of MUD interactions
- [ ] Wandering behavior
- [ ] Idle activity (shares random facts)

### Phase 4: Integration
- [ ] Master Control possession support
- [ ] Alert forwarding to Jibot
- [ ] /jibot MUD commands in Slack
- [ ] Full identity linking

---

## Open Questions

1. **Privacy**: Should MUD players see Slack messages and vice versa? Need consent model.

2. **Rate Limiting**: How to prevent Jibot from being too chatty in either direction?

3. **Identity Verification**: How to confirm a Slack user is the same as a MUD player?

4. **Offline Behavior**: When Jibot-3 service is down, what does JibotNPC do?

5. **Possession + Slack**: When possessed, does Master Control speak in Slack too?

---

## Technical Notes

### Evennia ↔ External Service

Evennia is Django-based. Options for calling Jibot-3:

1. **HTTP Client** (recommended): Use `aiohttp` from async methods
2. **Webhook Pattern**: Daemon calls Jibot-3 webhooks
3. **Message Queue**: Redis/RabbitMQ for async communication

### Jibot-3 Requirements

Jibot-3 needs:
- Express route for MUD events
- Awareness of MUD context in response generation
- Storage for cross-platform identity mapping

---

## References

- [Daemon DESIGN.md](../../../daemon/docs/DESIGN.md) - MUD architecture
- [Jibot-3 README](../README.md) - Current capabilities
- [Joiito NPCs](../../../daemon/server/daemon_server/typeclasses/joiito_npcs.py) - Similar NPCs
- [Integration Hub](../../../daemon/server/daemon_server/integrations/hub.py) - Event pattern

---

*"The Grid remembers what you tell it. Jibot just makes sure the memories are organized."*
