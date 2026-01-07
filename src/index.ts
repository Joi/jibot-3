/**
 * Jibot 3 - A friendly Slack bot that learns about people
 * 
 * Descendant of:
 * - https://github.com/imajes/jibot
 * - https://joi.ito.com/weblog/2004/04/23/jibot-06.html
 * 
 * Commands:
 * - "jibot @user is X" - Learn a fact about someone
 * - "jibot who is @user" or "who is @user?" - Recall facts about someone
 * - "jibot forget @user [number|all]" - Forget facts
 * - "jibot help" - Show help
 * 
 * Features:
 * - Heralds people when they join a channel
 */

import { config } from "dotenv";
config();

import { App, LogLevel } from "@slack/bolt";
import {
  addFact,
  getFacts,
  getDisplayName,
  formatFactsSentence,
  removeFact,
  removeAllFacts,
  getPerson,
} from "./people.js";

// Initialize the Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  logLevel: LogLevel.DEBUG,
});

// ============================================================================
// Command Parsers
// ============================================================================

/**
 * Parse "jibot @user is X" pattern
 */
function parseLearnCommand(text: string): { userId: string; fact: string } | null {
  // Pattern: jibot <@U123ABC> is blah blah
  const match = text.match(/^jibot\s+<@([A-Z0-9]+)>\s+is\s+(.+)$/i);
  if (match) {
    return {
      userId: match[1],
      fact: match[2].trim(),
    };
  }
  return null;
}

/**
 * Parse "who is @user" pattern
 */
function parseWhoIsCommand(text: string): string | null {
  // Pattern: jibot who is <@U123ABC> OR who is <@U123ABC>?
  const match = text.match(/(?:jibot\s+)?who\s+is\s+<@([A-Z0-9]+)>\??/i);
  if (match) {
    return match[1];
  }
  return null;
}

/**
 * Parse "jibot forget @user [number|all]" pattern
 */
function parseForgetCommand(text: string): { userId: string; index: number | null } | null {
  const match = text.match(/^jibot\s+forget\s+<@([A-Z0-9]+)>(?:\s+(.+))?$/i);
  if (match) {
    const userId = match[1];
    const arg = match[2]?.trim().toLowerCase();

    if (!arg) {
      return { userId, index: null }; // Show list
    }

    if (arg === "all" || arg === "everything") {
      return { userId, index: -1 }; // Forget all
    }

    const num = parseInt(arg);
    if (!isNaN(num) && num >= 1) {
      return { userId, index: num - 1 }; // Convert to 0-based
    }

    return { userId, index: null }; // Invalid, show list
  }
  return null;
}

/**
 * Check if text is a help command
 */
function isHelpCommand(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return lower === "jibot" || lower === "jibot help" || lower === "jibot?";
}

// ============================================================================
// Message Handlers
// ============================================================================

/**
 * Format help message
 */
function formatHelp(): string {
  return `🤖 *Jibot 3* - I learn about people!

*Commands:*
• \`jibot @user is [fact]\` - Teach me about someone
• \`who is @user?\` - Ask what I know
• \`jibot forget @user\` - List facts to forget
• \`jibot forget @user [number]\` - Forget specific fact
• \`jibot forget @user all\` - Forget everything

*Example:*
> jibot @alice is a tea ceremony teacher
> who is @alice?
_"Alice is a tea ceremony teacher"_

I also greet people when they join! 👋`;
}

/**
 * Handle learning a fact
 */
async function handleLearn(
  userId: string,
  fact: string,
  addedBy: string,
  client: any
): Promise<string> {
  // Try to get the user's display name
  let displayName: string | undefined;
  let slackName: string | undefined;
  
  try {
    const userInfo = await client.users.info({ user: userId });
    displayName = userInfo.user?.profile?.display_name || userInfo.user?.real_name;
    slackName = userInfo.user?.name;
  } catch (e) {
    // Ignore - we'll just use the ID
  }

  addFact(userId, fact, addedBy, displayName, slackName);
  
  return `📝 Got it! I learned that <@${userId}> is ${fact}`;
}

/**
 * Handle "who is" query
 */
function handleWhoIs(userId: string): string {
  const facts = getFacts(userId);
  
  if (facts.length === 0) {
    return `🤷 I don't know anything about <@${userId}> yet. Tell me something!\nSay: \`jibot <@${userId}> is ...\``;
  }

  const factsSentence = formatFactsSentence(facts);
  const name = getDisplayName(userId);
  
  if (name) {
    return `🤖 ${name} (<@${userId}>) is ${factsSentence}.`;
  }
  return `🤖 <@${userId}> is ${factsSentence}.`;
}

/**
 * Handle forget command
 */
function handleForget(userId: string, index: number | null): string {
  const facts = getFacts(userId);

  // Show list if no index specified
  if (index === null) {
    if (facts.length === 0) {
      return `🤷 I don't know anything about <@${userId}> to forget.`;
    }

    const factsList = facts.map((f, i) => `${i + 1}. ${f.fact}`).join("\n");
    return `🤖 Here's what I know about <@${userId}>:\n${factsList}\n\n_Say \`jibot forget <@${userId}> [number]\` or \`jibot forget <@${userId}> all\`_`;
  }

  // Forget all
  if (index === -1) {
    const count = removeAllFacts(userId);
    if (count === 0) {
      return `🤷 I don't know anything about <@${userId}> to forget.`;
    }
    return `🗑️ I've forgotten everything about <@${userId}> (${count} fact${count === 1 ? "" : "s"}).`;
  }

  // Forget specific fact
  if (index < 0 || index >= facts.length) {
    return `🤷 I don't have a fact #${index + 1} about <@${userId}>. I only know ${facts.length} thing${facts.length === 1 ? "" : "s"}.`;
  }

  const factToRemove = facts[index].fact;
  removeFact(userId, index);

  return `🗑️ I've forgotten that <@${userId}> is ${factToRemove}.`;
}

// ============================================================================
// Slack Event Handlers
// ============================================================================

// Handle messages in channels where bot is present
app.message(async ({ message, say, client }) => {
  // Ignore bot messages and message subtypes
  if ((message as any).subtype || (message as any).bot_id) return;

  const text = (message as any).text || "";
  const senderId = (message as any).user;

  // Help command
  if (isHelpCommand(text)) {
    await say(formatHelp());
    return;
  }

  // Learn command: "jibot @user is X"
  const learnCmd = parseLearnCommand(text);
  if (learnCmd) {
    const response = await handleLearn(learnCmd.userId, learnCmd.fact, senderId, client);
    await say(response);
    return;
  }

  // Who is command
  const whoIsUserId = parseWhoIsCommand(text);
  if (whoIsUserId) {
    const response = handleWhoIs(whoIsUserId);
    await say(response);
    return;
  }

  // Forget command
  const forgetCmd = parseForgetCommand(text);
  if (forgetCmd) {
    const response = handleForget(forgetCmd.userId, forgetCmd.index);
    await say(response);
    return;
  }
});

// Handle app mentions (when someone @mentions jibot)
app.event("app_mention", async ({ event, say, client }) => {
  const text = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();
  const senderId = event.user;

  // Help if empty or help command
  if (!text || text.toLowerCase() === "help") {
    await say({ text: formatHelp(), thread_ts: event.ts });
    return;
  }

  // Learn command (reparsed without "jibot" prefix since it's an @mention)
  const learnMatch = text.match(/^<@([A-Z0-9]+)>\s+is\s+(.+)$/i);
  if (learnMatch) {
    const response = await handleLearn(learnMatch[1], learnMatch[2].trim(), senderId, client);
    await say({ text: response, thread_ts: event.ts });
    return;
  }

  // Who is command
  const whoIsMatch = text.match(/who\s+is\s+<@([A-Z0-9]+)>\??/i);
  if (whoIsMatch) {
    const response = handleWhoIs(whoIsMatch[1]);
    await say({ text: response, thread_ts: event.ts });
    return;
  }

  // Forget command
  const forgetMatch = text.match(/^forget\s+<@([A-Z0-9]+)>(?:\s+(.+))?$/i);
  if (forgetMatch) {
    const userId = forgetMatch[1];
    const arg = forgetMatch[2]?.trim().toLowerCase();
    let index: number | null = null;
    
    if (arg === "all" || arg === "everything") {
      index = -1;
    } else if (arg) {
      const num = parseInt(arg);
      if (!isNaN(num) && num >= 1) {
        index = num - 1;
      }
    }
    
    const response = handleForget(userId, index);
    await say({ text: response, thread_ts: event.ts });
    return;
  }

  // Unknown command
  await say({ 
    text: `🤖 I'm not sure what you mean. Try \`@jibot help\` for commands!`,
    thread_ts: event.ts 
  });
});

// Herald people when they join a channel
app.event("member_joined_channel", async ({ event, client }) => {
  const userId = event.user;
  const channelId = event.channel;

  // Get what we know about this person
  const facts = getFacts(userId);
  const person = getPerson(userId);
  
  // Build the herald message
  let greeting: string;
  
  if (facts.length > 0) {
    const factsSentence = formatFactsSentence(facts);
    const name = person?.displayName || person?.slackName;
    
    if (name) {
      greeting = `👋 Welcome ${name}! (${factsSentence})`;
    } else {
      greeting = `👋 Welcome <@${userId}>! (${factsSentence})`;
    }
  } else {
    // We don't know anything about them yet
    greeting = `👋 Welcome <@${userId}>!`;
  }

  try {
    await client.chat.postMessage({
      channel: channelId,
      text: greeting,
    });
    console.log(`👋 Heralded <@${userId}> in channel ${channelId}`);
  } catch (error) {
    console.error("Error posting herald message:", error);
  }
});

// ============================================================================
// Start the App
// ============================================================================

(async () => {
  const port = process.env.PORT || 3000;
  await app.start(port);
  console.log(`🤖 Jibot 3 is running on port ${port}`);
  console.log("   Data stored in: ~/switchboard/jibot/people.json");
  console.log("\nCommands:");
  console.log("   jibot @user is [fact] - Learn about someone");
  console.log("   who is @user?         - Recall facts");
  console.log("   jibot forget @user    - Forget facts");
  console.log("   jibot help            - Show help");
})();
