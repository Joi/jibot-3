#!/bin/bash
# Uninstall jibot launchd jobs
# Usage: ./uninstall.sh [primary|workspace2|all]

set -e

LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
USER_ID=$(id -u)

uninstall_primary() {
    echo "Uninstalling jibot-primary..."
    
    # Unload
    launchctl bootout gui/$USER_ID/com.amplifier.jibot-primary 2>/dev/null || true
    
    # Remove plist
    rm -f "$LAUNCH_AGENTS/com.amplifier.jibot-primary.plist"
    
    echo "✓ jibot-primary uninstalled"
}

uninstall_workspace2() {
    echo "Uninstalling jibot-workspace2..."
    
    # Unload
    launchctl bootout gui/$USER_ID/com.amplifier.jibot-workspace2 2>/dev/null || true
    
    # Remove plist
    rm -f "$LAUNCH_AGENTS/com.amplifier.jibot-workspace2.plist"
    
    echo "✓ jibot-workspace2 uninstalled"
}

uninstall_legacy() {
    echo "Cleaning up legacy jobs..."
    
    # Unload old-style jobs if they exist
    launchctl bootout gui/$USER_ID/com.joi.jibot 2>/dev/null || true
    launchctl bootout gui/$USER_ID/com.joi.jibot2 2>/dev/null || true
    
    # Remove old plists
    rm -f "$LAUNCH_AGENTS/com.joi.jibot.plist"
    rm -f "$LAUNCH_AGENTS/com.joi.jibot2.plist"
    
    echo "✓ Legacy jobs cleaned up"
}

case "${1:-all}" in
    primary)
        uninstall_primary
        ;;
    workspace2)
        uninstall_workspace2
        ;;
    legacy)
        uninstall_legacy
        ;;
    all)
        uninstall_primary
        uninstall_workspace2
        uninstall_legacy
        ;;
    *)
        echo "Usage: $0 [primary|workspace2|legacy|all]"
        exit 1
        ;;
esac

echo ""
echo "Done! Verify with: launchctl list | grep -E 'jibot|amplifier'"
