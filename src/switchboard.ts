/**
 * Switchboard Integration
 * 
 * Reads from ~/switchboard to provide:
 * - Concept explanations (concepts/*.md)
 * - Organization lookups (organizations/*.md)
 */

import * as fs from "fs";
import * as path from "path";
import os from "os";

const SWITCHBOARD_DIR = path.join(os.homedir(), "switchboard");
const CONCEPTS_DIR = path.join(SWITCHBOARD_DIR, "concepts");
const ORGS_DIR = path.join(SWITCHBOARD_DIR, "organizations");

/**
 * Normalize a search term for matching
 */
function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Extract a summary from markdown content
 * Takes the first paragraph after any frontmatter/headers
 */
function extractSummary(content: string, maxLength: number = 500): string {
  // Remove YAML frontmatter if present
  let text = content.replace(/^---[\s\S]*?---\n*/m, "");
  
  // Remove the first H1 header (title)
  text = text.replace(/^#\s+.+\n*/m, "");
  
  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/).filter(p => {
    const trimmed = p.trim();
    // Skip headers, lists, code blocks, empty
    return trimmed && 
           !trimmed.startsWith("#") && 
           !trimmed.startsWith("-") &&
           !trimmed.startsWith("*") &&
           !trimmed.startsWith(">") &&
           !trimmed.startsWith("```") &&
           !trimmed.startsWith("|");
  });
  
  if (paragraphs.length === 0) {
    return "No summary available.";
  }
  
  // Take first 1-2 paragraphs up to maxLength
  let summary = "";
  for (const para of paragraphs) {
    const cleaned = para.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove markdown links
                        .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold
                        .replace(/\*([^*]+)\*/g, "$1") // Remove italic
                        .replace(/`([^`]+)`/g, "$1") // Remove code
                        .trim();
    
    if (summary.length + cleaned.length > maxLength) {
      if (summary) break;
      // First paragraph is too long, truncate it
      summary = cleaned.substring(0, maxLength - 3) + "...";
      break;
    }
    
    summary += (summary ? "\n\n" : "") + cleaned;
  }
  
  return summary || "No summary available.";
}

/**
 * List all files in a directory matching .md extension
 */
function listMarkdownFiles(dir: string): string[] {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith(".md"))
      .map(f => f.replace(/\.md$/, ""));
  } catch (error) {
    console.error(`Error listing ${dir}:`, error);
    return [];
  }
}

/**
 * Find the best matching file for a search term
 */
function findBestMatch(searchTerm: string, files: string[]): string | null {
  const normalizedSearch = normalize(searchTerm);
  
  // Exact match (case-insensitive)
  for (const file of files) {
    if (normalize(file) === normalizedSearch) {
      return file;
    }
  }
  
  // Starts with
  for (const file of files) {
    if (normalize(file).startsWith(normalizedSearch)) {
      return file;
    }
  }
  
  // Contains
  for (const file of files) {
    if (normalize(file).includes(normalizedSearch)) {
      return file;
    }
  }
  
  return null;
}

/**
 * Read a markdown file and return its content
 */
function readMarkdownFile(dir: string, filename: string): string | null {
  const filepath = path.join(dir, `${filename}.md`);
  try {
    if (fs.existsSync(filepath)) {
      return fs.readFileSync(filepath, "utf-8");
    }
  } catch (error) {
    console.error(`Error reading ${filepath}:`, error);
  }
  return null;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Look up a concept by name
 */
export function lookupConcept(searchTerm: string): { name: string; summary: string } | null {
  const concepts = listMarkdownFiles(CONCEPTS_DIR);
  const match = findBestMatch(searchTerm, concepts);
  
  if (!match) return null;
  
  const content = readMarkdownFile(CONCEPTS_DIR, match);
  if (!content) return null;
  
  return {
    name: match,
    summary: extractSummary(content),
  };
}

/**
 * Look up an organization by name
 */
export function lookupOrganization(searchTerm: string): { name: string; summary: string } | null {
  const orgs = listMarkdownFiles(ORGS_DIR);
  const match = findBestMatch(searchTerm, orgs);
  
  if (!match) return null;
  
  const content = readMarkdownFile(ORGS_DIR, match);
  if (!content) return null;
  
  return {
    name: match,
    summary: extractSummary(content),
  };
}

/**
 * List all available concepts
 */
export function listConcepts(): string[] {
  return listMarkdownFiles(CONCEPTS_DIR);
}

/**
 * List all available organizations
 */
export function listOrganizations(): string[] {
  return listMarkdownFiles(ORGS_DIR);
}

/**
 * Search across both concepts and organizations
 */
export function searchSwitchboard(searchTerm: string): {
  concepts: string[];
  organizations: string[];
} {
  const normalizedSearch = normalize(searchTerm);
  
  const concepts = listMarkdownFiles(CONCEPTS_DIR)
    .filter(c => normalize(c).includes(normalizedSearch));
  
  const organizations = listMarkdownFiles(ORGS_DIR)
    .filter(o => normalize(o).includes(normalizedSearch));
  
  return { concepts, organizations };
}
