#!/usr/bin/env python3
"""
genera_assets_pwa.py — ModicaAI PWA Assets Generator
======================================================
Genera automaticamente tutte le icone e le splash screen
necessarie per installare ModicaAI come app su Android e iOS.

PREREQUISITI:
    pip install Pillow

USO:
    1. Metti questo script nella root del repository (dove c'è index.html)
    2. Assicurati di avere icon-512.png nella stessa cartella
    3. Esegui:  python3 genera_assets_pwa.py
    4. Lo script crea:
         - icon-72.png, icon-96.png, ..., icon-180.png (icone)
         - splash/splash-640x1136.png, ... (splash screen iOS)
    5. Fai commit e push di tutto

NOTA: Le splash screen iOS hanno sfondo blu ModicaAI (#1A3A5C)
      con il logo centrato. Se non hai Pillow installato lo script
      ti dice come installarlo.
"""

import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("❌ Pillow non installato.")
    print("   Esegui: pip install Pillow")
    sys.exit(1)

# ── Config ─────────────────────────────────────────────────────────────────
REPO_ROOT   = os.path.dirname(os.path.abspath(__file__))
SOURCE_ICON = os.path.join(REPO_ROOT, 'icon-512.png')
SPLASH_DIR  = os.path.join(REPO_ROOT, 'splash')

BG_COLOR    = (26, 58, 92)      # #1A3A5C — blu ModicaAI
DARK_COLOR  = (21, 24, 32)      # #151820 — dark mode

# ── Icone da generare ────────────────────────────────────────────────────────
ICON_SIZES = [72, 96, 128, 144, 152, 167, 180, 192, 512]

# ── Splash screen iOS (larghezza x altezza in pixel fisici) ──────────────────
SPLASH_SIZES = [
    (640,  1136, 'iPhone SE 1st gen'),
    (750,  1334, 'iPhone 8 / SE2 / SE3'),
    (1125, 2436, 'iPhone X / XS / 11 Pro'),
    (828,  1792, 'iPhone XR / 11'),
    (1170, 2532, 'iPhone 12 / 13 / 14'),
    (1179, 2556, 'iPhone 14 Pro / 15'),
    (1290, 2796, 'iPhone 15 Plus / 14 Plus'),
    (1242, 2688, 'iPhone XS Max / 11 Pro Max'),
    (1080, 2340, 'Android FHD+'),
    (1440, 3040, 'Android QHD+'),
]

# ── Controlla sorgente ────────────────────────────────────────────────────────
if not os.path.exists(SOURCE_ICON):
    print(f"❌ File sorgente non trovato: {SOURCE_ICON}")
    print("   Assicurati di avere icon-512.png nella root del repo.")
    sys.exit(1)

src = Image.open(SOURCE_ICON).convert('RGBA')
print(f"✅ Sorgente caricata: {SOURCE_ICON} ({src.size[0]}×{src.size[1]})")

# ── Genera icone ──────────────────────────────────────────────────────────────
print("\n📱 Generazione icone...")
for size in ICON_SIZES:
    out_path = os.path.join(REPO_ROOT, f'icon-{size}.png')
    if os.path.exists(out_path) and size in [192, 512]:
        print(f"  ⏭️  icon-{size}.png (già esiste, skip)")
        continue
    icon = src.resize((size, size), Image.LANCZOS)
    # Converti in RGB con sfondo bianco per formato PNG non-trasparente
    bg = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    bg.paste(icon, (0, 0), icon if icon.mode == 'RGBA' else None)
    bg.convert('RGBA').save(out_path, 'PNG', optimize=True)
    print(f"  ✅ icon-{size}.png")

# ── Genera splash screen ──────────────────────────────────────────────────────
print(f"\n🖼️  Generazione splash screen iOS/Android...")
os.makedirs(SPLASH_DIR, exist_ok=True)

for (w, h, device) in SPLASH_SIZES:
    out_path = os.path.join(SPLASH_DIR, f'splash-{w}x{h}.png')

    # Canvas con sfondo blu ModicaAI
    canvas = Image.new('RGB', (w, h), BG_COLOR)

    # Logo centrato — occupa il 35% della dimensione minore
    logo_size = int(min(w, h) * 0.35)
    logo = src.resize((logo_size, logo_size), Image.LANCZOS)

    # Posizione centrata, leggermente sopra il centro (60% altezza)
    x = (w - logo_size) // 2
    y = int(h * 0.35)

    # Incolla con maschera alpha
    if logo.mode == 'RGBA':
        canvas.paste(logo, (x, y), logo)
    else:
        canvas.paste(logo, (x, y))

    # Testo "ModicaAI" sotto il logo
    draw = ImageDraw.Draw(canvas)
    font_size = max(24, logo_size // 6)
    try:
        # Prova font di sistema
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', font_size)
    except:
        try:
            font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', font_size)
        except:
            font = ImageFont.load_default()

    text = 'ModicaAI'
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_x = (w - text_w) // 2
    text_y = y + logo_size + int(logo_size * 0.12)

    # Testo bianco con leggera ombra
    draw.text((text_x + 2, text_y + 2), text, fill=(0, 0, 0, 80), font=font)
    draw.text((text_x, text_y), text, fill=(255, 255, 255), font=font)

    # Sottotitolo
    sub_text = 'Il tuo assistente per Modica'
    sub_size = max(14, font_size // 2)
    try:
        sub_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', sub_size)
    except:
        sub_font = font
    sub_bbox = draw.textbbox((0, 0), sub_text, font=sub_font)
    sub_w = sub_bbox[2] - sub_bbox[0]
    sub_x = (w - sub_w) // 2
    sub_y = text_y + font_size + 8
    draw.text((sub_x, sub_y), sub_text, fill=(180, 200, 220), font=sub_font)

    canvas.save(out_path, 'PNG', optimize=True)
    print(f"  ✅ splash-{w}x{h}.png  ({device})")

# ── Riepilogo ──────────────────────────────────────────────────────────────────
print(f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Asset PWA generati con successo!

File creati:
  • {len(ICON_SIZES)} icone nella root (icon-72.png ... icon-512.png)
  • {len(SPLASH_SIZES)} splash screen in splash/

Prossimi passi:
  git add -A
  git commit -m "🖼️ add PWA icons and splash screens"
  git push
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
""")
