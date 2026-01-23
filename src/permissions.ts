/**
 * Jibot Permissions System
 * 
 * Hierarchy: owner > admin > member > guest
 * 
 * - Owner: Full control, can manage admins
 * - Admin: Can manage members/guests, access most features
 * - Member: Standard access, can use lookups and basic features
 * - Guest: Limited access, read-only in most cases
 */

import * as fs from "fs";
import * as path from "path";

export type Role = "owner" | "admin" | "member" | "guest";

export interface UserRecord {
  displayName: string;
  role: Role;
  linkedIds: string[];  // Other Slack IDs for this person
  addedBy?: string;     // Who granted this role
  addedAt?: string;     // When role was granted
}

export interface WorkspaceSettings {
  defaultRole: Role;    // What role new users get
  name?: string;
}

export interface AuthData {
  owner: string;                          // Owner's primary Slack ID
  ownerLinkedIds: string[];               // Owner's other Slack IDs
  users: Record<string, UserRecord>;      // userId -> user record
  workspaces: Record<string, WorkspaceSettings>;  // workspaceId -> settings
}

const AUTH_FILE = path.join(
  process.env.HOME || "",
  "switchboard",
  "jibot",
  "auth.json"
);

// Role hierarchy for comparison
const ROLE_LEVELS: Record<Role, number> = {
  owner: 100,
  admin: 50,
  member: 20,
  guest: 10
};

/**
 * Load auth data from file
 */
export function loadAuth(): AuthData {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const data = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
      
      // Migrate old format if needed
      if (data.admins && !data.users) {
        const users: Record<string, UserRecord> = {};
        
        for (const [id, adminData] of Object.entries(data.admins as Record<string, any>)) {
          users[id] = {
            displayName: adminData.displayName || "Unknown",
            role: "admin",
            linkedIds: adminData.linkedIds || []
          };
        }
        
        return {
          owner: data.owner || "",
          ownerLinkedIds: data.ownerLinkedIds || [],
          users,
          workspaces: data.workspaces || {}
        };
      }
      
      return {
        owner: data.owner || "",
        ownerLinkedIds: data.ownerLinkedIds || [],
        users: data.users || {},
        workspaces: data.workspaces || {}
      };
    }
  } catch (error) {
    console.error("Error loading auth:", error);
  }
  
  return {
    owner: "",
    ownerLinkedIds: [],
    users: {},
    workspaces: {}
  };
}

/**
 * Save auth data to file
 */
export function saveAuth(auth: AuthData): void {
  const dir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2));
}

/**
 * Get a user's role
 */
export function getUserRole(userId: string, workspaceId?: string): Role {
  const auth = loadAuth();
  
  // Check if owner
  if (userId === auth.owner || auth.ownerLinkedIds.includes(userId)) {
    return "owner";
  }
  
  // Check explicit user record
  if (auth.users[userId]) {
    return auth.users[userId].role;
  }
  
  // Check if user is a linked ID for another user
  for (const [, user] of Object.entries(auth.users)) {
    if (user.linkedIds.includes(userId)) {
      return user.role;
    }
  }
  
  // Fall back to workspace default
  if (workspaceId && auth.workspaces[workspaceId]) {
    return auth.workspaces[workspaceId].defaultRole;
  }
  
  // Global default is guest
  return "guest";
}

/**
 * Check if user has at least the required role level
 */
export function hasRole(userId: string, requiredRole: Role, workspaceId?: string): boolean {
  const userRole = getUserRole(userId, workspaceId);
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
}

/**
 * Check if user can manage another user's role
 */
export function canManageRole(managerId: string, targetRole: Role, workspaceId?: string): boolean {
  const managerRole = getUserRole(managerId, workspaceId);
  
  // Owner can manage anyone
  if (managerRole === "owner") return true;
  
  // Admin can manage member and guest
  if (managerRole === "admin" && (targetRole === "member" || targetRole === "guest")) {
    return true;
  }
  
  return false;
}

/**
 * Set a user's role
 */
export function setUserRole(
  targetUserId: string,
  role: Role,
  displayName: string,
  managerId: string,
  workspaceId?: string
): { success: boolean; error?: string } {
  const auth = loadAuth();
  
  // Verify manager has permission
  if (!canManageRole(managerId, role, workspaceId)) {
    return { 
      success: false, 
      error: `You don't have permission to set ${role} role` 
    };
  }
  
  // Can't change owner via this method
  if (role === "owner") {
    return { 
      success: false, 
      error: "Owner role can only be set via /jibot setowner" 
    };
  }
  
  // Can't demote owner
  if (targetUserId === auth.owner || auth.ownerLinkedIds.includes(targetUserId)) {
    return { 
      success: false, 
      error: "Cannot change owner's role" 
    };
  }
  
  // Set the role
  auth.users[targetUserId] = {
    displayName,
    role,
    linkedIds: auth.users[targetUserId]?.linkedIds || [],
    addedBy: managerId,
    addedAt: new Date().toISOString()
  };
  
  saveAuth(auth);
  return { success: true };
}

/**
 * Remove a user's explicit role (they revert to workspace/global default)
 */
export function removeUserRole(
  targetUserId: string,
  managerId: string,
  workspaceId?: string
): { success: boolean; error?: string } {
  const auth = loadAuth();
  
  // Get target's current role to check permissions
  const targetRole = getUserRole(targetUserId, workspaceId);
  
  if (!canManageRole(managerId, targetRole, workspaceId)) {
    return { 
      success: false, 
      error: `You don't have permission to remove ${targetRole} role` 
    };
  }
  
  if (!auth.users[targetUserId]) {
    return { 
      success: false, 
      error: "User doesn't have an explicit role" 
    };
  }
  
  delete auth.users[targetUserId];
  saveAuth(auth);
  return { success: true };
}

/**
 * Set workspace default role
 */
export function setWorkspaceDefault(
  workspaceId: string,
  defaultRole: Role,
  managerId: string,
  workspaceName?: string
): { success: boolean; error?: string } {
  // Only owner and admin can set workspace defaults
  if (!hasRole(managerId, "admin")) {
    return { 
      success: false, 
      error: "Only owner and admins can set workspace defaults" 
    };
  }
  
  const auth = loadAuth();
  
  auth.workspaces[workspaceId] = {
    defaultRole,
    name: workspaceName
  };
  
  saveAuth(auth);
  return { success: true };
}

/**
 * Link another Slack ID to a user
 */
export function linkUserId(
  primaryUserId: string,
  linkedUserId: string,
  managerId: string
): { success: boolean; error?: string } {
  const auth = loadAuth();
  
  // Check if manager can do this
  const targetRole = getUserRole(primaryUserId);
  
  // Owner can link their own IDs
  if (managerId === auth.owner || auth.ownerLinkedIds.includes(managerId)) {
    if (primaryUserId === auth.owner) {
      if (!auth.ownerLinkedIds.includes(linkedUserId)) {
        auth.ownerLinkedIds.push(linkedUserId);
        saveAuth(auth);
      }
      return { success: true };
    }
  }
  
  // Otherwise need permission to manage this user's role
  if (!canManageRole(managerId, targetRole)) {
    return { 
      success: false, 
      error: "You don't have permission to link IDs for this user" 
    };
  }
  
  if (!auth.users[primaryUserId]) {
    return { 
      success: false, 
      error: "User doesn't have an explicit role" 
    };
  }
  
  if (!auth.users[primaryUserId].linkedIds.includes(linkedUserId)) {
    auth.users[primaryUserId].linkedIds.push(linkedUserId);
    saveAuth(auth);
  }
  
  return { success: true };
}

/**
 * List all users with explicit roles
 */
export function listUsers(): { 
  owner: { id: string; linkedIds: string[] };
  users: Array<{ id: string; displayName: string; role: Role; linkedIds: string[] }>;
  workspaces: Array<{ id: string; name?: string; defaultRole: Role }>;
} {
  const auth = loadAuth();
  
  return {
    owner: {
      id: auth.owner,
      linkedIds: auth.ownerLinkedIds
    },
    users: Object.entries(auth.users).map(([id, user]) => ({
      id,
      displayName: user.displayName,
      role: user.role,
      linkedIds: user.linkedIds
    })),
    workspaces: Object.entries(auth.workspaces).map(([id, ws]) => ({
      id,
      name: ws.name,
      defaultRole: ws.defaultRole
    }))
  };
}

/**
 * Get role display name with emoji
 */
export function roleDisplay(role: Role): string {
  switch (role) {
    case "owner": return "👑 Owner";
    case "admin": return "⭐ Admin";
    case "member": return "👤 Member";
    case "guest": return "👻 Guest";
  }
}
