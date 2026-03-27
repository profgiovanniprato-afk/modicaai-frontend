#!/usr/bin/env python3
"""
bump_version.py — ModicaAI Cache Busting
=========================================
Aggiorna la CACHE_VERSION in sw.js con la data/ora corrente,
poi aggiunge ?v=YYYYMMDD-HH a tutti i file CSS/JS locali in ogni HTML.

USO:
    python3 bump_version.py

Eseguilo nella root del repository PRIMA di fare git add + commit + push.
Il Service Worker rileverà il cambio di CACHE_VERSION e forzerà il refresh
su tutti i client (browser + app installata) al prossimo accesso.
"""

import os
import re
from datetime import datetime

# ── Config ────────────────────────────────────────────────────────────────────
REPO_ROOT   = os.path.dirname(os.path.abspath(__file__))
SW_FILE     = os.path.join(REPO_ROOT, 'sw.js')
HTML_GLOB   = REPO_ROOT   # cerca .html direttamente nella root

# Pattern versione in sw.js
SW_VERSION_RE = re.compile(r"const CACHE_VERSION = 'modicaai-v[^']*'")

# Pattern query string ?v=... su asset locali (non CDN)
# Matcha: href="qualcosa.css?v=..." o src="qualcosa.js?v=..."
# Solo asset locali (non http/https)
ASSET_RE = re.compile(
    r'((?:href|src)=["\'])(?!https?://)([^"\']+\.(?:css|js))(?:\?v=[^"\']*)?(["\'])',
    re.IGNORECASE
)

# ── Genera versione ────────────────────────────────────────────────────────────
now     = datetime.now()
version = now.strftime('%Y%m%d-%H%M')
cache_v = f'modicaai-v{version}'

print(f"🔄 Bump versione → {cache_v}")

# ── 1. Aggiorna sw.js ─────────────────────────────────────────────────────────
if os.path.exists(SW_FILE):
    with open(SW_FILE, 'r', encoding='utf-8') as f:
        sw_content = f.read()

    new_sw = SW_VERSION_RE.sub(
        f"const CACHE_VERSION = '{cache_v}'",
        sw_content
    )

    if new_sw != sw_content:
        with open(SW_FILE, 'w', encoding='utf-8') as f:
            f.write(new_sw)
        print(f"  ✅ sw.js aggiornato → CACHE_VERSION = '{cache_v}'")
    else:
        print(f"  ⚠️  sw.js: pattern non trovato, controlla CACHE_VERSION manualmente")
else:
    print(f"  ❌ sw.js non trovato in {REPO_ROOT}")

# ── 2. Aggiorna ?v= in tutti gli HTML ─────────────────────────────────────────
html_files = [
    f for f in os.listdir(HTML_GLOB)
    if f.endswith('.html') and os.path.isfile(os.path.join(HTML_GLOB, f))
]

html_files.sort()
updated_html = 0

for fname in html_files:
    fpath = os.path.join(HTML_GLOB, fname)
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    def add_version(m):
        prefix = m.group(1)   # href=" o src="
        asset  = m.group(2)   # percorso file
        suffix = m.group(3)   # " o '
        return f'{prefix}{asset}?v={version}{suffix}'

    new_content = ASSET_RE.sub(add_version, content)

    if new_content != content:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        updated_html += 1
        print(f"  ✅ {fname}")

if updated_html == 0:
    print("  ℹ️  Nessun asset locale con ?v= trovato negli HTML (normale se non hai CSS/JS locali separati)")
else:
    print(f"\n  📄 {updated_html} file HTML aggiornati")

# ── Riepilogo ─────────────────────────────────────────────────────────────────
print(f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Cache bump completato: {cache_v}

Prossimi passi:
  git add -A
  git commit -m "🔄 bump cache {version}"
  git push
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
""")
