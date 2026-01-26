#!/bin/bash
# Slack Post Helper - Post messages via Jibot or Chanoyu Adventure bot
#
# Usage:
#   slack-post.sh [--bot jibot|chanoyu] <channel> <message> [--user <name>]
#
# Examples:
#   slack-post.sh "#general" "Hello world!"
#   slack-post.sh --bot chanoyu "#chanoyu-adventure" "I'm back!" --user "Madoka Tachibana"
#   slack-post.sh --bot jibot "#ai-tools" "Testing the new post feature"

set -e

BOT="jibot"
CHANNEL=""
MESSAGE=""
USER=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --bot)
      BOT="$2"
      shift 2
      ;;
    --user)
      USER="$2"
      shift 2
      ;;
    *)
      if [[ -z "$CHANNEL" ]]; then
        CHANNEL="$1"
      else
        MESSAGE="$1"
      fi
      shift
      ;;
  esac
done

if [[ -z "$CHANNEL" || -z "$MESSAGE" ]]; then
  echo "Usage: slack-post.sh [--bot jibot|chanoyu] <channel> <message> [--user <name>]"
  exit 1
fi

if [[ "$BOT" == "jibot" ]]; then
  # Use Jibot's API
  if [[ -n "$USER" ]]; then
    JSON=$(jq -n --arg c "$CHANNEL" --arg m "$MESSAGE" --arg u "$USER" \
      '{channel: $c, message: $m, user: $u}')
  else
    JSON=$(jq -n --arg c "$CHANNEL" --arg m "$MESSAGE" \
      '{channel: $c, message: $m}')
  fi
  
  RESULT=$(curl -s -X POST http://localhost:3001/api/slack/post \
    -H "Content-Type: application/json" \
    -d "$JSON")
  
  if echo "$RESULT" | jq -e '.success' > /dev/null 2>&1; then
    echo "✅ Posted to $CHANNEL via Jibot"
  else
    echo "❌ Failed: $(echo "$RESULT" | jq -r '.error // "Unknown error"')"
    exit 1
  fi

elif [[ "$BOT" == "chanoyu" ]]; then
  # Use Chanoyu Adventure bot directly
  source ~/chanoyu-adventure/.env.local 2>/dev/null || true
  TOKEN="${SLACK_BOT_TOKEN:-}"
  
  if [[ -z "$TOKEN" ]]; then
    echo "❌ SLACK_BOT_TOKEN not found in ~/chanoyu-adventure/.env.local"
    exit 1
  fi
  
  # Look up channel ID if name provided
  CHANNEL_NAME="${CHANNEL#\#}"
  CHANNEL_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "https://slack.com/api/users.conversations?types=public_channel,private_channel&limit=500" | \
    jq -r --arg n "$CHANNEL_NAME" '.channels[] | select(.name == $n) | .id')
  
  if [[ -z "$CHANNEL_ID" ]]; then
    echo "❌ Channel '$CHANNEL' not found"
    exit 1
  fi
  
  # Look up user ID if provided
  FINAL_MESSAGE="$MESSAGE"
  if [[ -n "$USER" ]]; then
    USER_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
      "https://slack.com/api/users.list?limit=500" | \
      jq -r --arg n "$USER" '.members[] | select(.real_name | ascii_downcase | contains($n | ascii_downcase)) | .id' | head -1)
    
    if [[ -n "$USER_ID" ]]; then
      FINAL_MESSAGE="<@$USER_ID> $MESSAGE"
    fi
  fi
  
  # Post message
  RESULT=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg c "$CHANNEL_ID" --arg m "$FINAL_MESSAGE" '{channel: $c, text: $m}')" \
    "https://slack.com/api/chat.postMessage")
  
  if echo "$RESULT" | jq -e '.ok == true' > /dev/null 2>&1; then
    echo "✅ Posted to #$CHANNEL_NAME via Chanoyu Adventure bot"
  else
    echo "❌ Failed: $(echo "$RESULT" | jq -r '.error // "Unknown error"')"
    exit 1
  fi

else
  echo "❌ Unknown bot: $BOT (use 'jibot' or 'chanoyu')"
  exit 1
fi
