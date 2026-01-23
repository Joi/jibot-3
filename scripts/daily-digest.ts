#!/usr/bin/env npx ts-node
/**
 * Jibot Daily Digest
 * 
 * Run via cron to send a morning summary to the owner.
 * Usage: npx ts-node daily-digest.ts
 */

import { WebClient } from "@slack/web-api";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const BRIDGE_PATH = process.env.HOME + "/jibot-3/scripts/amplifier_bridge.py";

interface BridgeResult {
  success: boolean;
  data?: any;
  error?: string;
}

function callBridge(skill: string, action: string, ...args: string[]): BridgeResult {
  try {
    const escapedArgs = args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(" ");
    const cmd = `${BRIDGE_PATH} ${skill} ${action} ${escapedArgs}`;
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
}

async function generateDigest(): Promise<string> {
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : "Good afternoon";
  const dateStr = now.toLocaleDateString("en-US", { 
    weekday: "long", 
    month: "long", 
    day: "numeric",
    timeZone: "Asia/Tokyo"
  });

  let digest = `${greeting}! 📅 *${dateStr}*\n\n`;

  // Calendar events for today
  const calResult = callBridge("calendar", "list", "today");
  if (calResult.success && calResult.data?.events) {
    const events = calResult.data.events;
    const meetingCount = events.filter((e: any) => !e.all_day).length;
    const allDayCount = events.filter((e: any) => e.all_day).length;
    
    digest += `📅 *Today's Schedule* (${meetingCount} meetings`;
    if (allDayCount > 0) digest += `, ${allDayCount} all-day`;
    digest += `)\n`;
    
    // Show first meeting
    const firstMeeting = events.find((e: any) => !e.all_day);
    if (firstMeeting) {
      const time = new Date(firstMeeting.start).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Tokyo"
      });
      digest += `   First: *${time}* — ${firstMeeting.summary}\n`;
    }
    
    // List all meetings briefly
    const meetings = events.filter((e: any) => !e.all_day).slice(0, 5);
    for (const m of meetings) {
      const time = new Date(m.start).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Tokyo"
      });
      digest += `   • ${time} — ${m.summary}\n`;
    }
    if (events.filter((e: any) => !e.all_day).length > 5) {
      digest += `   _...and ${events.filter((e: any) => !e.all_day).length - 5} more_\n`;
    }
  }
  
  digest += "\n";

  // Inbox/Reminders
  const inboxResult = callBridge("reminders", "list", "Jibot");
  if (inboxResult.success && inboxResult.data?.reminders) {
    const pending = inboxResult.data.reminders.filter((r: any) => !r.completed);
    digest += `📥 *Inbox:* ${pending.length} pending item${pending.length !== 1 ? "s" : ""}\n`;
    
    // Show top 3
    for (const r of pending.slice(0, 3)) {
      digest += `   • ${r.title}\n`;
    }
    if (pending.length > 3) {
      digest += `   _...and ${pending.length - 3} more_\n`;
    }
  }

  digest += "\n_Have a productive day!_ ☀️";

  return digest;
}

async function sendDigest() {
  // Load owner data
  const ownerFile = path.join(process.env.HOME!, "jibot-3", "data", "owner.json");
  if (!fs.existsSync(ownerFile)) {
    console.error("No owner configured");
    process.exit(1);
  }
  
  const ownerData = JSON.parse(fs.readFileSync(ownerFile, "utf-8"));
  const ownerId = ownerData.ownerId;
  
  // Load Slack token
  const envFile = path.join(process.env.HOME!, "jibot-3", ".env");
  const envContent = fs.readFileSync(envFile, "utf-8");
  const tokenMatch = envContent.match(/SLACK_BOT_TOKEN=(.+)/);
  if (!tokenMatch) {
    console.error("No Slack token found");
    process.exit(1);
  }
  
  const client = new WebClient(tokenMatch[1].trim());
  
  // Generate digest
  const digest = await generateDigest();
  console.log("Generated digest:\n", digest);
  
  // Send to owner
  try {
    const dmResult = await client.conversations.open({ users: ownerId });
    if (!dmResult.ok || !dmResult.channel?.id) {
      console.error("Could not open DM with owner");
      process.exit(1);
    }
    
    await client.chat.postMessage({
      channel: dmResult.channel.id,
      text: digest,
      unfurl_links: false
    });
    
    console.log("✅ Daily digest sent to owner");
  } catch (error: any) {
    console.error("Failed to send digest:", error.message);
    process.exit(1);
  }
}

sendDigest().catch(console.error);
