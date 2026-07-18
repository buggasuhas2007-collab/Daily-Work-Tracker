import os
import sys
import time
import json
import sqlite3
import threading
import ctypes
from ctypes import wintypes
from http.server import HTTPServer, BaseHTTPRequestHandler

# Setup path and directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "autologs.db")
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")

# State variables
is_paused = True
config = {}

# Windows Win32 API Definitions for active window tracking
user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

PROCESS_QUERY_LIMITED_INFORMATION = 0x1000

def get_active_window():
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return None, None
    
    # 1. Get Window Title
    length = user32.GetWindowTextLengthW(hwnd)
    title_buf = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, title_buf, length + 1)
    title = title_buf.value
    
    # 2. Get Window Process name (Executable name)
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    
    process_name = "unknown"
    # Open process with query access
    h_process = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if h_process:
        name_buf = ctypes.create_unicode_buffer(260)
        size = wintypes.DWORD(260)
        if kernel32.QueryFullProcessImageNameW(h_process, 0, name_buf, ctypes.byref(size)):
            process_name = os.path.basename(name_buf.value)
        kernel32.CloseHandle(h_process)
        
    return title, process_name

# Database setup
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS window_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            app TEXT NOT NULL,
            title TEXT NOT NULL,
            category TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

# Load config
def load_config():
    global config
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r") as f:
                config = json.load(f)
        except Exception as e:
            print(f"Error loading config: {e}")
            config = {}
    
    # Defaults if config is empty
    config.setdefault("ignored_apps", [])
    config.setdefault("ignored_keywords", [])
    config.setdefault("mappings", [])
    config.setdefault("default_category", "Personal")

def check_filters(title, app):
    # Check ignored apps
    for ignored_app in config.get("ignored_apps", []):
        if ignored_app.lower() == app.lower():
            return True
            
    # Check ignored keywords in title
    title_lower = title.lower()
    for keyword in config.get("ignored_keywords", []):
        if keyword.lower() in title_lower:
            return True
            
    return False

def map_category(title, app):
    # Match against process name or window title keywords
    title_lower = title.lower()
    app_lower = app.lower()
    
    for rule in config.get("mappings", []):
        match_val = rule["match"].lower()
        # Match process name or title keyword
        if match_val == app_lower or match_val in title_lower:
            return rule["category"]
            
    return config.get("default_category", "Personal")

# Background tracking loop
def tracking_loop():
    global is_paused
    print("Background tracking thread started.")
    init_db()
    
    while True:
        try:
            load_config() # Reload config dynamically in case of updates
            
            if not is_paused:
                title, app = get_active_window()
                
                # Verify we have valid foreground window details
                if title and app:
                    is_ignored = check_filters(title, app)
                    
                    if not is_ignored:
                        category = map_category(title, app)
                        timestamp = int(time.time())
                        
                        # Log to database
                        conn = sqlite3.connect(DB_PATH)
                        cursor = conn.cursor()
                        cursor.execute(
                            "INSERT INTO window_logs (timestamp, app, title, category) VALUES (?, ?, ?, ?)",
                            (timestamp, app, title, category)
                        )
                        conn.commit()
                        conn.close()
                        
                        print(f"[Logged] {app} | {category} | {title[:40]}...")
            
        except Exception as e:
            print(f"Error in tracking loop: {e}")
            
        time.sleep(10) # Log every 10 seconds

# HTTP API server to handle requests from the browser FlowTrack client
class APIHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        # Allow CORS
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200, "OK")
        self.end_headers()

    def do_GET(self):
        global is_paused
        
        if self.path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            
            status_json = json.dumps({"status": "paused" if is_paused else "active"})
            self.wfile.write(status_json.encode())
            
        elif self.path.startswith("/api/logs"):
            # Simple query param parser
            since = 0
            if "?" in self.path:
                params = self.path.split("?")[1]
                for param in params.split("&"):
                    if param.startswith("since="):
                        try:
                            since = int(param.split("=")[1])
                        except ValueError:
                            pass
            
            # Fetch from database
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT timestamp, app, title, category FROM window_logs WHERE timestamp >= ? ORDER BY timestamp ASC", (since,))
            rows = cursor.fetchall()
            conn.close()
            
            logs = [dict(row) for row in rows]
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"logs": logs}).encode())
            
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")

    def do_POST(self):
        global is_paused
        
        if self.path == "/api/toggle":
            is_paused = not is_paused
            print(f"Tracking state toggled: {'PAUSED' if is_paused else 'ACTIVE'}")
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "paused" if is_paused else "active"}).encode())
        else:
            self.send_response(404)
            self.end_headers()

def run_server(port=5001):
    server = HTTPServer(("localhost", port), APIHandler)
    print(f"API Server listening on http://localhost:{port}")
    print("Tracker started in PAUSED state. Enable it from the FlowTrack website to begin tracking.")
    server.serve_forever()

if __name__ == "__main__":
    # Start tracking background thread
    t = threading.Thread(target=tracking_loop, daemon=True)
    t.start()
    
    # Run the HTTP server in the main thread
    try:
        run_server()
    except KeyboardInterrupt:
        print("\nStopping desktop tracker...")
        sys.exit(0)
