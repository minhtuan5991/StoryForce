from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import sys
import threading
import time
import urllib.request
import webbrowser

if not getattr(sys,"frozen",False):
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.config import default_data_root, RESOURCE_ROOT, APP_ROOT, VERSION
from launcher.updater import apply_pending, start_check


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--no-browser",action="store_true")
    parser.add_argument("--data-root")
    parser.add_argument("--helper",choices=["data","logs","bridge","stop"])
    args=parser.parse_args()
    if args.data_root:os.environ["STORYFORGE_DATA_ROOT"]=args.data_root
    root=default_data_root()
    root.mkdir(parents=True,exist_ok=True)
    if args.helper:
        # During a pending data-root switch, helpers must address the running workspace.
        try:
            with urllib.request.urlopen("http://127.0.0.1:8787/api/health",timeout=1) as response:
                active=json.load(response)
                if active.get("app")=="StoryForge US":root=Path(active["data_root"])
        except Exception:pass
        if args.helper=="bridge":
            import subprocess
            extension=(APP_ROOT/"browser-extension") if (APP_ROOT/"browser-extension").is_dir() else RESOURCE_ROOT/"browser-extension"
            subprocess.run(["clip.exe"],input=str(extension),text=True,creationflags=subprocess.CREATE_NO_WINDOW)
            os.startfile(str(extension))
            webbrowser.open("http://127.0.0.1:8787/#/settings/bridge")
            import ctypes
            ctypes.windll.user32.MessageBoxW(0,"Extension path copied to clipboard.\n\nOpen edge://extensions or chrome://extensions.\nEnable Developer mode > Load unpacked > paste the folder path.\n\nThen pair the extension from StoryForge Settings.","Install / Reload StoryForge Browser Bridge",0)
        elif args.helper=="stop":
            # The running process owns this sentinel; never kill unrelated Python processes.
            (root/"stop.request").write_text("stop",encoding="utf-8")
        else:
            folder=root/"logs" if args.helper=="logs" else root
            folder.mkdir(parents=True,exist_ok=True);os.startfile(str(folder))
        return
    try:
        with urllib.request.urlopen("http://127.0.0.1:8787/api/health",timeout=1) as response:
            info=json.load(response)
            if info.get("app")=="StoryForge US":
                if not args.no_browser:webbrowser.open("http://127.0.0.1:8787")
                return
    except Exception:pass
    if apply_pending(root, APP_ROOT, VERSION, RESOURCE_ROOT):
        return
    import uvicorn
    from backend.api import create_app
    app=create_app(root)
    start_check(root, APP_ROOT, VERSION)
    server=uvicorn.Server(uvicorn.Config(app,host="127.0.0.1",port=8787,log_config=None,access_log=False))
    sentinel=root/"stop.request"
    if sentinel.exists():sentinel.unlink()
    def monitor():
        opened=False
        while not server.should_exit:
            if sentinel.exists():
                sentinel.unlink();server.should_exit=True;return
            if server.started and not opened:
                if not args.no_browser:webbrowser.open("http://127.0.0.1:8787")
                opened=True
            time.sleep(.5)
    threading.Thread(target=monitor,daemon=True).start()
    server.run()

if __name__=="__main__":
    try:main()
    except Exception as exc:
        import traceback
        root=default_data_root();(root/"logs").mkdir(parents=True,exist_ok=True)
        (root/"logs"/"startup-error.log").write_text(traceback.format_exc(),encoding="utf-8")
        if getattr(sys,"frozen",False):
            import ctypes
            ctypes.windll.user32.MessageBoxW(0,f"StoryForge could not start.\n{exc}\n\nSee {root / 'logs' / 'startup-error.log'}","StoryForge US",16)
        else:raise
