/**
 * Slack Mentions Monitor
 * 
 * Listens for mentions of the owner in channels and creates reminders
 * in the "Slack Mentions" Apple Reminders list.
 * 
 * Features:
 * - Detects owner mentions in any channel message
 * - Translates non-English messages to English
 * - Creates reminder with Slack permalink when possible
 * - Falls back to workspace/channel/user metadata
 */

import { execSync } from "child_process";
import * as path from "path";
import os from "os";

const REMINDERS_TOOL = path.join(os.homedir(), "amplifier", "tools", "apple_reminders.py");
const MENTIONS_LIST = "Slack Mentions";

/**
 * Detect if text is likely non-English using simple heuristics
 * Returns true if likely non-English
 */
function isLikelyNonEnglish(text: string): boolean {
  // Check for Japanese characters (Hiragana, Katakana, Kanji)
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  // Check for Chinese characters
  const chinesePattern = /[\u4E00-\u9FFF]/;
  // Check for Korean characters
  const koreanPattern = /[\uAC00-\uD7AF\u1100-\u11FF]/;
  // Check for Cyrillic
  const cyrillicPattern = /[\u0400-\u04FF]/;
  // Check for Arabic
  const arabicPattern = /[\u0600-\u06FF]/;
  
  return japanesePattern.test(text) || 
         chinesePattern.test(text) || 
         koreanPattern.test(text) ||
         cyrillicPattern.test(text) ||
         arabicPattern.test(text);
}

/**
 * Translate text to English using OpenAI API
 */
async function translateToEnglish(text: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("No OPENAI_API_KEY for translation");
    return text;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Translate the following text to English. Only output the translation, nothing else. If already English, output as-is."
          },
          { role: "user", content: text }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content?.trim() || text;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}

/**
 * Build a Slack permalink from message info
 */
function buildSlackLink(teamId: string, channelId: string, messageTs: string): string {
  // Convert timestamp: 1234567890.123456 -> p1234567890123456
  const tsForLink = messageTs.replace(".", "");
  return `https://slack.com/archives/${channelId}/p${tsForLink}`;
}

/**
 * Add a mention reminder to Apple Reminders
 */
export async function addMentionReminder(
  originalText: string,
  fromUserId: string,
  fromDisplayName: string | undefined,
  teamId: string,
  teamName: string | undefined,
  channelId: string,
  channelName: string | undefined,
  messageTs: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Translate if non-English
    let displayText = originalText;
    let wasTranslated = false;
    
    if (isLikelyNonEnglish(originalText)) {
      displayText = await translateToEnglish(originalText);
      wasTranslated = true;
    }

    // Build the reminder title (truncate if too long)
    const maxTitleLength = 100;
    let title = displayText.length > maxTitleLength 
      ? displayText.substring(0, maxTitleLength) + "..."
      : displayText;
    
    // Clean up Slack formatting from title
    title = title.replace(/<@[A-Z0-9]+>/gi, "@someone").replace(/<[^>]+>/g, "");

    // Build Slack link
    const slackLink = buildSlackLink(teamId, channelId, messageTs);
    
    // Build notes with all metadata
    const from = fromDisplayName || fromUserId;
    const channel = channelName || channelId;
    const workspace = teamName || teamId;
    
    let notes = `From: ${from}\n`;
    notes += `Channel: #${channel}\n`;
    notes += `Workspace: ${workspace}\n`;
    notes += `Link: ${slackLink}\n`;
    if (wasTranslated) {
      notes += `\n--- Original ---\n${originalText}\n`;
    }
    
    // Escape quotes for shell
    const escapedTitle = title.replace(/"/g, '\\"').replace(/\n/g, " ");
    const escapedNotes = notes.replace(/"/g, '\\"');
    
    const cmd = `python3 "${REMINDERS_TOOL}" add "${escapedTitle}" --list "${MENTIONS_LIST}" --notes "${escapedNotes}"`;
    execSync(cmd, { encoding: "utf-8" });
    
    console.log(`📢 Added mention reminder: "${title.substring(0, 50)}..." from ${from}`);
    return { success: true, message: title };
  } catch (error) {
    console.error("Error adding mention reminder:", error);
    return { success: false, message: `Failed to add mention reminder: ${error}` };
  }
}
