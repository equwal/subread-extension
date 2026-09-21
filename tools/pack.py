"""Make the two store uploads: dist/subread-chrome.zip and dist/subread-firefox.zip.

The same files go to both stores. Chrome does not know the key
"browser_specific_settings" and warns about it, so the Chrome zip leaves it out.
"""
import json, pathlib, zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILES = ["popup.html", "LICENSE", *sorted(str(p.relative_to(ROOT)).replace("\\", "/")
         for d in ("src", "icons") for p in (ROOT / d).iterdir())]

def pack(name: str, manifest: dict) -> None:
    out = ROOT / "dist" / name
    out.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", json.dumps(manifest, indent=2))
        for f in FILES:
            z.write(ROOT / f, f)
    print(out.relative_to(ROOT), out.stat().st_size, "bytes")

manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
pack("subread-firefox.zip", manifest)
pack("subread-chrome.zip", {k: v for k, v in manifest.items() if k != "browser_specific_settings"})
