/**
 * Jibot 3 - A friendly Slack bot that learns about people
 * 
 * Descendant of:
 * - https://github.com/imajes/jibot
 * - https://joi.ito.com/weblog/2004/04/23/jibot-06.html
 * 
 * Features:
 * - Learn facts about people: "jibot @user is X"
 * - Recall facts: "who is @user?"
 * - Forget facts: "jibot forget @user"
 * - Herald on channel join
 * - Reminder inbox: "remind joi to X"
 * - Concept explainer: "explain DAOs"
 * - Organization lookup: "what is Digital Garage"
 * - Multi-tier permissions: owner/admin/guest
 * - Slash commands: /jibot
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
import {
  getTier,
  hasPermission,
  setOwner,
  promoteToAdmin,
  demoteAdmin,
  linkOwner,
  linkAdmin,
  listAdmins,
  getOwner,
  isOwnerConfigured,
  type Tier,
} from "./auth.js";
import {
  addReminder,
  getReminders,
  getReminderCount,
  clearReminderByIndex,
  clearAllReminders,
  formatInbox,
} from "./inbox.js";
import {
  lookupConcept,
  lookupOrganization,
  searchSwitchboard,
} from "./switchboard.js";

// Initialize the Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  logLevel: LogLevel.INFO,
});

// ============================================================================
// Command Parsers
// ============================================================================

/**
 * Parse "jibot @user is X" pattern
 */
function parseLearnCommand(text: string): { userId: string; fact: string } | null {
  const match = text.match(/^jibot\s+<@([A-Z0-9]+)>\s+is\s+(.+)$/i);
  if (match) {
    return { userId: match[1], fact: match[2].trim() };
  }
  return null;
}

/**
 * Parse "who is @user" pattern
 */
function parseWhoIsCommand(text: string): string | null {
  const match = text.match(/(?:jibot\s+)?who\s+is\s+<@([A-Z0-9]+)>\??/i);
  if (match) return match[1];
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
    if (!arg) return { userId, index: null };
    if (arg === "all" || arg === "everything") return { userId, index: -1 };
    const num = parseInt(arg);
    if (!isNaN(num) && num >= 1) return { userId, index: num - 1 };
    return { userId, index: null };
  }
  return null;
}

/**
 * Parse "remind joi to X" or "remind @user to X" pattern
 */
function parseRemindCommand(text: string): { message: string } | null {
  // Match: remind joi to X, remind @joi to X, remind <@U123> to X
  const match = text.match(/^remind\s+(?:joi|@joi|<@[A-Z0-9]+>)\s+to\s+(.+)$/i);
  if (match) {
    return { message: match[1].trim() };
  }
  return null;
}

/**
 * Parse "explain X" or "what is X" pattern
 */
function parseExplainCommand(text: string): { query: string; type: "concept" | "org" | "search" } | null {
  // "explain X" -> concept
  let match = text.match(/^(?:jibot\s+)?explain\s+(.+)$/i);
  if (match) {
    return { query: match[1].trim(), type: "concept" };
  }
  
  // "what is X" -> org first, then concept
  match = text.match(/^(?:jibot\s+)?what\s+is\s+(.+)\??$/i);
  if (match) {
    return { query: match[1].trim(), type: "org" };
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
 * Format help message based on user tier
 */
function formatHelp(tier: Tier): string {
  const sections: string[] = [];

  // Header
  sections.push(`🤖 *Jibot 3* - Community memory & knowledge bot
_Descendant of the original Jibot IRC bot (2004)_`);

  // Community Memory section - everyone
  sections.push(`*📝 Community Memory*
Learn and recall facts about people in the community.

• \`jibot @user is [fact]\` - Teach me something about someone
• \`who is @user?\` - Ask what I know about someone
• \`jibot forget @user\` - List all facts about someone
• \`jibot forget @user [n]\` - Forget a specific fact (#1, #2, etc.)
• \`jibot forget @user all\` - Forget everything about someone

_Example:_
> jibot @alice is a tea ceremony teacher from Kyoto
> who is @alice?
> → "Alice is a tea ceremony teacher from Kyoto"`);

  // Reminder Inbox section - everyone
  sections.push(`*📥 Reminder Inbox*
Send reminders directly to Joi's Apple Reminders.

• \`remind joi to [message]\` - Add a reminder to Joi's inbox

_Example:_
> remind joi to review the grant proposal
> → Added to Joi's "Jibot" reminders list`);

  // Knowledge Lookup section - everyone
  sections.push(`*💡 Knowledge Lookup*
Look up concepts and organizations from the knowledge base.

• \`explain [concept]\` - Look up a concept (DAOs, Web3, Neurodiversity, etc.)
• \`what is [organization]\` - Look up an organization (Digital Garage, METI, etc.)

_Example:_
> explain probabilistic computing
> what is Henkaku Center`);

  // Herald feature - everyone
  sections.push(`*👋 Channel Heralds*
When someone joins a channel, I greet them with what I know about them.
This helps the community remember who people are.`);

  // Admin section
  if (tier === "admin" || tier === "owner") {
    sections.push(`*🛡️ Admin Commands*
You have admin access to view operational information.

• \`/jibot inbox\` - View the reminder queue
• \`/jibot admins\` - List all admins and owner`);
  }

  // Owner section
  if (tier === "owner") {
    sections.push(`*👑 Owner Commands*
You have full control over Jibot.

*Inbox Management:*
• \`/jibot inbox clear [n]\` - Complete/clear reminder #n
• \`/jibot inbox clear all\` - Clear all reminders

*Permission Management:*
• \`/jibot admin @user\` - Promote user to admin
• \`/jibot demote @user\` - Demote admin to guest

*Cross-Workspace Identity:*
• \`/jibot link @user [UID]\` - Link another Slack UID to an admin's identity
  _(Use when same person has different IDs in different workspaces)_`);
  }

  // Slash command note
  sections.push(`*⚡ Slash Commands*
Use \`/jibot [command]\` for quick access:
• \`/jibot help\` - Show this help
• \`/jibot explain [concept]\` - Quick concept lookup
• \`/jibot whatis [org]\` - Quick org lookup
• \`/jibot remind [message]\` - Quick reminder`);

  // Footer with tier indicator
  const tierLabel = tier === "owner" ? "👑 Owner" : tier === "admin" ? "🛡️ Admin" : "👤 Guest";
  sections.push(`_Your access level: ${tierLabel}_`);

  return sections.join("\n\n───────────────────────────\n\n");
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
  let displayName: string | undefined;
  let slackName: string | undefined;
  
  try {
    const userInfo = await client.users.info({ user: userId });
    displayName = userInfo.user?.profile?.display_name || userInfo.user?.real_name;
    slackName = userInfo.user?.name;
  } catch (e) {
    // Ignore
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

  if (index === null) {
    if (facts.length === 0) {
      return `🤷 I don't know anything about <@${userId}> to forget.`;
    }
    const factsList = facts.map((f, i) => `${i + 1}. ${f.fact}`).join("\n");
    return `🤖 Here's what I know about <@${userId}>:\n${factsList}\n\n_Say \`jibot forget <@${userId}> [number]\` or \`jibot forget <@${userId}> all\`_`;
  }

  if (index === -1) {
    const count = removeAllFacts(userId);
    if (count === 0) {
      return `🤷 I don't know anything about <@${userId}> to forget.`;
    }
    return `🗑️ I've forgotten everything about <@${userId}> (${count} fact${count === 1 ? "" : "s"}).`;
  }

  if (index < 0 || index >= facts.length) {
    return `🤷 I don't have a fact #${index + 1} about <@${userId}>. I only know ${facts.length} thing${facts.length === 1 ? "" : "s"}.`;
  }

  const factToRemove = facts[index].fact;
  removeFact(userId, index);
  return `🗑️ I've forgotten that <@${userId}> is ${factToRemove}.`;
}

/**
 * Handle remind command
 */
async function handleRemind(
  message: string,
  fromUserId: string,
  workspace: string,
  channel: string,
  client: any
): Promise<string> {
  let displayName: string | undefined;
  
  try {
    const userInfo = await client.users.info({ user: fromUserId });
    displayName = userInfo.user?.profile?.display_name || userInfo.user?.real_name;
  } catch (e) {
    // Ignore
  }

  addReminder(message, fromUserId, workspace, channel, displayName);
  const count = getReminderCount();
  return `📥 Got it! I'll remind Joi to: *${message}*\n_Inbox now has ${count} reminder${count === 1 ? "" : "s"}_`;
}

/**
 * Handle explain/lookup command
 */
function handleExplain(query: string, type: "concept" | "org" | "search"): string {
  // Try org first if type is "org", then concept
  if (type === "org") {
    const org = lookupOrganization(query);
    if (org) {
      return `🏢 *${org.name}*\n\n${org.summary}`;
    }
    // Fall through to concept
    const concept = lookupConcept(query);
    if (concept) {
      return `💡 *${concept.name}*\n\n${concept.summary}`;
    }
  } else {
    // Try concept first
    const concept = lookupConcept(query);
    if (concept) {
      return `💡 *${concept.name}*\n\n${concept.summary}`;
    }
    // Fall through to org
    const org = lookupOrganization(query);
    if (org) {
      return `🏢 *${org.name}*\n\n${org.summary}`;
    }
  }

  // Search for suggestions
  const results = searchSwitchboard(query);
  if (results.concepts.length > 0 || results.organizations.length > 0) {
    let msg = `🤷 I don't have an exact match for "${query}", but here are some related topics:\n`;
    if (results.concepts.length > 0) {
      msg += `\n*Concepts:* ${results.concepts.slice(0, 5).join(", ")}`;
    }
    if (results.organizations.length > 0) {
      msg += `\n*Organizations:* ${results.organizations.slice(0, 5).join(", ")}`;
    }
    return msg;
  }

  return `🤷 I don't know about "${query}" yet. Try a different term?`;
}

// ============================================================================
// Slack Event Handlers
// ============================================================================

// Handle messages in channels
app.message(async ({ message, say, client }) => {
  if ((message as any).subtype || (message as any).bot_id) return;

  const text = (message as any).text || "";
  const senderId = (message as any).user;
  const channel = (message as any).channel;
  const team = (message as any).team || "unknown";

  // Help command
  if (isHelpCommand(text)) {
    const tier = getTier(senderId);
    await say(formatHelp(tier));
    return;
  }

  // Learn command
  const learnCmd = parseLearnCommand(text);
  if (learnCmd) {
    const response = await handleLearn(learnCmd.userId, learnCmd.fact, senderId, client);
    await say(response);
    return;
  }

  // Who is command
  const whoIsUserId = parseWhoIsCommand(text);
  if (whoIsUserId) {
    await say(handleWhoIs(whoIsUserId));
    return;
  }

  // Forget command
  const forgetCmd = parseForgetCommand(text);
  if (forgetCmd) {
    await say(handleForget(forgetCmd.userId, forgetCmd.index));
    return;
  }

  // Remind command
  const remindCmd = parseRemindCommand(text);
  if (remindCmd) {
    const response = await handleRemind(remindCmd.message, senderId, team, channel, client);
    await say(response);
    return;
  }

  // Explain/lookup command
  const explainCmd = parseExplainCommand(text);
  if (explainCmd) {
    await say(handleExplain(explainCmd.query, explainCmd.type));
    return;
  }
});

// Handle app mentions
app.event("app_mention", async ({ event, say, client }) => {
  const text = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();
  const senderId = event.user!;
  const channel = event.channel!;
  const team = (event as any).team || "unknown";

  if (!text || text.toLowerCase() === "help") {
    const tier = getTier(senderId);
    await say({ text: formatHelp(tier), thread_ts: event.ts });
    return;
  }

  // Learn command
  const learnMatch = text.match(/^<@([A-Z0-9]+)>\s+is\s+(.+)$/i);
  if (learnMatch) {
    const response = await handleLearn(learnMatch[1], learnMatch[2].trim(), senderId, client);
    await say({ text: response, thread_ts: event.ts });
    return;
  }

  // Who is
  const whoIsMatch = text.match(/who\s+is\s+<@([A-Z0-9]+)>\??/i);
  if (whoIsMatch) {
    await say({ text: handleWhoIs(whoIsMatch[1]), thread_ts: event.ts });
    return;
  }

  // Forget
  const forgetMatch = text.match(/^forget\s+<@([A-Z0-9]+)>(?:\s+(.+))?$/i);
  if (forgetMatch) {
    const userId = forgetMatch[1];
    const arg = forgetMatch[2]?.trim().toLowerCase();
    let index: number | null = null;
    if (arg === "all" || arg === "everything") index = -1;
    else if (arg) {
      const num = parseInt(arg);
      if (!isNaN(num) && num >= 1) index = num - 1;
    }
    await say({ text: handleForget(userId, index), thread_ts: event.ts });
    return;
  }

  // Remind
  const remindMatch = text.match(/^remind\s+(?:joi|me)\s+to\s+(.+)$/i);
  if (remindMatch) {
    const response = await handleRemind(remindMatch[1].trim(), senderId, team, channel, client);
    await say({ text: response, thread_ts: event.ts });
    return;
  }

  // Explain
  const explainMatch = text.match(/^explain\s+(.+)$/i);
  if (explainMatch) {
    await say({ text: handleExplain(explainMatch[1].trim(), "concept"), thread_ts: event.ts });
    return;
  }

  // What is
  const whatIsMatch = text.match(/^what\s+is\s+(.+)\??$/i);
  if (whatIsMatch) {
    await say({ text: handleExplain(whatIsMatch[1].trim(), "org"), thread_ts: event.ts });
    return;
  }

  await say({ 
    text: `🤖 I'm not sure what you mean. Try \`@jibot help\` for commands!`,
    thread_ts: event.ts 
  });
});

// Herald on channel join
app.event("member_joined_channel", async ({ event, client }) => {
  const userId = event.user;
  const channelId = event.channel;
  const facts = getFacts(userId);
  const person = getPerson(userId);
  
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
    greeting = `👋 Welcome <@${userId}>!`;
  }

  try {
    await client.chat.postMessage({ channel: channelId, text: greeting });
  } catch (error) {
    console.error("Error posting herald:", error);
  }
});

// ============================================================================
// Slash Command: /jibot
// ============================================================================

app.command("/jibot", async ({ command, ack, respond, client }) => {
  await ack();

  const userId = command.user_id;
  const text = command.text.trim();
  const tier = getTier(userId);
  const team = command.team_id;
  const channel = command.channel_id;

  // Parse subcommand
  const args = text.split(/\s+/);
  const subcommand = args[0]?.toLowerCase() || "help";

  // /jibot help
  if (subcommand === "help" || subcommand === "") {
    await respond({ text: formatHelp(tier), response_type: "ephemeral" });
    return;
  }

  // /jibot inbox - View inbox (admin+)
  if (subcommand === "inbox") {
    if (!hasPermission(userId, "admin")) {
      await respond({ text: "❌ You need admin permissions to view the inbox.", response_type: "ephemeral" });
      return;
    }

    const action = args[1]?.toLowerCase();

    // /jibot inbox clear [n|all] - Owner only
    if (action === "clear") {
      if (!hasPermission(userId, "owner")) {
        await respond({ text: "❌ Only the owner can clear the inbox.", response_type: "ephemeral" });
        return;
      }

      const target = args[2]?.toLowerCase();
      if (target === "all") {
        const count = clearAllReminders();
        await respond({ text: `✅ Cleared all ${count} reminders.`, response_type: "ephemeral" });
      } else if (target) {
        const num = parseInt(target);
        if (!isNaN(num) && num >= 1) {
          const cleared = clearReminderByIndex(num);
          if (cleared) {
            await respond({ text: `✅ Cleared reminder #${num}: "${cleared.title}"`, response_type: "ephemeral" });
          } else {
            await respond({ text: `❌ No reminder #${num} found.`, response_type: "ephemeral" });
          }
        } else {
          await respond({ text: "Usage: `/jibot inbox clear [number|all]`", response_type: "ephemeral" });
        }
      } else {
        await respond({ text: "Usage: `/jibot inbox clear [number|all]`", response_type: "ephemeral" });
      }
      return;
    }

    // Just show inbox
    const reminders = getReminders();
    await respond({ text: formatInbox(reminders), response_type: "ephemeral" });
    return;
  }

  // /jibot admin @user - Promote to admin (owner only)
  if (subcommand === "admin") {
    if (!hasPermission(userId, "owner")) {
      await respond({ text: "❌ Only the owner can promote admins.", response_type: "ephemeral" });
      return;
    }

    const userMatch = args[1]?.match(/<@([A-Z0-9]+)>/i);
    if (!userMatch) {
      await respond({ text: "Usage: `/jibot admin @user`", response_type: "ephemeral" });
      return;
    }

    const targetId = userMatch[1];
    let displayName: string | undefined;
    try {
      const userInfo = await client.users.info({ user: targetId });
      displayName = userInfo.user?.profile?.display_name || userInfo.user?.real_name;
    } catch (e) {}

    promoteToAdmin(targetId, displayName);
    await respond({ text: `✅ <@${targetId}> is now an admin.`, response_type: "ephemeral" });
    return;
  }

  // /jibot demote @user - Demote admin (owner only)
  if (subcommand === "demote") {
    if (!hasPermission(userId, "owner")) {
      await respond({ text: "❌ Only the owner can demote admins.", response_type: "ephemeral" });
      return;
    }

    const userMatch = args[1]?.match(/<@([A-Z0-9]+)>/i);
    if (!userMatch) {
      await respond({ text: "Usage: `/jibot demote @user`", response_type: "ephemeral" });
      return;
    }

    const success = demoteAdmin(userMatch[1]);
    if (success) {
      await respond({ text: `✅ <@${userMatch[1]}> is now a guest.`, response_type: "ephemeral" });
    } else {
      await respond({ text: `❌ <@${userMatch[1]}> is not an admin.`, response_type: "ephemeral" });
    }
    return;
  }

  // /jibot link @user UID - Link cross-workspace ID (owner only)
  if (subcommand === "link") {
    if (!hasPermission(userId, "owner")) {
      await respond({ text: "❌ Only the owner can link identities.", response_type: "ephemeral" });
      return;
    }

    const userMatch = args[1]?.match(/<@([A-Z0-9]+)>/i);
    const newUid = args[2];

    if (!userMatch || !newUid) {
      await respond({ text: "Usage: `/jibot link @user SLACK_UID`", response_type: "ephemeral" });
      return;
    }

    const targetId = userMatch[1];
    const targetTier = getTier(targetId);

    if (targetTier === "owner") {
      linkOwner(newUid);
      await respond({ text: `✅ Linked ${newUid} to owner identity.`, response_type: "ephemeral" });
    } else if (targetTier === "admin") {
      linkAdmin(targetId, newUid);
      await respond({ text: `✅ Linked ${newUid} to <@${targetId}>'s admin identity.`, response_type: "ephemeral" });
    } else {
      await respond({ text: `❌ <@${targetId}> must be admin or owner to link IDs. Promote them first.`, response_type: "ephemeral" });
    }
    return;
  }

  // /jibot admins - List admins (admin+)
  if (subcommand === "admins") {
    if (!hasPermission(userId, "admin")) {
      await respond({ text: "❌ You need admin permissions.", response_type: "ephemeral" });
      return;
    }

    const owner = getOwner();
    const admins = listAdmins();

    let msg = "*👑 Owner:*\n";
    if (owner) {
      msg += `<@${owner.ownerId}>`;
      if (owner.linkedIds.length > 0) {
        msg += ` (also: ${owner.linkedIds.join(", ")})`;
      }
    } else {
      msg += "_Not configured_";
    }

    msg += "\n\n*🛡️ Admins:*\n";
    if (admins.length === 0) {
      msg += "_None_";
    } else {
      for (const admin of admins) {
        msg += `• <@${admin.canonicalId}>`;
        if (admin.displayName) msg += ` (${admin.displayName})`;
        if (admin.linkedIds.length > 0) {
          msg += ` - also: ${admin.linkedIds.join(", ")}`;
        }
        msg += "\n";
      }
    }

    await respond({ text: msg, response_type: "ephemeral" });
    return;
  }

  // /jibot setowner - First-time setup (only works if no owner set)
  if (subcommand === "setowner") {
    if (isOwnerConfigured()) {
      await respond({ text: "❌ Owner already configured.", response_type: "ephemeral" });
      return;
    }

    setOwner(userId);
    await respond({ text: `✅ You are now the owner of Jibot!`, response_type: "ephemeral" });
    return;
  }

  // /jibot explain X
  if (subcommand === "explain") {
    const query = args.slice(1).join(" ");
    if (!query) {
      await respond({ text: "Usage: `/jibot explain [concept]`", response_type: "ephemeral" });
      return;
    }
    await respond({ text: handleExplain(query, "concept"), response_type: "ephemeral" });
    return;
  }

  // /jibot whatis X
  if (subcommand === "whatis") {
    const query = args.slice(1).join(" ");
    if (!query) {
      await respond({ text: "Usage: `/jibot whatis [organization]`", response_type: "ephemeral" });
      return;
    }
    await respond({ text: handleExplain(query, "org"), response_type: "ephemeral" });
    return;
  }

  // /jibot remind X
  if (subcommand === "remind") {
    // Extract "to" part: /jibot remind do the thing
    const message = args.slice(1).join(" ");
    if (!message) {
      await respond({ text: "Usage: `/jibot remind [message]`", response_type: "ephemeral" });
      return;
    }
    
    let displayName: string | undefined;
    try {
      const userInfo = await client.users.info({ user: userId });
      displayName = userInfo.user?.profile?.display_name || userInfo.user?.real_name;
    } catch (e) {}
    
    addReminder(message, userId, team, channel, displayName);
    const count = getReminderCount();
    await respond({ 
      text: `📥 Got it! I'll remind Joi to: *${message}*\n_Inbox now has ${count} reminder${count === 1 ? "" : "s"}_`,
      response_type: "in_channel" 
    });
    return;
  }

  // Unknown command
  await respond({ 
    text: `Unknown command: \`${subcommand}\`. Try \`/jibot help\``,
    response_type: "ephemeral" 
  });
});

// ============================================================================
// Start the App
// ============================================================================

(async () => {
  const port = process.env.PORT || 3000;
  await app.start(port);
  
  console.log(`🤖 Jibot 3 is running on port ${port}`);
  console.log("   Data: ~/switchboard/jibot/");
  console.log("\nFeatures:");
  console.log("   • Learn facts: jibot @user is [fact]");
  console.log("   • Recall: who is @user?");
  console.log("   • Forget: jibot forget @user");
  console.log("   • Remind: remind joi to [thing]");
  console.log("   • Explain: explain [concept]");
  console.log("   • Lookup: what is [organization]");
  console.log("   • Slash: /jibot [command]");
  console.log("\nFirst-time setup: /jibot setowner");
})();
