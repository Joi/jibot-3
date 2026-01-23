#!/Users/joi/amplifier/.venv/bin/python3
"""
Amplifier Bridge for Jibot - Phase 2
"""

import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

AMPLIFIER_PATH = Path.home() / "amplifier"
sys.path.insert(0, str(AMPLIFIER_PATH))

def output(success: bool, data=None, error=None):
    result = {"success": success}
    if data is not None:
        result["data"] = data
    if error is not None:
        result["error"] = str(error)
    print(json.dumps(result))
    sys.exit(0 if success else 1)


async def gmail_search(query: str, max_results: int = 10):
    """Search Gmail messages."""
    try:
        from amplifier.skills.gmail import search_messages
        
        messages = await search_messages(query, max_results=max_results)
        
        results = []
        for msg in messages[:max_results]:
            # Convert EmailAddress to string
            sender_str = str(msg.sender) if msg.sender else None
            
            results.append({
                "id": msg.id,
                "subject": msg.subject,
                "sender": sender_str,
                "date": msg.date.isoformat() if msg.date else None,
                "snippet": msg.snippet[:200] if msg.snippet else None
            })
        
        output(True, {"messages": results, "count": len(results)})
    except Exception as e:
        output(False, error=f"Gmail search failed: {e}")


async def gmail_read(message_id: str):
    """Read a specific Gmail message."""
    try:
        from amplifier.skills.gmail import get_message
        
        msg = await get_message(message_id)
        
        # Convert EmailAddress objects to strings
        sender_str = str(msg.sender) if msg.sender else None
        to_str = [str(addr) for addr in msg.to] if msg.to else []
        
        output(True, {
            "id": msg.id,
            "subject": msg.subject,
            "sender": sender_str,
            "to": to_str,
            "date": msg.date.isoformat() if msg.date else None,
            "body": msg.body_text[:2000] if msg.body_text else None
        })
    except Exception as e:
        output(False, error=f"Gmail read failed: {e}")


async def calendar_list(when: str = "today"):
    """List calendar events using string time specs."""
    try:
        from amplifier.skills.google_calendar import list_events
        
        if when == "today":
            events = await list_events(time_min="today", time_max="tomorrow", max_results=20)
        elif when == "tomorrow":
            events = await list_events(time_min="tomorrow", time_max="in 2 days", max_results=20)
        elif when == "this week":
            events = await list_events(time_min="today", time_max="in 7 days", max_results=30)
        elif when == "next week":
            events = await list_events(time_min="in 7 days", time_max="in 14 days", max_results=30)
        else:
            events = await list_events(max_results=20)
        
        results = []
        for event in events:
            results.append({
                "id": event.id,
                "summary": event.summary or "No title",
                "start": event.start.isoformat() if event.start else None,
                "end": event.end.isoformat() if event.end else None,
                "location": event.location,
                "description": event.description[:200] if event.description else None,
                "all_day": event.all_day
            })
        
        output(True, {"events": results, "count": len(results), "period": when})
    except Exception as e:
        output(False, error=f"Calendar list failed: {e}")


async def calendar_create(summary: str, start_time: str, end_time: str = None, description: str = None):
    """Create a calendar event."""
    try:
        from amplifier.skills.google_calendar import create_event
        
        event = await create_event(
            summary=summary,
            start=start_time,
            end=end_time,
            description=description
        )
        
        output(True, {
            "id": event.id,
            "summary": event.summary,
            "start": event.start.isoformat() if event.start else None,
            "html_link": event.html_link
        })
    except Exception as e:
        output(False, error=f"Calendar create failed: {e}")


async def calendar_quick_add(text: str):
    """Quick add calendar event with natural language."""
    try:
        from amplifier.skills.google_calendar import quick_add
        
        event = await quick_add(text)
        
        output(True, {
            "id": event.id,
            "summary": event.summary,
            "start": event.start.isoformat() if event.start else None,
            "html_link": event.html_link
        })
    except Exception as e:
        output(False, error=f"Calendar quick_add failed: {e}")


def reminders_list(list_name: str = "Jibot"):
    """List reminders from Apple Reminders."""
    try:
        from amplifier.skills.apple_reminders import list_reminders
        
        reminders = list_reminders(list_name=list_name)
        
        results = []
        for r in reminders:
            results.append({
                "id": r.id,
                "title": r.title,
                "notes": r.notes,
                "due_date": r.due_date,
                "completed": r.completed
            })
        
        output(True, {"reminders": results, "count": len(results), "list": list_name})
    except Exception as e:
        output(False, error=f"Reminders list failed: {e}")


def reminders_add(title: str, list_name: str = "Jibot", notes: str = None, due_date: str = None):
    """Add a reminder to Apple Reminders."""
    try:
        from amplifier.skills.apple_reminders import add_reminder
        
        reminder = add_reminder(
            title=title,
            list_name=list_name,
            notes=notes,
            due_date=due_date
        )
        
        output(True, {"id": reminder.id, "title": reminder.title})
    except Exception as e:
        output(False, error=f"Reminders add failed: {e}")


async def weather_get(location: str = "Tokyo"):
    """Get current weather using wttr.in."""
    try:
        import httpx
        from urllib.parse import quote
        
        # wttr.in provides simple weather output
        url = f"https://wttr.in/{quote(location)}?format=%l:+%c+%t+%h+humidity,+%w+wind,+%p+precip"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers={
                "User-Agent": "curl/7.64.1"  # wttr.in prefers curl-like UA
            }, timeout=10)
            response.raise_for_status()
            weather = response.text.strip()
        
        # Also get a more detailed view
        url_detail = f"https://wttr.in/{quote(location)}?format=%l\\n%c+%C\\nTemp:+%t+(feels+like+%f)\\nHumidity:+%h\\nWind:+%w\\nPrecip:+%p\\nUV:+%u\\nSunrise:+%S+/+Sunset:+%s"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url_detail, headers={
                "User-Agent": "curl/7.64.1"
            }, timeout=10)
            detail = response.text.strip()
        
        output(True, {"location": location, "summary": weather, "detail": detail})
    except Exception as e:
        output(False, error=f"Weather fetch failed: {e}")


def main():
    if len(sys.argv) < 3:
        output(False, error="Usage: amplifier_bridge.py <skill> <action> [args...]")
        return
    
    skill = sys.argv[1]
    action = sys.argv[2]
    args = sys.argv[3:]
    
    if skill == "gmail":
        if action == "search":
            query = args[0] if args else ""
            max_results = int(args[1]) if len(args) > 1 else 10
            asyncio.run(gmail_search(query, max_results))
        elif action == "read":
            if not args:
                output(False, error="Message ID required")
            asyncio.run(gmail_read(args[0]))
        else:
            output(False, error=f"Unknown gmail action: {action}")
    
    elif skill == "calendar":
        if action == "list":
            when = args[0] if args else "today"
            asyncio.run(calendar_list(when))
        elif action == "create":
            if len(args) < 2:
                output(False, error="Usage: calendar create <summary> <start_time> [end_time] [description]")
            asyncio.run(calendar_create(args[0], args[1], 
                                        args[2] if len(args) > 2 else None,
                                        args[3] if len(args) > 3 else None))
        elif action == "quick":
            if not args:
                output(False, error="Event description required")
            asyncio.run(calendar_quick_add(" ".join(args)))
        else:
            output(False, error=f"Unknown calendar action: {action}")
    
    elif skill == "reminders":
        if action == "list":
            list_name = args[0] if args else "Jibot"
            reminders_list(list_name)
        elif action == "add":
            if not args:
                output(False, error="Reminder title required")
            reminders_add(args[0],
                                      args[1] if len(args) > 1 else "Jibot",
                                      args[2] if len(args) > 2 else None,
                                      args[3] if len(args) > 3 else None)
        else:
            output(False, error=f"Unknown reminders action: {action}")
    
    elif skill == "weather":
        location = args[0] if args else "Tokyo"
        asyncio.run(weather_get(location))
    
    elif skill == "web":
        if action == "search":
            query = args[0] if args else ""
            max_results = int(args[1]) if len(args) > 1 else 5
            asyncio.run(web_search(query, max_results))
        elif action == "fetch":
            if not args:
                output(False, error="URL required")
            else:
                max_chars = int(args[1]) if len(args) > 1 else 5000
                asyncio.run(web_fetch(args[0], max_chars))
        else:
            output(False, error=f"Unknown web action: {action}")
    
    else:
        output(False, error=f"Unknown skill: {skill}")

async def web_search(query: str, max_results: int = 5):
    """Search the web using DuckDuckGo."""
    try:
        import httpx
        from urllib.parse import quote_plus
        
        # Use DuckDuckGo HTML search (no API key needed)
        url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
            }, timeout=10)
            response.raise_for_status()
            html = response.text
        
        # Parse results (simple regex extraction)
        import re
        results = []
        
        # Find result blocks
        result_pattern = r'<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([^<]+)</a>'
        snippet_pattern = r'<a class="result__snippet"[^>]*>([^<]+)</a>'
        
        links = re.findall(result_pattern, html)
        snippets = re.findall(snippet_pattern, html)
        
        for i, (url, title) in enumerate(links[:max_results]):
            snippet = snippets[i] if i < len(snippets) else ""
            results.append({
                "title": title.strip(),
                "url": url,
                "snippet": snippet.strip()[:200]
            })
        
        output(True, {"results": results, "count": len(results), "query": query})
    except Exception as e:
        output(False, error=f"Web search failed: {e}")


async def web_fetch(url: str, max_chars: int = 5000):
    """Fetch and extract text content from a URL."""
    try:
        import httpx
        import re
        
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
            }, timeout=15)
            response.raise_for_status()
            html = response.text
        
        # Simple HTML to text conversion
        # Remove script and style tags
        html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
        
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', ' ', html)
        
        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Decode HTML entities
        import html as html_module
        text = html_module.unescape(text)
        
        # Truncate
        if len(text) > max_chars:
            text = text[:max_chars] + "..."
        
        output(True, {"url": url, "content": text, "length": len(text)})
    except Exception as e:
        output(False, error=f"Web fetch failed: {e}")


if __name__ == "__main__":
    main()



