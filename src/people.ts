/**
 * People Facts Storage - Per-Workspace with Cross-Workspace Linking
 * 
 * Stores facts about people per workspace (team ID).
 * Supports linking the same person across workspaces.
 * 
 * Data structure:
 * - people-{teamId}.json: Facts for each workspace
 * - people-links.json: Cross-workspace identity links
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

// Cross-workspace identity link
// canonicalId is the "primary" identity, linkedIds are alternates in other workspaces
export interface PersonLink {
  canonicalId: string;      // Primary user ID (from first workspace)
  canonicalTeam: string;    // Team ID where canonical ID lives
  linkedIds: {              // Linked identities in other workspaces
    odUserId: string;
    teamId: string;
    displayName?: string;
  }[];
}

export interface PeopleLinksStore {
  links: PersonLink[];
}

const DATA_DIR = path.join(os.homedir(), "switchboard", "jibot");
const LINKS_FILE = path.join(DATA_DIR, "people-links.json");

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Get the people file path for a specific workspace
 */
function getPeopleFile(teamId: string): string {
  return path.join(DATA_DIR, `people-${teamId}.json`);
}

/**
 * Load people facts for a specific workspace
 */
export function loadPeople(teamId: string): PeopleStore {
  ensureDataDir();
  try {
    const file = getPeopleFile(teamId);
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error loading people facts for team ${teamId}:`, error);
  }
  return {};
}

/**
 * Save people facts for a specific workspace
 */
export function savePeople(teamId: string, store: PeopleStore): void {
  ensureDataDir();
  try {
    fs.writeFileSync(getPeopleFile(teamId), JSON.stringify(store, null, 2));
  } catch (error) {
    console.error(`Error saving people facts for team ${teamId}:`, error);
  }
}

/**
 * Load cross-workspace identity links
 */
export function loadLinks(): PeopleLinksStore {
  ensureDataDir();
  try {
    if (fs.existsSync(LINKS_FILE)) {
      const data = fs.readFileSync(LINKS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading people links:", error);
  }
  return { links: [] };
}

/**
 * Save cross-workspace identity links
 */
export function saveLinks(store: PeopleLinksStore): void {
  ensureDataDir();
  try {
    fs.writeFileSync(LINKS_FILE, JSON.stringify(store, null, 2));
  } catch (error) {
    console.error("Error saving people links:", error);
  }
}

/**
 * Find a person's canonical identity (resolves linked IDs)
 * Returns { canonicalId, canonicalTeam } or null if not linked
 */
export function findCanonicalIdentity(userId: string, teamId: string): { canonicalId: string; canonicalTeam: string } | null {
  const linksStore = loadLinks();
  
  for (const link of linksStore.links) {
    // Check if this is the canonical ID
    if (link.canonicalId === userId && link.canonicalTeam === teamId) {
      return { canonicalId: link.canonicalId, canonicalTeam: link.canonicalTeam };
    }
    // Check if this is a linked ID
    const linkedMatch = link.linkedIds.find(l => l.odUserId === userId && l.teamId === teamId);
    if (linkedMatch) {
      return { canonicalId: link.canonicalId, canonicalTeam: link.canonicalTeam };
    }
  }
  
  return null;
}

/**
 * Get all identities for a person (canonical + all linked)
 */
export function getAllIdentities(userId: string, teamId: string): { userId: string; teamId: string }[] {
  const linksStore = loadLinks();
  
  for (const link of linksStore.links) {
    // Check if this user is part of this link group
    const isCanonical = link.canonicalId === userId && link.canonicalTeam === teamId;
    const linkedMatch = link.linkedIds.find(l => l.odUserId === userId && l.teamId === teamId);
    
    if (isCanonical || linkedMatch) {
      // Return all identities in this group
      const identities = [{ userId: link.canonicalId, teamId: link.canonicalTeam }];
      for (const linked of link.linkedIds) {
        identities.push({ userId: linked.odUserId, teamId: linked.teamId });
      }
      return identities;
    }
  }
  
  // Not linked - just return the single identity
  return [{ userId, teamId }];
}

/**
 * Link two users across workspaces
 * Returns success status and message
 */
export function linkUsers(
  userId1: string,
  teamId1: string,
  userId2: string,
  teamId2: string,
  displayName?: string
): { success: boolean; message: string } {
  const linksStore = loadLinks();
  
  // Check if either user is already linked
  const existing1 = findCanonicalIdentity(userId1, teamId1);
  const existing2 = findCanonicalIdentity(userId2, teamId2);
  
  if (existing1 && existing2) {
    // Both already linked - check if to the same canonical
    if (existing1.canonicalId === existing2.canonicalId && existing1.canonicalTeam === existing2.canonicalTeam) {
      return { success: false, message: "These users are already linked to each other." };
    }
    // TODO: Could merge the two link groups, but keeping it simple for now
    return { success: false, message: "Both users are already part of different link groups. Merging not supported yet." };
  }
  
  if (existing1) {
    // Add userId2 to existing link group
    const link = linksStore.links.find(l => l.canonicalId === existing1.canonicalId && l.canonicalTeam === existing1.canonicalTeam);
    if (link) {
      link.linkedIds.push({ odUserId: userId2, teamId: teamId2, displayName });
      saveLinks(linksStore);
      return { success: true, message: `Linked user to existing identity group.` };
    }
  }
  
  if (existing2) {
    // Add userId1 to existing link group
    const link = linksStore.links.find(l => l.canonicalId === existing2.canonicalId && l.canonicalTeam === existing2.canonicalTeam);
    if (link) {
      link.linkedIds.push({ odUserId: userId1, teamId: teamId1, displayName });
      saveLinks(linksStore);
      return { success: true, message: `Linked user to existing identity group.` };
    }
  }
  
  // Neither is linked - create new link group with userId1 as canonical
  linksStore.links.push({
    canonicalId: userId1,
    canonicalTeam: teamId1,
    linkedIds: [{ odUserId: userId2, teamId: teamId2, displayName }]
  });
  saveLinks(linksStore);
  return { success: true, message: `Created new cross-workspace identity link.` };
}

/**
 * Add a fact about a person (workspace-specific)
 */
export function addFact(
  userId: string,
  teamId: string,
  fact: string,
  addedBy: string,
  displayName?: string,
  slackName?: string
): void {
  const store = loadPeople(teamId);

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

  savePeople(teamId, store);
  console.log(`📝 Learned about <@${userId}> in team ${teamId}: "${fact}"`);
}

/**
 * Get all facts about a person (includes linked identities across workspaces)
 */
export function getFacts(userId: string, teamId: string): PersonFact[] {
  const identities = getAllIdentities(userId, teamId);
  const allFacts: PersonFact[] = [];
  
  for (const identity of identities) {
    const store = loadPeople(identity.teamId);
    const facts = store[identity.userId]?.facts || [];
    allFacts.push(...facts);
  }
  
  // Sort by date (newest first)
  allFacts.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  
  return allFacts;
}

/**
 * Get facts for a person in a specific workspace only (no cross-workspace merge)
 */
export function getFactsLocal(userId: string, teamId: string): PersonFact[] {
  const store = loadPeople(teamId);
  return store[userId]?.facts || [];
}

/**
 * Get a person's record (local to workspace)
 */
export function getPerson(userId: string, teamId: string): PersonRecord | undefined {
  const store = loadPeople(teamId);
  return store[userId];
}

/**
 * Get display name for a person
 */
export function getDisplayName(userId: string, teamId: string): string | undefined {
  const store = loadPeople(teamId);
  return store[userId]?.displayName || store[userId]?.slackName;
}

/**
 * Remove a specific fact about a person (0-indexed, local to workspace)
 */
export function removeFact(userId: string, teamId: string, index: number): boolean {
  const store = loadPeople(teamId);

  if (!store[userId] || !store[userId].facts[index]) {
    return false;
  }

  const removed = store[userId].facts.splice(index, 1)[0];
  console.log(`🗑️ Forgot about <@${userId}>: "${removed.fact}"`);

  if (store[userId].facts.length === 0) {
    delete store[userId];
  }

  savePeople(teamId, store);
  return true;
}

/**
 * Remove all facts about a person (local to workspace)
 */
export function removeAllFacts(userId: string, teamId: string): number {
  const store = loadPeople(teamId);

  if (!store[userId]) {
    return 0;
  }

  const count = store[userId].facts.length;
  delete store[userId];
  savePeople(teamId, store);

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
 * Get all people in a workspace
 */
export function getAllPeople(teamId: string): PeopleStore {
  return loadPeople(teamId);
}

/**
 * List all cross-workspace links
 */
export function listAllLinks(): PersonLink[] {
  return loadLinks().links;
}
