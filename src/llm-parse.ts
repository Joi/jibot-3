/**
 * Jibot LLM Parse Engine - Phase 3
 * 
 * Uses Claude API for intelligent natural language understanding.
 * Handles complex queries, multi-step tasks, and context awareness.
 */

import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";

// Lazy client initialization (dotenv must load first)
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic();
  }
  return _client;
}

// Available tools/skills for the LLM to use
const AVAILABLE_TOOLS = `
Available skills you can invoke:

1. PERSON_LOOKUP - Search ~/switchboard/people/ for person info
   - Returns: name, email, bio, notes
   - Example: { "skill": "person_lookup", "query": "alice chen" }

2. ORG_LOOKUP - Search ~/switchboard/organizations/ for org info
   - Returns: name, description
   - Example: { "skill": "org_lookup", "query": "MIT Media Lab" }

3. CALENDAR_LIST - List calendar events
   - Params: period (today, tomorrow, this week, next week)
   - Example: { "skill": "calendar_list", "period": "today" }

4. CALENDAR_CREATE - Create a calendar event (use natural language)
   - Params: description (e.g., "lunch with bob tomorrow at noon")
   - Example: { "skill": "calendar_create", "description": "meeting with alice friday 3pm" }

5. EMAIL_SEARCH - Search Gmail
   - Params: query (Gmail search syntax)
   - Example: { "skill": "email_search", "query": "from:alice subject:tokyo" }

6. INBOX_LIST - List reminders/inbox items
   - Example: { "skill": "inbox_list" }

7. SLACK_DM - Send a Slack DM to a user
   - Params: user_id, message
   - Example: { "skill": "slack_dm", "user_id": "U02H1QEQSH3", "message": "meeting confirmed" }

8. WEATHER - Get current weather for a location
   - Params: location (default: Tokyo)
   - Example: { "skill": "weather", "location": "Tokyo" }

9. WEB_SEARCH - Search the web for information
   - Params: query
   - Example: { "skill": "web_search", "query": "OpenAI latest news" }

10. WEB_FETCH - Fetch and summarize content from a URL
   - Params: url
   - Example: { "skill": "web_fetch", "url": "https://example.com/article" }

11. EMAIL_COMPOSE - Draft an email (requires confirmation before sending)
    - Params: to, subject, body
    - Example: { "skill": "email_compose", "to": "alice@example.com", "subject": "Meeting follow-up", "body": "Thanks for..." }

12. REMINDER_ADD - Add a reminder to inbox
    - Params: title, notes (optional)
    - Example: { "skill": "reminder_add", "title": "Call Bob", "notes": "about the project" }

13. DIRECT_RESPONSE - Just respond with text (no skill needed)
    - Example: { "skill": "direct_response", "message": "I can help with..." }
`;

const SYSTEM_PROMPT = `You are Jibot, Joi Ito's personal assistant bot running in Slack.
You help with lookups, calendar management, email search, and messaging.

When the owner DMs you, analyze their request and decide which skill(s) to invoke.
Always respond with valid JSON in this format:

{
  "understanding": "Brief description of what the user wants",
  "skills": [
    { "skill": "skill_name", ...params },
    ...
  ],
  "fallback_response": "Response if skills fail or aren't needed"
}

${AVAILABLE_TOOLS}

Rules:
1. For greetings or "what can you do", use direct_response
2. For person/org lookups, extract the name and use appropriate lookup
3. For calendar queries, determine the time period
4. For multi-step requests, list skills in order
5. If unsure, use direct_response with a helpful message
6. Keep responses concise and useful
7. Current timezone: Asia/Tokyo (JST)
`;

export interface LLMParseResult {
  understanding: string;
  skills: Array<{
    skill: string;
    [key: string]: any;
  }>;
  fallback_response: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

// Simple in-memory conversation history (per user)
const conversationHistory: Map<string, ConversationMessage[]> = new Map();
const MAX_HISTORY = 10;

/**
 * Parse user input using Claude
 */
export async function llmParse(
  userInput: string,
  userId: string
): Promise<LLMParseResult> {
  // Get or create conversation history for this user
  let history = conversationHistory.get(userId) || [];
  
  // Add user message to history
  history.push({ role: "user", content: userInput });
  
  // Keep only recent history
  if (history.length > MAX_HISTORY) {
    history = history.slice(-MAX_HISTORY);
  }
  
  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: history.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // Parse the JSON response
    const text = content.text.trim();
    
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    
    const result = JSON.parse(jsonMatch[0]) as LLMParseResult;
    
    // Add assistant response to history
    history.push({ role: "assistant", content: text });
    conversationHistory.set(userId, history);
    
    return result;
  } catch (error: any) {
    console.error("LLM parse error:", error.message);
    
    // Return a safe fallback
    return {
      understanding: "Failed to parse request",
      skills: [],
      fallback_response: `I had trouble understanding that. Try:\n• "who is [name]?"\n• "what's on my calendar today?"\n• "emails from [person]"\n• "remind me to [task]"`
    };
  }
}

/**
 * Execute a skill from the LLM parse result
 */
export async function executeSkill(
  skill: { skill: string; [key: string]: any },
  slackClient?: any
): Promise<string> {
  const BRIDGE_PATH = process.env.HOME + "/jibot-3/scripts/amplifier_bridge.py";
  
  const callBridge = (skillName: string, action: string, ...args: string[]): any => {
    try {
      const escapedArgs = args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(" ");
      const cmd = `${BRIDGE_PATH} ${skillName} ${action} ${escapedArgs}`;
      const result = execSync(cmd, { 
        encoding: "utf-8",
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024
      });
      return JSON.parse(result.trim());
    } catch (error: any) {
      if (error.stdout) {
        try { return JSON.parse(error.stdout.trim()); } catch {}
      }
      return { success: false, error: error.message };
    }
  };

  switch (skill.skill) {
    case "direct_response":
      return skill.message || "How can I help?";

    case "person_lookup": {
      // Use the existing searchPerson function via bridge or inline
      const { searchPerson } = await import("./parse.js");
      const result = searchPerson(skill.query);
      
      if (result.found) {
        let response = `📋 *${result.name}*\n\n`;
        if (result.email) response += `📧 ${result.email}\n\n`;
        if (result.summary) response += result.summary;
        return response;
      }
      return `🤷 Couldn't find "${skill.query}" in Switchboard.`;
    }

    case "org_lookup": {
      const { searchOrg } = await import("./parse.js");
      const result = searchOrg(skill.query);
      
      if (result.found) {
        let response = `🏢 *${result.name}*\n\n`;
        if (result.summary) response += result.summary;
        return response;
      }
      return `🤷 Couldn't find org "${skill.query}".`;
    }

    case "calendar_list": {
      const period = skill.period || "today";
      const result = callBridge("calendar", "list", period);
      
      if (result.success && result.data?.events) {
        const events = result.data.events;
        if (events.length === 0) {
          return `📅 No events ${period}.`;
        }
        
        let response = `📅 *Calendar for ${period}* (${events.length} events):\n\n`;
        
        for (const event of events.slice(0, 10)) {
          let time = "All day";
          if (!event.all_day && event.start) {
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

    case "calendar_create": {
      const result = callBridge("calendar", "quick", skill.description);
      
      if (result.success && result.data) {
        const event = result.data;
        const time = event.start ? new Date(event.start).toLocaleString("en-US", { timeZone: "Asia/Tokyo" }) : "";
        return `✅ Created: *${event.summary}*\n📅 ${time}`;
      }
      
      return `❌ Could not create event: ${result.error || "Unknown error"}`;
    }

    case "email_search": {
      const result = callBridge("gmail", "search", skill.query, "10");
      
      if (result.success && result.data?.messages) {
        const messages = result.data.messages;
        if (messages.length === 0) {
          return `📧 No emails found for: ${skill.query}`;
        }
        
        let response = `📧 *Emails matching "${skill.query}"* (${messages.length} found):\n\n`;
        
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

    case "inbox_list": {
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
      
      return `❌ Could not fetch inbox: ${result.error || "Unknown error"}`;
    }

    case "slack_dm": {
      if (!slackClient) {
        return "💬 Slack DM requires the bot to be running.";
      }
      
      try {
        const dmResult = await slackClient.conversations.open({ users: skill.user_id });
        if (!dmResult.ok || !dmResult.channel?.id) {
          return `❌ Could not open DM with user ${skill.user_id}`;
        }
        
        await slackClient.chat.postMessage({
          channel: dmResult.channel.id,
          text: skill.message
        });
        
        return `✅ Sent DM to <@${skill.user_id}>: "${skill.message}"`;
      } catch (error: any) {
        return `❌ Failed to send message: ${error.message}`;
      }
    }

    case "weather": {
      const location = skill.location || "Tokyo";
      const result = callBridge("weather", "get", location);
      
      if (result.success && result.data) {
        return result.data.detail;
      }
      
      return `❌ Could not get weather: ${result.error || "Unknown error"}`;
    }

    case "web_search": {
      const result = callBridge("web", "search", skill.query, "5");
      
      if (result.success && result.data?.results) {
        const results = result.data.results;
        if (results.length === 0) {
          return `🔍 No results found for: ${skill.query}`;
        }
        
        let response = `🔍 *Web search: "${skill.query}"*\n\n`;
        
        for (const r of results.slice(0, 5)) {
          response += `• *${r.title}*\n`;
          if (r.snippet) response += `  ${r.snippet.substring(0, 150)}\n`;
        }
        
        return response;
      }
      
      return `❌ Web search failed: ${result.error || "Unknown error"}`;
    }

    case "web_fetch": {
      const result = callBridge("web", "fetch", skill.url, "5000");
      
      if (result.success && result.data?.content) {
        const content = result.data.content;
        // Summarize long content
        const preview = content.length > 1000 
          ? content.substring(0, 1000) + "..."
          : content;
        
        return `📄 *Content from ${skill.url}*\n\n${preview}`;
      }
      
      return `❌ Could not fetch URL: ${result.error || "Unknown error"}`;
    }

    case "email_compose": {
      // Store draft for confirmation (in memory for now)
      const draft = `📧 *Draft Email*\n\n*To:* ${skill.to}\n*Subject:* ${skill.subject}\n\n${skill.body}\n\n_Reply "send" to send, or "cancel" to discard._`;
      
      // TODO: Store pending draft for this user
      return draft;
    }

    case "reminder_add": {
      const result = callBridge("reminders", "add", skill.title, "Jibot", skill.notes || "");
      
      if (result.success) {
        return `✅ Added to inbox: *${skill.title}*`;
      }
      
      return `❌ Could not add reminder: ${result.error || "Unknown error"}`;
    }

    default:
      return `⚠️ Unknown skill: ${skill.skill}`;
  }
}

/**
 * Synthesize a natural language response from skill results
 */
async function synthesizeResponse(
  userInput: string,
  skillResults: string[],
  understanding: string
): Promise<string> {
  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: `You are Jibot, a helpful assistant. Given the user's question and the data gathered, provide a concise, natural language response. Be direct and helpful. Don't mention that you searched or looked things up - just answer naturally. Current timezone: Asia/Tokyo (JST).`,
      messages: [{
        role: "user",
        content: `User asked: "${userInput}"

Data gathered:
${skillResults.join("\n\n")}

Provide a helpful, natural response:`
      }]
    });

    const content = response.content[0];
    if (content.type === "text") {
      return content.text;
    }
  } catch (error: any) {
    console.error("Synthesis error:", error.message);
  }
  
  // Fallback to raw results
  return skillResults.join("\n\n");
}

/**
 * Process user input through LLM and execute skills
 */
export async function processWithLLM(
  userInput: string,
  userId: string,
  slackClient?: any
): Promise<string> {
  console.log(`🧠 LLM processing: "${userInput.substring(0, 50)}..."`);
  
  const parsed = await llmParse(userInput, userId);
  console.log(`🧠 Understanding: ${parsed.understanding}`);
  console.log(`🧠 Skills: ${parsed.skills.map(s => s.skill).join(", ") || "none"}`);
  
  if (parsed.skills.length === 0) {
    return parsed.fallback_response;
  }
  
  // Execute skills in sequence
  const results: string[] = [];
  
  for (const skill of parsed.skills) {
    const result = await executeSkill(skill, slackClient);
    results.push(result);
  }
  
  // Synthesize natural language response
  const naturalResponse = await synthesizeResponse(userInput, results, parsed.understanding);
  return naturalResponse;
}

/**
 * Clear conversation history for a user
 */
export function clearHistory(userId: string): void {
  conversationHistory.delete(userId);
}
