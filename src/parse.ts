/**
 * Jibot Parse Engine - Phase 1
 * 
 * Natural language command parsing for owner DM mode.
 * Classifies intents and routes to appropriate handlers.
 */

import { execSync } from "child_process";

// Amplifier bridge path
const BRIDGE_PATH = process.env.HOME + "/jibot-3/scripts/amplifier_bridge.py";

interface BridgeResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Call amplifier bridge to execute a skill
 */
function callBridge(skill: string, action: string, ...args: string[]): BridgeResult {
  try {
    const escapedArgs = args.map(a => `'${a.replace(/'/g, "'\''")}'`).join(" ");
    const cmd = `${BRIDGE_PATH} ${skill} ${action} ${escapedArgs}`;
    const result = execSync(cmd, { 
      encoding: "utf-8",
      timeout: 30000,  // 30 second timeout
      maxBuffer: 10 * 1024 * 1024  // 10MB buffer
    });
    return JSON.parse(result.trim());
  } catch (error: any) {
    // Try to parse error output as JSON
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout.trim());
      } catch {}
    }
    return { success: false, error: error.message };
  }
}
import * as fs from "fs";
import * as path from "path";

// Intent types
export type Intent = 
  | "lookup_person"
  | "lookup_org"
  | "lookup_calendar"
  | "lookup_email"
  | "lookup_reminder"
  | "lookup_general"
  | "action_remind"
  | "action_calendar"
  | "action_note"
  | "notify_slack"
  | "notify_email"
  | "unknown";

export interface ParseResult {
  intent: Intent;
  confidence: number;
  entities: {
    person?: string;
    org?: string;
    date?: string;
    time?: string;
    topic?: string;
    slackUser?: string;
    email?: string;
    message?: string;
  };
  raw: string;
}

export interface LookupResult {
  found: boolean;
  type: "person" | "org" | "general";
  name?: string;
  summary?: string;
  email?: string;
  details?: string;
  filePath?: string;
}

// Switchboard paths
const SWITCHBOARD_PATH = process.env.HOME + "/switchboard";
const PEOPLE_PATH = path.join(SWITCHBOARD_PATH, "people");
const ORGS_PATH = path.join(SWITCHBOARD_PATH, "organizations");

/**
 * Parse natural language input and classify intent
 */
export function parseCommand(text: string): ParseResult {
  const lower = text.toLowerCase().trim();
  const result: ParseResult = {
    intent: "unknown",
    confidence: 0,
    entities: {},
    raw: text
  };

  // === LOOKUP PATTERNS ===
  // Order matters! More specific patterns first, then general person lookup last.

  // Help/capabilities query - don't parse as lookup
  if (/what\s+can\s+you\s+do/i.test(lower) || /help/i.test(lower)) {
    result.intent = "unknown";
    result.confidence = 0;
    return result;  // Fall through to help handler
  }

  // Inbox/Reminders lookup (BEFORE person patterns!)
  if (/(?:what(?:'s|\s+is)\s+(?:in\s+)?my\s+)?(?:inbox|reminders?)/i.test(lower) ||
      /(?:show|list)\s+(?:my\s+)?(?:inbox|reminders?)/i.test(lower) ||
      /my\s+inbox/i.test(lower)) {
    result.intent = "lookup_reminder";
    result.confidence = 0.9;
    return result;
  }

  // Calendar lookup (BEFORE person patterns!)
  if (/(?:calendar|schedule|meeting|events?)\s+(?:for\s+)?(?:today|tomorrow|this\s+week|next\s+week)/i.test(lower) ||
      /what(?:'s|\s+is)\s+(?:on\s+)?my\s+(?:calendar|schedule)/i.test(lower) ||
      /my\s+(?:calendar|schedule)\s+(?:today|tomorrow|this\s+week)?/i.test(lower)) {
    result.intent = "lookup_calendar";
    result.confidence = 0.9;
    
    if (/today/i.test(lower)) result.entities.date = "today";
    else if (/tomorrow/i.test(lower)) result.entities.date = "tomorrow";
    else if (/this\s+week/i.test(lower)) result.entities.date = "this week";
    else if (/next\s+week/i.test(lower)) result.entities.date = "next week";
    else result.entities.date = "today";
    
    return result;
  }

  // Email lookup (BEFORE person patterns!)
  if (/(?:emails?|messages?)\s+(?:from|about|regarding)/i.test(lower) ||
      /(?:find|search|check)\s+(?:my\s+)?(?:emails?)/i.test(lower) ||
      /my\s+emails?/i.test(lower)) {
    result.intent = "lookup_email";
    result.confidence = 0.8;
    
    const fromMatch = lower.match(/from\s+(\S+)/i);
    if (fromMatch) result.entities.person = fromMatch[1];
    
    const aboutMatch = lower.match(/(?:about|regarding)\s+(.+?)(?:\?|$)/i);
    if (aboutMatch) result.entities.topic = aboutMatch[1];
    
    return result;
  }

  // Person lookup: "who is X", "what do I know about X", "X's email", "tell me about X"
  const personPatterns = [
    /(?:who\s+is|who's)\s+(.+?)(?:\?|$)/i,
    /(?:what\s+do\s+(?:i|we)\s+know\s+about)\s+(.+?)(?:\?|$)/i,
    /(?:tell\s+me\s+about)\s+(.+?)(?:\?|$)/i,
    /(?:find|lookup|look\s+up)\s+(?:person\s+)?(.+?)(?:\?|$)/i,
    /(.+?)(?:'s|s')\s+(?:email|contact|info|phone|background)/i,
    /(?:email|contact)\s+(?:for|of)\s+(.+?)(?:\?|$)/i,
  ];

  for (const pattern of personPatterns) {
    const match = lower.match(pattern);
    if (match) {
      result.intent = "lookup_person";
      result.confidence = 0.8;
      result.entities.person = match[1].trim().replace(/[?.,!]$/, "");
      return result;
    }
  }

  // Organization lookup
  const orgPatterns = [
    /(?:company|org|organization)\s+(?:called|named)\s+(.+?)(?:\?|$)/i,
  ];

  for (const pattern of orgPatterns) {
    const match = lower.match(pattern);
    if (match) {
      result.intent = "lookup_org";
      result.confidence = 0.7;
      result.entities.org = match[1].trim();
      return result;
    }
  }

  // Calendar action
  if (/(?:calendar|schedule|meeting|events?)\s+(?:for\s+)?(?:today|tomorrow|this\s+week|next\s+week)/i.test(lower) ||
      /what(?:'s|\s+is)\s+(?:on\s+)?my\s+(?:calendar|schedule)/i.test(lower)) {
    result.intent = "lookup_calendar";
    result.confidence = 0.8;
    
    if (/today/i.test(lower)) result.entities.date = "today";
    else if (/tomorrow/i.test(lower)) result.entities.date = "tomorrow";
    else if (/this\s+week/i.test(lower)) result.entities.date = "this week";
    else if (/next\s+week/i.test(lower)) result.entities.date = "next week";
    
    return result;
  }

  // Email lookup
  if (/(?:emails?|messages?)\s+(?:from|about|regarding)/i.test(lower) ||
      /(?:find|search|check)\s+(?:my\s+)?(?:emails?|inbox)/i.test(lower)) {
    result.intent = "lookup_email";
    result.confidence = 0.7;
    
    const fromMatch = lower.match(/from\s+(\S+)/i);
    if (fromMatch) result.entities.person = fromMatch[1];
    
    const aboutMatch = lower.match(/(?:about|regarding)\s+(.+?)(?:\?|$)/i);
    if (aboutMatch) result.entities.topic = aboutMatch[1];
    
    return result;
  }

  // Reminder lookup
  if (/(?:what(?:'s|\s+is)\s+(?:in\s+)?my\s+)?(?:inbox|reminders?)/i.test(lower) ||
      /(?:show|list)\s+(?:my\s+)?reminders?/i.test(lower)) {
    result.intent = "lookup_reminder";
    result.confidence = 0.8;
    return result;
  }

  // === ACTION PATTERNS ===

  // Remind action
  if (/(?:remind\s+me|add\s+(?:a\s+)?reminder|remember\s+to)/i.test(lower)) {
    result.intent = "action_remind";
    result.confidence = 0.8;
    
    const toMatch = lower.match(/(?:remind\s+me\s+to|remember\s+to|reminder\s+to)\s+(.+)/i);
    if (toMatch) result.entities.message = toMatch[1];
    
    return result;
  }

  // Calendar action
  if (/(?:schedule|add|create|put)\s+(?:a\s+)?(?:meeting|event|appointment)/i.test(lower) ||
      /(?:add|put)\s+(?:on|to)\s+(?:my\s+)?calendar/i.test(lower)) {
    result.intent = "action_calendar";
    result.confidence = 0.7;
    result.entities.message = text;
    return result;
  }

  // Note action
  if (/(?:create|make|write|add)\s+(?:a\s+)?note/i.test(lower)) {
    result.intent = "action_note";
    result.confidence = 0.7;
    result.entities.message = text;
    return result;
  }

  // === NOTIFY PATTERNS ===

  // Slack notify
  if (/(?:tell|message|dm|send\s+(?:a\s+)?message\s+to)\s+<@([A-Z0-9]+)>/i.test(text) ||
      /(?:tell|message|notify)\s+@(\w+)/i.test(lower)) {
    result.intent = "notify_slack";
    result.confidence = 0.8;
    
    const slackMatch = text.match(/<@([A-Z0-9]+)>/i) || lower.match(/@(\w+)/i);
    if (slackMatch) result.entities.slackUser = slackMatch[1];
    
    const msgMatch = text.match(/(?:that|saying|to\s+say)\s+(.+)/i);
    if (msgMatch) result.entities.message = msgMatch[1];
    
    return result;
  }

  // Email notify
  if (/(?:email|send\s+(?:an?\s+)?email\s+to)\s+(\S+@\S+)/i.test(lower)) {
    result.intent = "notify_email";
    result.confidence = 0.7;
    
    const emailMatch = lower.match(/(\S+@\S+)/i);
    if (emailMatch) result.entities.email = emailMatch[1];
    
    return result;
  }

  // If nothing matched, try a simple person lookup as fallback
  // (short inputs like "alice chen" might be person lookups)
  if (text.split(/\s+/).length <= 4 && !text.includes("?")) {
    result.intent = "lookup_person";
    result.confidence = 0.4;
    result.entities.person = text.trim();
  }

  return result;
}

/**
 * Search Switchboard for a person
 */
export function searchPerson(query: string): LookupResult {
  const result: LookupResult = { found: false, type: "person" };
  
  if (!fs.existsSync(PEOPLE_PATH)) {
    return result;
  }

  // Normalize query
  const normalizedQuery = query.toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
  
  const queryParts = normalizedQuery.split(/\s+/);

  try {
    const files = fs.readdirSync(PEOPLE_PATH);
    
    // Score each file
    let bestMatch: { file: string; score: number } | null = null;
    
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      
      const fileName = file.replace(".md", "").toLowerCase();
      let score = 0;
      
      // Exact match
      if (fileName === normalizedQuery.replace(/\s+/g, "-")) {
        score = 100;
      }
      // All query parts in filename
      else if (queryParts.every(part => fileName.includes(part))) {
        score = 80;
      }
      // Some query parts in filename
      else {
        const matchedParts = queryParts.filter(part => fileName.includes(part));
        score = (matchedParts.length / queryParts.length) * 60;
      }
      
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { file, score };
      }
    }

    if (bestMatch && bestMatch.score >= 40) {
      const filePath = path.join(PEOPLE_PATH, bestMatch.file);
      const content = fs.readFileSync(filePath, "utf-8");
      
      result.found = true;
      result.filePath = filePath;
      result.name = bestMatch.file.replace(".md", "").replace(/-/g, " ");
      
      // Extract email
      const emailMatch = content.match(/(?:email|e-mail):\s*(\S+@\S+)/i) ||
                         content.match(/(\S+@\S+\.\w+)/);
      if (emailMatch) result.email = emailMatch[1];
      
      // Extract summary (first paragraph after frontmatter, or first 500 chars)
      const summaryMatch = content.match(/^---[\s\S]*?---\s*\n+([\s\S]{0,500})/);
      if (summaryMatch) {
        result.summary = summaryMatch[1].trim().split("\n\n")[0];
      } else {
        result.summary = content.substring(0, 500).split("\n\n")[0];
      }
      
      // Clean up summary
      result.summary = result.summary
        .replace(/^#+\s*.*/gm, "")  // Remove headers
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")  // Clean links
        .trim();
        
      if (result.summary.length > 300) {
        result.summary = result.summary.substring(0, 300) + "...";
      }
      
      result.details = content;
    }
  } catch (error) {
    console.error("Error searching people:", error);
  }

  return result;
}

/**
 * Search Switchboard for an organization
 */
export function searchOrg(query: string): LookupResult {
  const result: LookupResult = { found: false, type: "org" };
  
  if (!fs.existsSync(ORGS_PATH)) {
    return result;
  }

  const normalizedQuery = query.toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();

  try {
    const files = fs.readdirSync(ORGS_PATH);
    
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      
      const fileName = file.replace(".md", "").toLowerCase();
      
      if (fileName.includes(normalizedQuery) || normalizedQuery.includes(fileName)) {
        const filePath = path.join(ORGS_PATH, file);
        const content = fs.readFileSync(filePath, "utf-8");
        
        result.found = true;
        result.filePath = filePath;
        result.name = file.replace(".md", "");
        result.summary = content.substring(0, 500).split("\n\n")[0];
        result.details = content;
        break;
      }
    }
  } catch (error) {
    console.error("Error searching orgs:", error);
  }

  return result;
}

/**
 * Execute a parsed command and return response
 * @param parsed - The parsed command result
 * @param slackClient - Optional Slack WebClient for sending messages
 */
export async function executeCommand(
  parsed: ParseResult, 
  slackClient?: any
): Promise<string> {
  switch (parsed.intent) {
    case "lookup_person": {
      if (!parsed.entities.person) {
        return "🤔 Who would you like me to look up?";
      }
      
      const result = searchPerson(parsed.entities.person);
      
      if (result.found) {
        let response = `📋 *${result.name}*\n\n`;
        if (result.email) {
          response += `📧 ${result.email}\n\n`;
        }
        if (result.summary) {
          response += result.summary;
        }
        return response;
      }
      
      return `🤷 I couldn't find anyone named "${parsed.entities.person}" in Switchboard.`;
    }

    case "lookup_org": {
      if (!parsed.entities.org) {
        return "🤔 Which organization would you like me to look up?";
      }
      
      const result = searchOrg(parsed.entities.org);
      
      if (result.found) {
        let response = `🏢 *${result.name}*\n\n`;
        if (result.summary) {
          response += result.summary;
        }
        return response;
      }
      
      return `🤷 I couldn't find an organization matching "${parsed.entities.org}".`;
    }

    case "lookup_calendar": {
      const when = parsed.entities.date || "today";
      const result = callBridge("calendar", "list", when);
      
      if (result.success && result.data?.events) {
        const events = result.data.events;
        if (events.length === 0) {
          return `📅 No events ${when}.`;
        }
        
        let response = `📅 *Calendar for ${when}* (${events.length} events):\n\n`;
        
        for (const event of events.slice(0, 10)) {
          let time = "All day";
          if (!event.all_day && event.start) {
            // Parse and display in JST
            const d = new Date(event.start);
            time = d.toLocaleTimeString("en-US", { 
              hour: "numeric", 
              minute: "2-digit",
              timeZone: "Asia/Tokyo"
            });
          }
          response += `• *${time}* — ${event.summary}`;
          if (event.location) response += ` 📍 ${event.location.substring(0, 30)}`;
          response += "\n";
        }
        
        if (events.length > 10) {
          response += `\n_...and ${events.length - 10} more_`;
        }
        
        return response;
      }
      
      return `❌ Could not fetch calendar: ${result.error || "Unknown error"}`;
    }

    case "lookup_email": {
      let query = "";
      if (parsed.entities.person) query += `from:${parsed.entities.person} `;
      if (parsed.entities.topic) query += parsed.entities.topic;
      query = query.trim() || "newer_than:7d";
      
      const result = callBridge("gmail", "search", query, "10");
      
      if (result.success && result.data?.messages) {
        const messages = result.data.messages;
        if (messages.length === 0) {
          return `📧 No emails found for: ${query}`;
        }
        
        let response = `📧 *Emails matching "${query}"* (${messages.length} found):\n\n`;
        
        for (const msg of messages.slice(0, 5)) {
          const date = msg.date ? new Date(msg.date).toLocaleDateString() : "";
          const sender = msg.sender?.split("<")[0]?.trim() || msg.sender || "Unknown";
          response += `• *${msg.subject || "(no subject)"}*\n`;
          response += `  From: ${sender} • ${date}\n`;
        }
        
        if (messages.length > 5) {
          response += `\n_...and ${messages.length - 5} more_`;
        }
        
        return response;
      }
      
      return `❌ Could not search emails: ${result.error || "Unknown error"}`;
    }

    case "lookup_reminder": {
      const result = callBridge("reminders", "list", "Jibot");
      
      if (result.success && result.data?.reminders) {
        const reminders = result.data.reminders.filter((r: any) => !r.completed);
        if (reminders.length === 0) {
          return "📥 Your inbox is empty!";
        }
        
        let response = `📥 *Inbox* (${reminders.length} items):\n\n`;
        
        for (const r of reminders.slice(0, 10)) {
          response += `• ${r.title}`;
          if (r.notes) response += ` — _${r.notes.substring(0, 50)}_`;
          response += "\n";
        }
        
        return response;
      }
      
      return `❌ Could not fetch reminders: ${result.error || "Unknown error"}`;
    }

    case "action_remind":
      if (parsed.entities.message) {
        return `📝 To add a reminder, say: \`remind joi to ${parsed.entities.message}\``;
      }
      return "📝 What would you like me to remind you about?";

    case "action_calendar": {
      // Use quick_add for natural language event creation
      const eventText = parsed.entities.message || parsed.raw;
      const result = callBridge("calendar", "quick", eventText);
      
      if (result.success && result.data) {
        const event = result.data;
        const time = event.start ? new Date(event.start).toLocaleString() : "";
        return `✅ Created: *${event.summary}*\n📅 ${time}`;
      }
      
      return `❌ Could not create event: ${result.error || "Unknown error"}`;
    }

    case "action_note":
      return "📝 Note creation coming soon! For now, notes go to Apple Reminders.";

    case "notify_slack": {
      if (!slackClient) {
        return "💬 Slack notifications require the bot to be running.";
      }
      
      if (!parsed.entities.slackUser) {
        return "💬 Who would you like me to message? Use @username or <@USERID>.";
      }
      
      if (!parsed.entities.message) {
        return "💬 What message should I send?";
      }
      
      try {
        // If it's a user ID (from <@U123>), use it directly
        // Otherwise try to find by name (not implemented yet)
        const userId = parsed.entities.slackUser;
        
        // Open a DM channel with the user
        const dmResult = await slackClient.conversations.open({ users: userId });
        if (!dmResult.ok || !dmResult.channel?.id) {
          return `❌ Could not open DM with user ${userId}`;
        }
        
        // Send the message
        await slackClient.chat.postMessage({
          channel: dmResult.channel.id,
          text: parsed.entities.message
        });
        
        return `✅ Sent DM to <@${userId}>: "${parsed.entities.message}"`;
      } catch (error: any) {
        return `❌ Failed to send message: ${error.message}`;
      }
    }

    case "notify_email":
      // Email sending requires more careful handling - keep as future feature
      return "📧 Email sending requires confirmation. Use `/jibot email` for now.";

    case "lookup_general":
      if (parsed.entities.topic) {
        // Try as person first, then org
        const personResult = searchPerson(parsed.entities.topic);
        if (personResult.found) {
          let response = `📋 *${personResult.name}*\n\n`;
          if (personResult.email) response += `📧 ${personResult.email}\n\n`;
          if (personResult.summary) response += personResult.summary;
          return response;
        }
        
        const orgResult = searchOrg(parsed.entities.topic);
        if (orgResult.found) {
          let response = `🏢 *${orgResult.name}*\n\n`;
          if (orgResult.summary) response += orgResult.summary;
          return response;
        }
      }
      return `🤔 I'm not sure what you're asking. Try:\n• "who is [name]?"\n• "what's on my calendar?"\n• "remind me to [task]"`;

    default:
      return `🤔 I'm not sure what you're asking. Try:\n• "who is [name]?"\n• "what's [name]'s email?"\n• "remind me to [task]"\n\nOr use \`/jibot help\` for all commands.`;
  }
}

/**
 * Check if this is a DM channel (starts with D)
 */
export function isDMChannel(channelId: string): boolean {
  return channelId.startsWith("D");
}
