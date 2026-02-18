/**
 * Vibecheck URL Collection for Jibot 3
 * 
 * Listens to #ai-tools channel in Slack and adds URLs to vibecheck database.
 * Uses direct PostgreSQL connection (same as vibecheck scripts).
 */

import pg from "pg";

// Slack unfurls URLs with <url|display> format
const SLACK_URL_REGEX = /<(https?:\/\/[^|>]+)(?:\|[^>]*)?>|https?:\/\/[^\s<>"|]+/gi;

interface UrlMetadata {
  url: string;
  title: string | null;
  description: string | null;
  domain: string;
}

interface SlackContext {
  author: string;
  channel: string;
  channelName: string;
  messageTs: string;
  team: string;
}

let dbPool: pg.Pool | null = null;
let watchedChannels: Map<string, string> = new Map(); // channelId -> communitySlug

/**
 * Initialize vibecheck integration
 */
export function initVibecheck(): boolean {
  const dbPassword = process.env.VIBECHECK_DB_PASSWORD;
  
  if (!dbPassword) {
    console.log('[Vibecheck] VIBECHECK_DB_PASSWORD not set, skipping');
    return false;
  }
  
  // Parse watched channels from env
  // Format: VIBECHECK_SLACK_CHANNELS="channel_id1:community1,channel_id2:community2"
  const channelsEnv = process.env.VIBECHECK_SLACK_CHANNELS || '';
  for (const pair of channelsEnv.split(',')) {
    const [channelId, community] = pair.split(':').map(s => s.trim());
    if (channelId && community) {
      watchedChannels.set(channelId, community);
    }
  }
  
  if (watchedChannels.size === 0) {
    console.log('[Vibecheck] No channels configured in VIBECHECK_SLACK_CHANNELS');
    return false;
  }
  
  // Create PostgreSQL connection pool
  dbPool = new pg.Pool({
    host: 'db.pycvrvounfzlrwjdmuij.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: dbPassword,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
  });
  
  console.log(`[Vibecheck] Watching ${watchedChannels.size} channel(s) for URLs`);
  return true;
}

/**
 * Check if a channel should be watched
 */
export function shouldWatchChannel(channelId: string): boolean {
  return watchedChannels.has(channelId);
}

/**
 * Get community slug for a channel
 */
export function getCommunityForChannel(channelId: string): string | undefined {
  return watchedChannels.get(channelId);
}

/**
 * Extract URLs from Slack message text
 */
export function extractUrls(text: string): string[] {
  const urls: string[] = [];
  let match;
  
  // Reset regex state
  SLACK_URL_REGEX.lastIndex = 0;
  
  while ((match = SLACK_URL_REGEX.exec(text)) !== null) {
    // match[1] is the URL from <url|display> format, or match[0] is plain URL
    const url = match[1] || match[0];
    if (url && !urls.includes(url)) {
      urls.push(url);
    }
  }
  
  return urls;
}

/**
 * Fetch metadata (title, description) from a URL
 */
export async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  const domain = new URL(url).hostname.replace(/^www\./, '');
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Jibot/3.0; +https://github.com/Joi/jibot-3)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      return { url, title: null, description: null, domain };
    }
    
    const html = await response.text();
    
    // Extract title (prefer og:title)
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = ogTitleMatch?.[1] || titleMatch?.[1] || null;
    
    // Extract description (prefer og:description)
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const description = ogDescMatch?.[1] || metaDescMatch?.[1] || null;
    
    return {
      url,
      title: title?.trim().replace(/\s+/g, ' ').slice(0, 500) || null,
      description: description?.trim().replace(/\s+/g, ' ').slice(0, 1000) || null,
      domain,
    };
  } catch (error) {
    console.log(`[Vibecheck] Failed to fetch metadata for ${url}:`, error instanceof Error ? error.message : error);
    return { url, title: null, description: null, domain };
  }
}

/**
 * Generate a URL-safe slug from a title
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

/**
 * Add an article to the vibecheck database
 */
export async function addToVibecheck(
  metadata: UrlMetadata,
  communitySlug: string,
  context: SlackContext
): Promise<{ success: boolean; isNew: boolean; slug?: string }> {
  if (!dbPool) {
    return { success: false, isNew: false };
  }
  
  const client = await dbPool.connect();
  try {
    // Check if article already exists by URL
    const existing = await client.query(
      'SELECT id, slug FROM articles WHERE url = $1',
      [metadata.url]
    );
    
    if (existing.rows.length > 0) {
      console.log(`[Vibecheck] Article already exists: ${metadata.url}`);
      return { success: true, isNew: false, slug: existing.rows[0].slug };
    }
    
    // Create article
    const title = metadata.title || metadata.domain;
    const slug = slugify(title) + '-' + Date.now().toString(36);
    const sourceContext = JSON.stringify({
      platform: 'slack',
      team: context.team,
      channel: context.channel,
      channel_name: context.channelName,
      author: context.author,
      message_ts: context.messageTs,
    });
    
    await client.query(
      `INSERT INTO articles (slug, url, title, summary, community_slug, source, source_context, discovered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [slug, metadata.url, title, metadata.description, communitySlug, 'slack', sourceContext]
    );
    
    console.log(`[Vibecheck] Added article: ${title} (${metadata.url})`);
    return { success: true, isNew: true, slug };
  } catch (error) {
    console.error(`[Vibecheck] Error adding to vibecheck:`, error);
    return { success: false, isNew: false };
  } finally {
    client.release();
  }
}

/**
 * Process a Slack message for URLs
 */
export async function processMessageForUrls(
  text: string,
  communitySlug: string,
  context: SlackContext
): Promise<{ processed: number; added: number }> {
  const urls = extractUrls(text);
  if (urls.length === 0) {
    return { processed: 0, added: 0 };
  }
  
  // Filter out common non-article URLs
  const validUrls = urls.filter(url => {
    const lower = url.toLowerCase();
    return !lower.includes('slack.com') &&
           !lower.includes('tenor.com') &&
           !lower.includes('giphy.com') &&
           !lower.includes('emoji') &&
           !lower.match(/\.(gif|jpg|jpeg|png|webp|mp4|mov)(\?|$)/i);
  });
  
  if (validUrls.length === 0) {
    return { processed: 0, added: 0 };
  }
  
  console.log(`[Vibecheck] Found ${validUrls.length} URL(s) from ${context.author} in #${context.channelName}`);
  
  let added = 0;
  for (const url of validUrls) {
    const metadata = await fetchUrlMetadata(url);
    const result = await addToVibecheck(metadata, communitySlug, context);
    if (result.isNew) {
      added++;
    }
  }
  
  return { processed: validUrls.length, added };
}

/**
 * Check if vibecheck is configured
 */
export function isVibecheckConfigured(): boolean {
  return dbPool !== null && watchedChannels.size > 0;
}
