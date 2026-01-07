/**
 * Google Calendar Integration
 * 
 * Adds events to Joi's calendar via Google Calendar API.
 * Uses LLM to parse natural language into structured event data.
 */

import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import os from "os";
import OpenAI from "openai";

// Paths to Google Calendar credentials
const CREDENTIALS_PATH = path.join(os.homedir(), ".gcalendar", "credentials.json");
const TOKEN_PATH = path.join(os.homedir(), ".gcalendar", "token.json");

// OpenAI client - lazy initialized
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

export interface CalendarEvent {
  summary: string;
  description?: string;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  location?: string;
  allDay?: boolean;
}

export interface ParsedEventResult {
  success: boolean;
  event?: CalendarEvent;
  error?: string;
  interpretation?: string; // Human-readable interpretation
}

export interface AddEventResult {
  success: boolean;
  eventId?: string;
  eventLink?: string;
  error?: string;
}

/**
 * Load OAuth2 credentials and create auth client
 */
function getAuthClient(): any {
  try {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
    
    const { client_id, client_secret, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials(token);
    
    return oAuth2Client;
  } catch (error) {
    console.error("Error loading Google Calendar credentials:", error);
    return null;
  }
}

/**
 * Use LLM to parse natural language into structured calendar event
 */
export async function parseCalendarRequest(naturalLanguage: string): Promise<ParsedEventResult> {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const systemPrompt = `You are a calendar assistant that parses natural language into structured calendar events.

Current date/time: ${now.toISOString()}
Timezone: ${timezone}

Given a natural language request, extract:
- summary: Event title (required)
- description: Additional details (optional)
- startTime: ISO 8601 datetime with timezone
- endTime: ISO 8601 datetime with timezone
- location: Where it takes place (optional)
- allDay: true if it's an all-day event

Rules:
- If no time specified, assume a reasonable default (e.g., meetings at 10am, 1 hour duration)
- If "tomorrow", "next Monday", etc., calculate the actual date
- If duration not specified, assume 1 hour for meetings, 30 min for calls
- For all-day events (birthdays, deadlines), set allDay: true

Respond with JSON only, no markdown:
{
  "summary": "...",
  "description": "...",
  "startTime": "2024-01-15T10:00:00-05:00",
  "endTime": "2024-01-15T11:00:00-05:00",
  "location": "...",
  "allDay": false,
  "interpretation": "Human readable: Meeting with Bob tomorrow at 10am for 1 hour"
}`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: naturalLanguage }
      ],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || "";
    
    // Parse JSON response
    const parsed = JSON.parse(content);
    
    return {
      success: true,
      event: {
        summary: parsed.summary,
        description: parsed.description,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        location: parsed.location,
        allDay: parsed.allDay || false,
      },
      interpretation: parsed.interpretation,
    };
  } catch (error) {
    console.error("Error parsing calendar request:", error);
    return {
      success: false,
      error: `Failed to parse request: ${error}`,
    };
  }
}

/**
 * Add an event to Google Calendar
 */
export async function addEventToCalendar(event: CalendarEvent): Promise<AddEventResult> {
  const auth = getAuthClient();
  if (!auth) {
    return {
      success: false,
      error: "Google Calendar not configured. Missing credentials.",
    };
  }

  const calendar = google.calendar({ version: "v3", auth });

  try {
    // Build event object
    const eventBody: any = {
      summary: event.summary,
      description: event.description,
      location: event.location,
    };

    if (event.allDay) {
      // All-day events use date instead of dateTime
      const startDate = event.startTime.split("T")[0];
      const endDate = event.endTime.split("T")[0];
      eventBody.start = { date: startDate };
      eventBody.end = { date: endDate };
    } else {
      eventBody.start = { dateTime: event.startTime };
      eventBody.end = { dateTime: event.endTime };
    }

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: eventBody,
    });

    return {
      success: true,
      eventId: response.data.id || undefined,
      eventLink: response.data.htmlLink || undefined,
    };
  } catch (error: any) {
    console.error("Error adding calendar event:", error);
    
    // Check for scope/permission error
    if (error.message?.includes("insufficient") || error.code === 403) {
      return {
        success: false,
        error: "Calendar has read-only access. Need to re-authorize with write permissions.",
      };
    }
    
    return {
      success: false,
      error: `Failed to add event: ${error.message}`,
    };
  }
}

/**
 * High-level function: Parse natural language and add to calendar
 */
export async function addToCalendarNaturalLanguage(
  request: string,
  addedBy: string
): Promise<{ success: boolean; message: string; eventLink?: string }> {
  // Step 1: Parse natural language
  const parsed = await parseCalendarRequest(request);
  
  if (!parsed.success || !parsed.event) {
    return {
      success: false,
      message: parsed.error || "Could not understand the calendar request.",
    };
  }

  // Add who requested it to description
  const event = parsed.event;
  event.description = event.description 
    ? `${event.description}\n\nAdded via Jibot by ${addedBy}`
    : `Added via Jibot by ${addedBy}`;

  // Step 2: Add to calendar
  const result = await addEventToCalendar(event);
  
  if (!result.success) {
    return {
      success: false,
      message: result.error || "Failed to add event to calendar.",
    };
  }

  return {
    success: true,
    message: `📅 Added to calendar: *${event.summary}*\n${parsed.interpretation || ""}`,
    eventLink: result.eventLink,
  };
}

/**
 * Check if calendar is properly configured
 */
export function isCalendarConfigured(): boolean {
  return fs.existsSync(CREDENTIALS_PATH) && fs.existsSync(TOKEN_PATH);
}

/**
 * Get instructions for setting up write access
 */
export function getWriteAccessInstructions(): string {
  return `To enable calendar write access:

1. Go to https://console.cloud.google.com/apis/credentials
2. Select your project (calendar-vi)
3. Delete the existing token: rm ~/.gcalendar/token.json
4. Run a re-authorization flow with scope: https://www.googleapis.com/auth/calendar

Or use this command to re-authorize:
node -e "
const {google} = require('googleapis');
const fs = require('fs');
const creds = JSON.parse(fs.readFileSync('$HOME/.gcalendar/credentials.json'));
const {client_id, client_secret, redirect_uris} = creds.installed;
const oAuth2 = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
const url = oAuth2.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/calendar']
});
console.log('Authorize at:', url);
"`;
}
