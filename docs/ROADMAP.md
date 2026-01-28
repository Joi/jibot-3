# Jibot 3 Roadmap

> From community memory bot to personal assistant bridge

This roadmap tracks the evolution of Jibot from a Slack community memory bot into a multi-platform personal assistant that bridges Slack, MUD (Daemon), and personal productivity systems.

---

## Current State (v1.0)

### Completed Features

| Feature | Status | Notes |
|---------|--------|-------|
| Learn/recall facts about people | ✅ Done | Core community memory |
| Herald on channel join | ✅ Done | Welcomes with facts |
| Forget facts | ✅ Done | Privacy controls |
| Reminder inbox | ✅ Done | Routes to Apple Reminders |
| Concept/org lookup | ✅ Done | Queries Obsidian vault |
| Slash commands (/jibot) | ✅ Done | Full command set |
| Multi-tier permissions | ✅ Done | Owner/admin/guest |
| Whoop health status | ✅ Done | Recovery/sleep data |
| Calendar add (natural language) | ✅ Done | Google Calendar integration |
| Owner posting (/jibot post) | ✅ Done | Post as Jibot to any channel |
| **MUD API endpoint** | ✅ Done | HTTP API for Daemon |
| **JibotNPC typeclass** | ✅ Done | Avatar in the Grid |
| Slack WebSocket stability | ✅ Fixed | Custom ping timeouts |

---

## Phase 1: MUD Bridge (In Progress)

Complete the Daemon MUD integration - making Jibot a citizen of both Slack and the Grid.

| Issue | Title | Priority | Status | Blocked By |
|-------|-------|----------|--------|------------|
| li1 | Basic MUD query/response flow | P2 | 🟡 Ready | - |
| 3nq | Slack to MUD relay | P2 | ⏸️ Blocked | li1 |
| p6m | MUD to Slack broadcast | P2 | ⏸️ Blocked | li1 |
| e2v | Master Control possession support | P3 | 🟡 Ready | - |
| 500 | Jibot wandering and idle behavior | P3 | 🟡 Ready | - |

**Milestone:** Players can talk to Jibot in the MUD and get the same responses as Slack. Messages can flow both directions.

---

## Phase 2: Core Enhancements

Quality of life improvements to the existing Slack bot functionality.

| Issue | Title | Priority | Status | Notes |
|-------|-------|----------|--------|-------|
| it6 | Web interface for viewing/editing facts | P2 | 🟢 Open | Admin dashboard |
| 368 | Fact categories or tags | P2 | 🟢 Open | #work, #interests, etc. |
| v4k | Import/export facts | P2 | 🟢 Open | Backup/migration |
| 9x2 | "On this day" feature | P2 | 🟢 Open | Daily digest potential |

**Milestone:** Facts are organized, browseable via web UI, and can be backed up.

---

## Phase 3: Personal Assistant Foundation

Begin the transformation from community memory to personal assistant.

| Issue | Title | Priority | Status | Blocked By |
|-------|-------|----------|--------|------------|
| 0lf | Task Integration with GTD system | P3 | 🟢 Open | - |
| bx5 | Calendar Awareness | P3 | 🟢 Open | - |
| 4a1 | Contact Management | P3 | 🟢 Open | - |

**Milestone:** Jibot knows Joi's schedule, can accept tasks via Slack, and understands relationships between contacts.

---

## Phase 4: Intelligence Layer

Advanced features that require the foundation from Phase 3.

| Issue | Title | Priority | Status | Blocked By |
|-------|-------|----------|--------|------------|
| 5xb | Delegation Interface | P3 | ⏸️ Blocked | 0lf |
| cnh | Knowledge Bridge to Obsidian | P3 | ⏸️ Blocked | 4a1 |
| dbs | Proactive Updates | P3 | ⏸️ Blocked | 0lf, bx5 |

**Milestone:** Colleagues can delegate tasks to Joi via Slack, Jibot surfaces relevant context from the knowledge base, and proactively notifies people when tasks complete.

---

## Phase 5: Identity Unification

Cross-platform identity linking for seamless experience across Slack and MUD.

| Issue | Title | Priority | Status | Blocked By |
|-------|-------|----------|--------|------------|
| ok1 | Cross-platform identity linking | P3 | ⏸️ Blocked | 3nq, p6m |

**Milestone:** Slack users can link to MUD characters, facts are shared across both identities, full bidirectional communication.

---

## Vision: The Complete Picture

```
┌─────────────────────────────────────────────────────────────────┐
│                         COLLEAGUES                               │
│                            │                                     │
│           ┌────────────────┼────────────────┐                   │
│           ▼                ▼                ▼                   │
│      ┌─────────┐    ┌───────────┐    ┌───────────┐             │
│      │  Slack  │    │    MUD    │    │    Web    │             │
│      │ #joiito │    │  (Daemon) │    │   Admin   │             │
│      └────┬────┘    └─────┬─────┘    └─────┬─────┘             │
│           │               │                │                    │
│           └───────────────┼────────────────┘                    │
│                           ▼                                     │
│                    ┌─────────────┐                              │
│                    │   Jibot-3   │                              │
│                    │   (Brain)   │                              │
│                    └──────┬──────┘                              │
│                           │                                     │
│           ┌───────────────┼───────────────┐                    │
│           ▼               ▼               ▼                    │
│    ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│    │   Apple    │  │   Google   │  │  Obsidian  │             │
│    │ Reminders  │  │  Calendar  │  │   Vault    │             │
│    └────────────┘  └────────────┘  └────────────┘             │
│                           │                                     │
│                           ▼                                     │
│                    ┌─────────────┐                              │
│                    │     JOI     │                              │
│                    └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

**The End State:**
- Jibot is the Slack/MUD interface to Joi's productivity ecosystem
- Colleagues can check availability, add tasks, get context
- Jibot proactively surfaces relevant information
- Facts, tasks, calendar, and knowledge base are unified
- Identity spans both Slack and MUD seamlessly

---

## Issue Tracking

Issues are tracked using [beads](https://github.com/Dicklesworthstone/beads_viewer) in `.beads/`.

```bash
bd ready              # See what's ready to work on
bd list --status=open # All open issues
bd show <id>          # Issue details
```

---

## Contributing

1. Check `bd ready` for unblocked work
2. Claim with `bd update <id> --status=in_progress`
3. Implement and test
4. Close with `bd close <id> --reason="..."`
5. Sync with `bd sync`

---

*Last updated: 2026-01-28*
