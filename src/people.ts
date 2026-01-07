/**
 * People Facts Storage
 * 
 * Stores facts about people that jibot learns.
 * Data is stored in ~/switchboard/jibot/people.json (private, not in repo)
 */

import * as fs from "fs";
import * as path from "path";
import os from "os";

export interface PersonFact {
  fact: string;
  addedBy: string;
  addedAt: string;
}

export interface PersonRecord {
  displayName?: string;
  slackName?: string;
  facts: PersonFact[];
}

export interface PeopleStore {
  [userId: string]: PersonRecord;
}

// Data stored in ~/switchboard/jibot (private, synced via switchboard)
const DATA_DIR = path.join(os.homedir(), "switchboard", "jibot");
const PEOPLE_FILE = path.join(DATA_DIR, "people.json");

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`📁 Created data directory: ${DATA_DIR}`);
  }
}

/**
 * Load people facts from storage
 */
export function loadPeople(): PeopleStore {
  ensureDataDir();
  try {
    if (fs.existsSync(PEOPLE_FILE)) {
      const data = fs.readFileSync(PEOPLE_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading people facts:", error);
  }
  return {};
}

/**
 * Save people facts to storage
 */
export function savePeople(store: PeopleStore): void {
  ensureDataDir();
  try {
    fs.writeFileSync(PEOPLE_FILE, JSON.stringify(store, null, 2));
  } catch (error) {
    console.error("Error saving people facts:", error);
  }
}

/**
 * Add a fact about a person
 */
export function addFact(
  userId: string,
  fact: string,
  addedBy: string,
  displayName?: string,
  slackName?: string
): void {
  const store = loadPeople();

  if (!store[userId]) {
    store[userId] = { facts: [] };
  }

  if (displayName) {
    store[userId].displayName = displayName;
  }
  if (slackName) {
    store[userId].slackName = slackName;
  }

  store[userId].facts.push({
    fact,
    addedBy,
    addedAt: new Date().toISOString(),
  });

  savePeople(store);
  console.log(`📝 Learned about <@${userId}>: "${fact}"`);
}

/**
 * Get all facts about a person
 */
export function getFacts(userId: string): PersonFact[] {
  const store = loadPeople();
  return store[userId]?.facts || [];
}

/**
 * Get a person's record
 */
export function getPerson(userId: string): PersonRecord | undefined {
  const store = loadPeople();
  return store[userId];
}

/**
 * Get display name for a person
 */
export function getDisplayName(userId: string): string | undefined {
  const store = loadPeople();
  return store[userId]?.displayName || store[userId]?.slackName;
}

/**
 * Remove a specific fact about a person (0-indexed)
 */
export function removeFact(userId: string, index: number): boolean {
  const store = loadPeople();

  if (!store[userId] || !store[userId].facts[index]) {
    return false;
  }

  const removed = store[userId].facts.splice(index, 1)[0];
  console.log(`🗑️ Forgot about <@${userId}>: "${removed.fact}"`);

  // Clean up if no facts left
  if (store[userId].facts.length === 0) {
    delete store[userId];
  }

  savePeople(store);
  return true;
}

/**
 * Remove all facts about a person
 */
export function removeAllFacts(userId: string): number {
  const store = loadPeople();

  if (!store[userId]) {
    return 0;
  }

  const count = store[userId].facts.length;
  delete store[userId];
  savePeople(store);

  console.log(`🗑️ Forgot everything about <@${userId}> (${count} facts)`);
  return count;
}

/**
 * Format facts as a natural sentence
 */
export function formatFactsSentence(facts: PersonFact[]): string {
  if (facts.length === 0) return "";

  const factTexts = facts.map(f => f.fact);

  if (factTexts.length === 1) {
    return factTexts[0];
  } else if (factTexts.length === 2) {
    return `${factTexts[0]} and ${factTexts[1]}`;
  } else {
    const allButLast = factTexts.slice(0, -1).join(", ");
    return `${allButLast}, and ${factTexts[factTexts.length - 1]}`;
  }
}

/**
 * Get all people (for listing)
 */
export function getAllPeople(): PeopleStore {
  return loadPeople();
}
