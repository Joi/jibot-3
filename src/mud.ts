/**
 * MUD API - Bridge between Jibot and Daemon MUD
 *
 * Handles events from the JibotNPC in Daemon, allowing players
 * to interact with Jibot in the virtual world.
 *
 * See docs/DAEMON-INTEGRATION.md for full design.
 */

import express, { Router, Request, Response } from "express";
import {
  getFacts,
  getDisplayName,
  formatFactsSentence,
  getPerson,
} from "./people.js";
import { lookupConcept, lookupOrganization, searchSwitchboard } from "./switchboard.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Event sent from JibotNPC when a player speaks to Jibot
 */
export interface MudEvent {
  type: "speech" | "action" | "arrival" | "departure";
  speaker: {
    name: string;           // MUD character name
    github?: string;        // GitHub username if linked
    level?: number;         // Player level in the MUD
    role?: "user" | "developer" | "admin" | "chief_architect";
  };
  message?: string;         // What they said/did
  location?: string;        // Room name in the MUD
  context: "mud";           // Always "mud" for these events
}

/**
 * Response sent back to JibotNPC
 */
export interface MudResponse {
  type: "say" | "emote" | "silent";
  message?: string;
  relay_to_slack?: boolean;  // Should this be relayed to #joiito?
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle speech directed at Jibot in the MUD
 */
function handleSpeech(event: MudEvent): MudResponse {
  const message = event.message?.toLowerCase().trim() || "";
  const speaker = event.speaker;

  // "who is [name]" or "what do you know about [name]"
  const whoIsMatch = message.match(/(?:who is|what do you know about)\s+(.+?)\??$/i);
  if (whoIsMatch) {
    const query = whoIsMatch[1].trim();
    return handleWhoIsQuery(query, speaker);
  }

  // "[name] is [fact]" - learning
  const learnMatch = message.match(/^(.+?)\s+is\s+(.+)$/i);
  if (learnMatch && !learnMatch[1].toLowerCase().startsWith("who") && !learnMatch[1].toLowerCase().startsWith("what")) {
    const name = learnMatch[1].trim();
    const fact = learnMatch[2].trim();
    return handleLearnFact(name, fact, speaker);
  }

  // "explain [concept]"
  const explainMatch = message.match(/^explain\s+(.+)$/i);
  if (explainMatch) {
    const query = explainMatch[1].trim();
    return handleExplain(query);
  }

  // "what is [org/concept]"
  const whatIsMatch = message.match(/^what is\s+(.+?)\??$/i);
  if (whatIsMatch) {
    const query = whatIsMatch[1].trim();
    return handleWhatIs(query);
  }

  // "help" or empty
  if (message === "help" || message === "") {
    return handleHelp();
  }

  // "broadcast [message]" - relay to Slack
  const broadcastMatch = message.match(/^broadcast\s+(.+)$/i);
  if (broadcastMatch) {
    return {
      type: "say",
      message: `Relaying to #joiito: "${broadcastMatch[1]}"`,
      relay_to_slack: true,
    };
  }

  // Default: don't understand
  return {
    type: "say",
    message: `*tilts head* I don't quite understand. Try "help" to see what I can do.`,
  };
}

/**
 * Handle "who is [name]" query
 */
function handleWhoIsQuery(query: string, speaker: MudEvent["speaker"]): MudResponse {
  // First check if we have facts about this person
  // In MUD context, we use "mud" as the team/workspace identifier
  // and try to find by display name or GitHub username

  // Search across all known people for a name match
  // For now, return a placeholder - we'll need to enhance the people.ts
  // module to support name-based lookups

  const searchResults = searchSwitchboard(query);

  // Check if it might be an organization
  const org = lookupOrganization(query);
  if (org) {
    return {
      type: "say",
      message: `${query}? That's an organization: ${org.summary}`,
    };
  }

  return {
    type: "say",
    message: `*scrolls through memories* I don't have information about "${query}" in my archives. Perhaps you could tell me something about them?`,
  };
}

/**
 * Handle learning a new fact in MUD context
 */
function handleLearnFact(name: string, fact: string, speaker: MudEvent["speaker"]): MudResponse {
  // In MUD context, we store facts differently - keyed by name rather than Slack UID
  // For now, acknowledge the intent to learn
  // Full implementation will require enhancing people.ts

  return {
    type: "say",
    message: `*text scrolls and reorganizes* Noted. ${name} is ${fact}. I'll remember that.`,
  };
}

/**
 * Handle concept explanation
 */
function handleExplain(query: string): MudResponse {
  const concept = lookupConcept(query);
  if (concept) {
    return {
      type: "say",
      message: `*projects holographic text* ${concept.name}: ${concept.summary}`,
    };
  }

  const results = searchSwitchboard(query);
  if (results.concepts.length > 0) {
    return {
      type: "say",
      message: `*flickers thoughtfully* I don't know "${query}" exactly, but perhaps you meant: ${results.concepts.slice(0, 3).join(", ")}?`,
    };
  }

  return {
    type: "say",
    message: `*search cursors blink* "${query}" isn't in my archives. The knowledge base is vast but not infinite.`,
  };
}

/**
 * Handle "what is" query (org or concept)
 */
function handleWhatIs(query: string): MudResponse {
  // Try org first
  const org = lookupOrganization(query);
  if (org) {
    return {
      type: "say",
      message: `*displays organizational data* ${org.name}: ${org.summary}`,
    };
  }

  // Try concept
  const concept = lookupConcept(query);
  if (concept) {
    return {
      type: "say",
      message: `*projects definition* ${concept.name}: ${concept.summary}`,
    };
  }

  // Search for suggestions
  const results = searchSwitchboard(query);
  if (results.concepts.length > 0 || results.organizations.length > 0) {
    const suggestions = [...results.concepts.slice(0, 2), ...results.organizations.slice(0, 2)];
    return {
      type: "say",
      message: `*scans archives* No exact match for "${query}". Similar entries: ${suggestions.join(", ")}`,
    };
  }

  return {
    type: "say",
    message: `*text dims slightly* "${query}" isn't in my records. Perhaps it's too new, or too obscure.`,
  };
}

/**
 * Handle help request
 */
function handleHelp(): MudResponse {
  return {
    type: "say",
    message: `*glowing text coalesces*

The Archive knows many things. Ask me:
  "who is [name]?" - recall what I know about someone
  "[name] is [fact]" - teach me something new
  "explain [concept]" - look up a concept
  "what is [thing]?" - organization or concept lookup
  "broadcast [message]" - relay to #joiito Slack

I remember. That is my purpose.`,
  };
}

/**
 * Handle player arrival in Jibot's room
 */
function handleArrival(event: MudEvent): MudResponse {
  const speaker = event.speaker;

  // Try to recall facts about this person
  // For now, use a generic greeting
  if (speaker.github) {
    return {
      type: "say",
      message: `*text scrolls, highlighting a name* Ah, ${speaker.name}. I've seen your commits. Welcome.`,
    };
  }

  if (speaker.level && speaker.level >= 25) {
    return {
      type: "say",
      message: `*glowing text brightens* ${speaker.name}. You've come far on the Grid. What brings you to the Archive?`,
    };
  }

  return {
    type: "emote",
    message: `*notices ${speaker.name} and nods slowly, text scrolling across its form*`,
  };
}

/**
 * Handle player departure from Jibot's room
 */
function handleDeparture(event: MudEvent): MudResponse {
  // Usually silent on departure
  return { type: "silent" };
}

/**
 * Handle player action (emote) near Jibot
 */
function handleAction(event: MudEvent): MudResponse {
  const action = event.message?.toLowerCase() || "";

  // Respond to certain actions
  if (action.includes("wave") || action.includes("greet")) {
    return {
      type: "emote",
      message: `*search cursors blink in acknowledgment*`,
    };
  }

  if (action.includes("examine") || action.includes("look")) {
    return {
      type: "say",
      message: `*the scrolling text slows, as if aware of being observed* Yes?`,
    };
  }

  // Most actions get no response
  return { type: "silent" };
}

// ============================================================================
// API Router
// ============================================================================

/**
 * Create Express router for MUD API
 */
export function createMudRouter(): Router {
  const router = Router();

  // Health check
  router.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "jibot-mud-api" });
  });

  // Main event endpoint
  router.post("/event", (req: Request, res: Response) => {
    try {
      const event: MudEvent = req.body;

      // Validate event
      if (!event.type || event.context !== "mud") {
        res.status(400).json({ error: "Invalid event format" });
        return;
      }

      let response: MudResponse;

      switch (event.type) {
        case "speech":
          response = handleSpeech(event);
          break;
        case "arrival":
          response = handleArrival(event);
          break;
        case "departure":
          response = handleDeparture(event);
          break;
        case "action":
          response = handleAction(event);
          break;
        default:
          response = { type: "silent" };
      }

      res.json(response);
    } catch (error) {
      console.error("MUD API error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Query endpoint for direct lookups (alternative to speech)
  router.get("/query", (req: Request, res: Response) => {
    const type = req.query.type as string;
    const q = req.query.q as string;

    if (!q) {
      res.status(400).json({ error: "Missing query parameter 'q'" });
      return;
    }

    let result: { found: boolean; data?: any; suggestions?: string[] } = { found: false };

    if (type === "concept") {
      const concept = lookupConcept(q);
      if (concept) {
        result = { found: true, data: concept };
      }
    } else if (type === "org") {
      const org = lookupOrganization(q);
      if (org) {
        result = { found: true, data: org };
      }
    } else {
      // Search both
      const concept = lookupConcept(q);
      const org = lookupOrganization(q);
      if (concept) {
        result = { found: true, data: { type: "concept", ...concept } };
      } else if (org) {
        result = { found: true, data: { type: "org", ...org } };
      }
    }

    if (!result.found) {
      const search = searchSwitchboard(q);
      result.suggestions = [...search.concepts.slice(0, 3), ...search.organizations.slice(0, 3)];
    }

    res.json(result);
  });

  return router;
}

/**
 * Create standalone Express app with MUD API
 */
export function createMudApiServer(port: number = 3001): express.Application {
  const app = express();

  app.use(express.json());

  // Mount MUD API at /api/mud
  app.use("/api/mud", createMudRouter());

  // Root health check
  app.get("/", (_req: Request, res: Response) => {
    res.json({
      service: "jibot-3",
      apis: {
        mud: "/api/mud",
      },
    });
  });

  return app;
}
