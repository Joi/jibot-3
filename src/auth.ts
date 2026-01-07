/**
 * Identity & Tier System
 * 
 * Three tiers:
 * - owner: Full control (Joi) - set tiers, link identities, clear inbox
 * - admin: Ops visibility - view inbox queue
 * - guest: Default - basic interactions, queries, add/forget facts, remind joi
 * 
 * Cross-workspace identity:
 * - When promoted to admin, canonical ID = first Slack UID
 * - Additional workspace IDs can be linked to same identity
 */

import * as fs from "fs";
import * as path from "path";
import os from "os";

export type Tier = "owner" | "admin" | "guest";

export interface AdminIdentity {
  displayName?: string;
  tier: "admin";
  linkedIds: string[]; // Additional Slack UIDs linked to this identity
}

export interface AuthStore {
  owner: string; // Owner's Slack UID (primary workspace)
  ownerLinkedIds: string[]; // Owner's IDs in other workspaces
  admins: { [canonicalId: string]: AdminIdentity };
}

const DATA_DIR = path.join(os.homedir(), "switchboard", "jibot");
const AUTH_FILE = path.join(DATA_DIR, "auth.json");

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Load auth store
 */
export function loadAuth(): AuthStore {
  ensureDataDir();
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const data = fs.readFileSync(AUTH_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading auth store:", error);
  }
  // Default: no owner set yet
  return { owner: "", ownerLinkedIds: [], admins: {} };
}

/**
 * Save auth store
 */
export function saveAuth(store: AuthStore): void {
  ensureDataDir();
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(store, null, 2));
  } catch (error) {
    console.error("Error saving auth store:", error);
  }
}

/**
 * Get the tier for a user ID
 */
export function getTier(userId: string): Tier {
  const store = loadAuth();
  
  // Check if owner
  if (userId === store.owner || store.ownerLinkedIds.includes(userId)) {
    return "owner";
  }
  
  // Check if admin (by canonical ID or linked ID)
  for (const [canonicalId, admin] of Object.entries(store.admins)) {
    if (canonicalId === userId || admin.linkedIds.includes(userId)) {
      return "admin";
    }
  }
  
  // Default to guest
  return "guest";
}

/**
 * Check if user has at least the given tier
 */
export function hasPermission(userId: string, requiredTier: Tier): boolean {
  const userTier = getTier(userId);
  
  if (requiredTier === "guest") return true;
  if (requiredTier === "admin") return userTier === "admin" || userTier === "owner";
  if (requiredTier === "owner") return userTier === "owner";
  
  return false;
}

/**
 * Set the owner (first-time setup or transfer)
 */
export function setOwner(userId: string): void {
  const store = loadAuth();
  store.owner = userId;
  saveAuth(store);
  console.log(`👑 Owner set to <@${userId}>`);
}

/**
 * Link an additional Slack ID to the owner
 */
export function linkOwner(newId: string): boolean {
  const store = loadAuth();
  if (!store.owner) return false;
  
  if (!store.ownerLinkedIds.includes(newId)) {
    store.ownerLinkedIds.push(newId);
    saveAuth(store);
    console.log(`🔗 Linked ${newId} to owner`);
  }
  return true;
}

/**
 * Promote a user to admin (canonical ID = their Slack UID)
 */
export function promoteToAdmin(userId: string, displayName?: string): void {
  const store = loadAuth();
  
  // Don't promote if already admin
  if (store.admins[userId]) {
    return;
  }
  
  store.admins[userId] = {
    displayName,
    tier: "admin",
    linkedIds: [],
  };
  
  saveAuth(store);
  console.log(`⬆️ Promoted <@${userId}> to admin`);
}

/**
 * Demote an admin back to guest
 */
export function demoteAdmin(canonicalId: string): boolean {
  const store = loadAuth();
  
  if (!store.admins[canonicalId]) {
    return false;
  }
  
  delete store.admins[canonicalId];
  saveAuth(store);
  console.log(`⬇️ Demoted ${canonicalId} to guest`);
  return true;
}

/**
 * Link an additional Slack ID to an admin identity
 */
export function linkAdmin(canonicalId: string, newId: string): boolean {
  const store = loadAuth();
  
  if (!store.admins[canonicalId]) {
    return false;
  }
  
  if (!store.admins[canonicalId].linkedIds.includes(newId)) {
    store.admins[canonicalId].linkedIds.push(newId);
    saveAuth(store);
    console.log(`🔗 Linked ${newId} to admin ${canonicalId}`);
  }
  return true;
}

/**
 * Get canonical ID for a user (returns the user ID if guest, or their canonical admin/owner ID)
 */
export function getCanonicalId(userId: string): string {
  const store = loadAuth();
  
  // Check owner
  if (userId === store.owner || store.ownerLinkedIds.includes(userId)) {
    return store.owner;
  }
  
  // Check admins
  for (const [canonicalId, admin] of Object.entries(store.admins)) {
    if (canonicalId === userId || admin.linkedIds.includes(userId)) {
      return canonicalId;
    }
  }
  
  // Guest - no canonical ID, use their current ID
  return userId;
}

/**
 * List all admins
 */
export function listAdmins(): { canonicalId: string; displayName?: string; linkedIds: string[] }[] {
  const store = loadAuth();
  return Object.entries(store.admins).map(([canonicalId, admin]) => ({
    canonicalId,
    displayName: admin.displayName,
    linkedIds: admin.linkedIds,
  }));
}

/**
 * Get owner info
 */
export function getOwner(): { ownerId: string; linkedIds: string[] } | null {
  const store = loadAuth();
  if (!store.owner) return null;
  return { ownerId: store.owner, linkedIds: store.ownerLinkedIds };
}

/**
 * Check if owner is configured
 */
export function isOwnerConfigured(): boolean {
  const store = loadAuth();
  return !!store.owner;
}
