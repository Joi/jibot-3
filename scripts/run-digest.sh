#!/bin/bash
# Daily digest runner
cd ~/jibot-3
source .env
export SLACK_BOT_TOKEN
npx ts-node scripts/daily-digest.ts 2>&1 | tee -a logs/digest.log
