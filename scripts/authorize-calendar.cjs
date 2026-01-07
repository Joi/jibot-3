#!/usr/bin/env node
/**
 * Re-authorize Google Calendar with write access
 * 
 * Run: node scripts/authorize-calendar.js
 * Then paste the code when prompted
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CREDENTIALS_PATH = path.join(process.env.HOME, '.gcalendar', 'credentials.json');
const TOKEN_PATH = path.join(process.env.HOME, '.gcalendar', 'token.json');

// Full calendar access (read + write)
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

async function authorize() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const { client_id, client_secret, redirect_uris } = credentials.installed;
  
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Generate auth URL
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force re-consent to get new refresh token
  });

  console.log('\n📅 Google Calendar Authorization\n');
  console.log('1. Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\n2. Authorize the app and copy the code\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('3. Paste the code here: ', async (code) => {
    rl.close();
    
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      
      // Backup old token
      if (fs.existsSync(TOKEN_PATH)) {
        fs.renameSync(TOKEN_PATH, TOKEN_PATH + '.bak');
        console.log('\n✅ Backed up old token');
      }
      
      // Save new token
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log('✅ New token saved with write access!');
      console.log('\nScope:', tokens.scope);
      console.log('\nYou can now add events to the calendar.');
    } catch (error) {
      console.error('❌ Error getting token:', error.message);
    }
  });
}

authorize();
