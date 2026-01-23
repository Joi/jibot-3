#!/bin/bash
# Jibot control script - manages both workspace instances
# Usage: jibot.sh [start|stop|restart|status] [1|2|all]

JIBOT_DIR="$HOME/jibot-3"

instance="${2:-all}"

stop_instance() {
    local num=$1
    echo "Stopping jibot${num}..."
    launchctl stop "com.joi.jibot${num}" 2>&1 | grep -v "No such process" || true
}

start_instance() {
    local num=$1
    echo "Starting jibot${num}..."
    launchctl start "com.joi.jibot${num}"
}

status_instance() {
    local num=$1
    local label="com.joi.jibot${num}"
    if launchctl list | grep -q "$label"; then
        local pid=$(launchctl list | grep "$label" | awk '{print $1}')
        if [ "$pid" != "-" ] && [ -n "$pid" ]; then
            echo "✅ Jibot ${num}: running (PID $pid)"
        else
            echo "⚠️  Jibot ${num}: loaded but not running"
        fi
    else
        echo "❌ Jibot ${num}: not loaded"
    fi
}

do_action() {
    local action=$1
    local num=$2
    local suffix=""
    [ "$num" = "1" ] && suffix="" || suffix="2"
    
    case "$action" in
        stop) stop_instance "$suffix" ;;
        start) start_instance "$suffix" ;;
        restart) stop_instance "$suffix"; sleep 1; start_instance "$suffix" ;;
        status) status_instance "$suffix" ;;
    esac
}

action="${1:-status}"

case "$instance" in
    1) do_action "$action" "1" ;;
    2) do_action "$action" "2" ;;
    all|"")
        do_action "$action" "1"
        do_action "$action" "2"
        ;;
    *)
        echo "Usage: jibot [start|stop|restart|status] [1|2|all]"
        exit 1
        ;;
esac
