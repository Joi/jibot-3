/**
 * Discord integration for Jibot 3
 * 
 * Listens to #ai-tools channel on Henkaku server and adds URLs to vibecheck database.
 */

import { Client, GatewayIntentBits, Message, Partials } from "discord.js";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// URL regex that captures common URL patterns
const URL_REGEX = /https?:\/\/[^\s<>"\])}]+/gi;

// Channels to watch (can be extended)
const WATCHED_CHANNELS: Record<string, string> = {
  // channel-id: community-slug
  // Will be populated from env
};

interface UrlMetadata {
  url: string;
  title: string | null;
  description: string | null;
  domain: string;
}

/**
 * Fetch metadata (title, description) from a URL
 */
async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  const domain = new URL(url).hostname.replace(/^www\./, '');
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
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
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    const title = ogTitleMatch?.[1] || titleMatch?.[1] || null;
    
    // Extract description
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const description = ogDescMatch?.[1] || metaDescMatch?.[1] || null;
    
    return {
      url,
      title: title?.trim().slice(0, 500) || null,
      description: description?.trim().slice(0, 1000) || null,
      domain,
    };
  } catch (error) {
    console.log(`[Discord] Failed to fetch metadata for ${url}:`, error instanceof Error ? error.message : error);
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
    .slice(0, 100);
}

/**
 * Add an article to the vibecheck database
 */
async function addToVibecheck(
  supabase: SupabaseClient,
  metadata: UrlMetadata,
  communitySlug: string,
  discordContext: { author: string; channel: string; messageId: string }
): Promise<boolean> {
  try {
    // Check if article already exists by URL
    const { data: existing } = await supabase
      .from('articles')
      .select('id, slug')
      .eq('url', metadata.url)
      .maybeSingle();
    
    if (existing) {
      console.log(`[Discord] Article already exists: ${metadata.url}`);
      return false;
    }
    
    // Create article
    const title = metadata.title || metadata.domain;
    const slug = slugify(title) + '-' + Date.now().toString(36);
    
    const { error } = await supabase
      .from('articles')
      .insert({
        slug,
        url: metadata.url,
        title,
        summary: metadata.description,
        community_slug: communitySlug,
        source: 'discord',
        source_context: {
          platform: 'discord',
          channel: discordContext.channel,
          author: discordContext.author,
          message_id: discordContext.messageId,
        },
        discovered_at: new Date().toISOString(),
      });
    
    if (error) {
      console.error(`[Discord] Failed to insert article:`, error);
      return false;
    }
    
    console.log(`[Discord] Added article: ${title} (${metadata.url})`);
    return true;
  } catch (error) {
    console.error(`[Discord] Error adding to vibecheck:`, error);
    return false;
  }
}

/**
 * Process a Discord message for URLs
 */
async function processMessage(
  message: Message,
  supabase: SupabaseClient,
  communitySlug: string
): Promise<void> {
  // Skip bot messages
  if (message.author.bot) return;
  
  // Extract URLs from message
  const urls = message.content.match(URL_REGEX);
  if (!urls || urls.length === 0) return;
  
  // Deduplicate URLs
  const uniqueUrls = [...new Set(urls)];
  
  console.log(`[Discord] Found ${uniqueUrls.length} URL(s) in message from ${message.author.username}`);
  
  for (const url of uniqueUrls) {
    // Skip Discord CDN links, tenor gifs, etc.
    if (url.includes('cdn.discordapp.com') || 
        url.includes('tenor.com') || 
        url.includes('giphy.com')) {
      continue;
    }
    
    const metadata = await fetchUrlMetadata(url);
    const channelName = message.channel.isTextBased() && 'name' in message.channel 
      ? (message.channel.name ?? 'unknown') 
      : 'unknown';
    await addToVibecheck(supabase, metadata, communitySlug, {
      author: message.author.username,
      channel: channelName,
      messageId: message.id,
    });
  }
}

/**
 * Initialize and start the Discord bot
 */
export async function startDiscordBot(): Promise<Client | null> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const supabaseUrl = process.env.VIBECHECK_SUPABASE_URL;
  const supabaseKey = process.env.VIBECHECK_SUPABASE_SERVICE_KEY;
  
  if (!token) {
    console.log('[Discord] DISCORD_BOT_TOKEN not set, skipping Discord integration');
    return null;
  }
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('[Discord] VIBECHECK_SUPABASE_URL or VIBECHECK_SUPABASE_SERVICE_KEY not set, skipping Discord integration');
    return null;
  }
  
  // Parse watched channels from env
  // Format: DISCORD_WATCH_CHANNELS="channel_id1:community1,channel_id2:community2"
  const watchChannelsEnv = process.env.DISCORD_WATCH_CHANNELS || '';
  for (const pair of watchChannelsEnv.split(',')) {
    const [channelId, community] = pair.split(':').map(s => s.trim());
    if (channelId && community) {
      WATCHED_CHANNELS[channelId] = community;
    }
  }
  
  if (Object.keys(WATCHED_CHANNELS).length === 0) {
    console.log('[Discord] No channels configured in DISCORD_WATCH_CHANNELS');
    return null;
  }
  
  console.log(`[Discord] Watching ${Object.keys(WATCHED_CHANNELS).length} channel(s)`);
  
  // Initialize Supabase client for vibecheck
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Create Discord client
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel],
  });
  
  client.once('ready', (c) => {
    console.log(`[Discord] Logged in as ${c.user.tag}`);
    console.log(`[Discord] Watching channels: ${Object.keys(WATCHED_CHANNELS).join(', ')}`);
  });
  
  client.on('messageCreate', async (message) => {
    // Check if message is in a watched channel
    const communitySlug = WATCHED_CHANNELS[message.channelId];
    if (!communitySlug) return;
    
    await processMessage(message, supabase, communitySlug);
  });
  
  client.on('error', (error) => {
    console.error('[Discord] Client error:', error);
  });
  
  // Login
  try {
    await client.login(token);
    return client;
  } catch (error) {
    console.error('[Discord] Failed to login:', error);
    return null;
  }
}

/**
 * Get Discord channel ID by name (utility function)
 */
export async function findChannelByName(client: Client, guildId: string, channelName: string): Promise<string | null> {
  try {
    const guild = await client.guilds.fetch(guildId);
    const channels = await guild.channels.fetch();
    const channel = channels.find(c => c?.name === channelName);
    return channel?.id || null;
  } catch (error) {
    console.error('[Discord] Failed to find channel:', error);
    return null;
  }
}
