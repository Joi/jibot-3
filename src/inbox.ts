/**
 * Reminder Inbox
 * 
 * Allows anyone to send reminders to Joi via "remind joi to..."
 * Owner can view and clear the inbox queue.
 * Admins can view the inbox.
 */

import * as fs from "fs";
import * as path from "path";
import os from "os";

export interface Reminder {
  id: string;
  message: string;
  fromUserId: string;
  fromDisplayName?: string;
  workspace: string;
  channel: string;
  createdAt: string;
}

export interface InboxStore {
  reminders: Reminder[];
}

const DATA_DIR = path.join(os.homedir(), "switchboard", "jibot");
const INBOX_FILE = path.join(DATA_DIR, "inbox.json");

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Generate a simple unique ID
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Load inbox
 */
export function loadInbox(): InboxStore {
  ensureDataDir();
  try {
    if (fs.existsSync(INBOX_FILE)) {
      const data = fs.readFileSync(INBOX_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading inbox:", error);
  }
  return { reminders: [] };
}

/**
 * Save inbox
 */
export function saveInbox(store: InboxStore): void {
  ensureDataDir();
  try {
    fs.writeFileSync(INBOX_FILE, JSON.stringify(store, null, 2));
  } catch (error) {
    console.error("Error saving inbox:", error);
  }
}

/**
 * Add a reminder to the inbox
 */
export function addReminder(
  message: string,
  fromUserId: string,
  workspace: string,
  channel: string,
  fromDisplayName?: string
): Reminder {
  const store = loadInbox();
  
  const reminder: Reminder = {
    id: generateId(),
    message,
    fromUserId,
    fromDisplayName,
    workspace,
    channel,
    createdAt: new Date().toISOString(),
  };
  
  store.reminders.push(reminder);
  saveInbox(store);
  
  console.log(`📥 New reminder from <@${fromUserId}>: "${message}"`);
  return reminder;
}

/**
 * Get all reminders
 */
export function getReminders(): Reminder[] {
  const store = loadInbox();
  return store.reminders;
}

/**
 * Get reminder count
 */
export function getReminderCount(): number {
  const store = loadInbox();
  return store.reminders.length;
}

/**
 * Clear a specific reminder by ID
 */
export function clearReminder(id: string): Reminder | null {
  const store = loadInbox();
  const index = store.reminders.findIndex(r => r.id === id);
  
  if (index === -1) return null;
  
  const [removed] = store.reminders.splice(index, 1);
  saveInbox(store);
  
  console.log(`✅ Cleared reminder: "${removed.message}"`);
  return removed;
}

/**
 * Clear a reminder by index (1-based for user-friendliness)
 */
export function clearReminderByIndex(index: number): Reminder | null {
  const store = loadInbox();
  const zeroIndex = index - 1;
  
  if (zeroIndex < 0 || zeroIndex >= store.reminders.length) {
    return null;
  }
  
  const [removed] = store.reminders.splice(zeroIndex, 1);
  saveInbox(store);
  
  console.log(`✅ Cleared reminder #${index}: "${removed.message}"`);
  return removed;
}

/**
 * Clear all reminders
 */
export function clearAllReminders(): number {
  const store = loadInbox();
  const count = store.reminders.length;
  
  store.reminders = [];
  saveInbox(store);
  
  console.log(`✅ Cleared all ${count} reminders`);
  return count;
}

/**
 * Format reminders for display
 */
export function formatInbox(reminders: Reminder[]): string {
  if (reminders.length === 0) {
    return "📭 Inbox is empty!";
  }
  
  const lines = reminders.map((r, i) => {
    const from = r.fromDisplayName || `<@${r.fromUserId}>`;
    const date = new Date(r.createdAt).toLocaleDateString();
    return `${i + 1}. *${r.message}*\n   _from ${from} on ${date}_`;
  });
  
  return `📬 *Inbox* (${reminders.length} reminder${reminders.length === 1 ? "" : "s"}):\n\n${lines.join("\n\n")}`;
}
