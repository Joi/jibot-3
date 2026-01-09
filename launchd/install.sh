#!/bin/bash
# Install jibot launchd jobs
# Usage: ./install.sh [primary|workspace2|all]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JIBOT_DIR="$(dirname "$SCRIPT_DIR")"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
AMPLIFIER_LOGS="$HOME/.amplifier/launchd/logs"
USER_ID=$(id -u)

# Ensure directories exist
mkdir -p "$LAUNCH_AGENTS"
mkdir -p "$AMPLIFIER_LOGS"

install_primary() {
    echo "Installing jibot-primary..."
    
    # Unload if already running
    launchctl bootout gui/$USER_ID/com.amplifier.jibot-primary 2>/dev/null || true
    # Also unload old name if exists
    launchctl bootout gui/$USER_ID/com.joi.jibot 2>/dev/null || true
    
    cat > "$LAUNCH_AGENTS/com.amplifier.jibot-primary.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.amplifier.jibot-primary</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-l</string>
        <string>-c</string>
        <string>cd $JIBOT_DIR && npm run dev</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$JIBOT_DIR</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$JIBOT_DIR/jibot.log</string>
    <key>StandardErrorPath</key>
    <string>$JIBOT_DIR/jibot.log</string>
</dict>
</plist>
EOF
    
    launchctl bootstrap gui/$USER_ID "$LAUNCH_AGENTS/com.amplifier.jibot-primary.plist"
    echo "✓ jibot-primary installed and started"
}

install_workspace2() {
    echo "Installing jibot-workspace2..."
    
    # Unload if already running
    launchctl bootout gui/$USER_ID/com.amplifier.jibot-workspace2 2>/dev/null || true
    # Also unload old name if exists
    launchctl bootout gui/$USER_ID/com.joi.jibot2 2>/dev/null || true
    
    cat > "$LAUNCH_AGENTS/com.amplifier.jibot-workspace2.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.amplifier.jibot-workspace2</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-l</string>
        <string>-c</string>
        <string>cd $JIBOT_DIR && env \$(cat .env.workspace2 | grep -v '^#' | xargs) npm run start</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$JIBOT_DIR</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$JIBOT_DIR/jibot2.log</string>
    <key>StandardErrorPath</key>
    <string>$JIBOT_DIR/jibot2.log</string>
</dict>
</plist>
EOF
    
    launchctl bootstrap gui/$USER_ID "$LAUNCH_AGENTS/com.amplifier.jibot-workspace2.plist"
    echo "✓ jibot-workspace2 installed and started"
}

case "${1:-all}" in
    primary)
        install_primary
        ;;
    workspace2)
        install_workspace2
        ;;
    all)
        install_primary
        install_workspace2
        ;;
    *)
        echo "Usage: $0 [primary|workspace2|all]"
        exit 1
        ;;
esac

echo ""
echo "Done! Check status with: launchctl list | grep jibot"
