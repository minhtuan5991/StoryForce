"""Export app and extension icons from the supplied, unmodified artwork."""
from pathlib import Path
from shutil import copyfile

from PIL import Image


root = Path(__file__).resolve().parents[1]
source = root / "assets" / "storyforge.ico"
for target in (root / "installer" / "storyforge.ico", root / "frontend" / "public" / "storyforge.ico"):
    target.parent.mkdir(parents=True, exist_ok=True)
    copyfile(source, target)

with Image.open(source) as icon:
    icon.ico.getimage((256, 256)).convert("RGBA").save(root / "frontend" / "public" / "brand.png")
    extension_icons = root / "browser-extension" / "icons"
    extension_icons.mkdir(parents=True, exist_ok=True)
    for size in (16, 32, 48, 128):
        icon.ico.getimage((size, size)).convert("RGBA").save(extension_icons / f"icon-{size}.png")

print("Exported app logo, Windows/favicon ICO and extension icons from assets/storyforge.ico")
