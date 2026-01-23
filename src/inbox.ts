/**
 * Reminder Inbox - Apple Reminders Integration
 * 
 * Apple Reminders is the GROUND TRUTH for all inbox items.
 * No local storage - everything reads/writes directly to Apple Reminders.
 * Reminders go to a "Jibot" list for easy filtering.
 */

import { execSync } from "child_process";
import * as path from "path";
import os from "os";

const REMINDERS_TOOL = path.join(os.homedir(), "amplifier", "tools", "apple_reminders.py");
const JIBOT_LIST = "Jibot"; // Dedicated list for Jibot reminders

/**
 * Ensure the Jibot list exists (creates if needed)
 */
function ensureJibotList(): void {
  try {
    // Check if list exists by trying to list from it
    execSync(`python3 "${REMINDERS_TOOL}" list --list "${JIBOT_LIST}" --json 2>/dev/null`, {
      encoding: "utf-8",
    });
  } catch (error) {
    // List might not exist - that's okay, it will be created on first add
    console.log(`📋 Jibot reminders list will be created on first reminder`);
  }
}

export interface Reminder {
  id: string;
  title: string;
  notes?: string;
  completed: boolean;
  createdAt?: string;
}

/**
 * Add a reminder to Apple Reminders (ground truth)
 */
export function addReminder(
  message: string,
  fromUserId: string,
  workspace: string,
  channel: string,
  fromDisplayName?: string
): { success: boolean; message: string } {
  const from = fromDisplayName || fromUserId;
  const notes = `From: ${from}\nWorkspace: ${workspace}\nChannel: ${channel}\nAdded via Jibot`;
  
  try {
    // Escape quotes in message and notes for shell
    const escapedMessage = message.replace(/"/g, '\\"');
    const escapedNotes = notes.replace(/"/g, '\\"');
    
    const cmd = `python3 "${REMINDERS_TOOL}" add "${escapedMessage}" --list "${JIBOT_LIST}" --notes "${escapedNotes}"`;
    execSync(cmd, { encoding: "utf-8" });
    
    console.log(`📥 Added to Apple Reminders: "${message}" from ${from}`);
    return { success: true, message };
  } catch (error) {
    console.error("Error adding reminder:", error);
    return { success: false, message: `Failed to add reminder: ${error}` };
  }
}

/**
 * Get all incomplete reminders from Jibot list
 * Apple Reminders is the ground truth - no local storage
 */
export function getReminders(): Reminder[] {
  try {
    const output = execSync(
      `python3 "${REMINDERS_TOOL}" list --list "${JIBOT_LIST}" --json`,
      { encoding: "utf-8" }
    );
    
    // Python script outputs JSON array directly, not {reminders: [...]}
    const reminders = JSON.parse(output);
    return Array.isArray(reminders) ? reminders : [];
  } catch (error) {
    // List might not exist yet
    return [];
  }
}

/**
 * Get reminder count directly from Apple Reminders
 */
export function getReminderCount(): number {
  return getReminders().length;
}

/**
 * Complete (clear) a reminder by title
 */
export function clearReminderByTitle(title: string): { success: boolean; title: string } {
  try {
    const escapedTitle = title.replace(/"/g, '\\"');
    execSync(
      `python3 "${REMINDERS_TOOL}" complete "${escapedTitle}"`,
      { encoding: "utf-8" }
    );
    
    console.log(`✅ Completed reminder: "${title}"`);
    return { success: true, title };
  } catch (error) {
    console.error("Error completing reminder:", error);
    return { success: false, title };
  }
}

/**
 * Complete a reminder by index (1-based)
 */
export function clearReminderByIndex(index: number): Reminder | null {
  const reminders = getReminders();
  const zeroIndex = index - 1;
  
  if (zeroIndex < 0 || zeroIndex >= reminders.length) {
    return null;
  }
  
  const reminder = reminders[zeroIndex];
  const result = clearReminderByTitle(reminder.title);
  
  if (result.success) {
    return reminder;
  }
  return null;
}

/**
 * Clear all reminders in the Jibot list
 */
export function clearAllReminders(): number {
  const reminders = getReminders();
  let cleared = 0;
  
  for (const reminder of reminders) {
    const result = clearReminderByTitle(reminder.title);
    if (result.success) cleared++;
  }
  
  console.log(`✅ Cleared ${cleared} reminders`);
  return cleared;
}

/**
 * Format reminders for display in Slack
 */
export function formatInbox(reminders: Reminder[]): string {
  if (reminders.length === 0) {
    return "📭 Inbox is empty!";
  }
  
  const lines = reminders.map((r, i) => {
    let line = `${i + 1}. *${r.title}*`;
    if (r.notes) {
      // Extract "From:" from notes
      const fromMatch = r.notes.match(/From:\s*(.+)/);
      if (fromMatch) {
        line += `\n   _from ${fromMatch[1]}_`;
      }
    }
    return line;
  });
  
  return `📬 *Inbox* (${reminders.length} reminder${reminders.length === 1 ? "" : "s"}):\n\n${lines.join("\n\n")}\n\n_Reminders sync to Apple Reminders "Jibot" list_`;
}

// Initialize on load
ensureJibotList();
