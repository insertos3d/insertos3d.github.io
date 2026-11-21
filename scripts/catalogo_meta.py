#!/usr/bin/env python3
"""Genera el catálogo de productos para Meta (Facebook, Instagram y WhatsApp Business).

Lee los productos VISIBLES desde Supabase (con la llave pública de js/productos.js),
convierte las fotos a JPG compatibles con Meta (mín. 500 px, máx. 1200 px) y escribe:

    catalogo/meta.csv          -> feed que Meta Commerce Manager descarga cada día
    catalogo/img/<id>-<n>.jpg  -> fotos del feed

Se ejecuta solo con GitHub Actions (.github/workflows/catalogo-meta.yml) y también a mano:
    python scripts/catalogo_meta.py
"""
from __future__ import annotations

import csv
import io
import json
import re
import shutil
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

RAIZ = Path(__file__).resolve().parent.parent
DOMINIO = "https://insertos3d.com"
SALIDA = RAIZ / "catalogo"
IMG_DIR = SALIDA / "img"
ORIGEN = "meta-catalogo"        # aparece en Métricas → Por origen
MARCA = "Insertos 3D"
MIN_LADO, MAX_LADO = 500, 1200  # Meta exige imágenes de al menos 500 x 500 px
MAX_FOTOS = 10                  # 1 principal + hasta 9 adicionales
UA = {"User-Agent": "insertos3d-catalogo/1.0"}

COLUMNAS = [
    "id", "title", "description", "availability", "condition", "price", "link",
    "image_link", "additional_image_link", "brand", "product_type",
    "custom_label_0", "custom_label_1",
]


def leer_config() -> tuple[str, str, dict[str, str]]:
    """Toma la URL/llave pública de Supabase y los nombres de categorías de js/productos.js."""
    js = (RAIZ / "js" / "productos.js").read_text(encoding="utf-8")
    url = re.search(r'supabaseUrl:\s*"([^"]+)"', js).group(1).rstrip("/")
    key = re.search(r'supabaseKey:\s*"([^"]+)"', js).group(1)
    bloque = re.search(r"const CATEGORIAS = \[(.*?)\];", js, re.S).group(1)
    cats = dict(re.findall(r'id:\s*"([^"]+)",\s*nombre:\s*"([^"]+)"', bloque))
    return url, key, cats


def leer_productos(url: str, key: str) -> list[dict]:
    campos = "id,nombre,categoria,precio,descripcion,img,fotos,agotado,tendencia,temporada"
    headers = {**UA, "apikey": key, "Accept": "application/json"}
    if key.startswith("eyJ"):  # llave "anon" antigua (JWT)
        headers["Authorization"] = f"Bearer {key}"
    req = urllib.request.Request(
        f"{url}/rest/v1/productos?select={campos}&order=orden.asc,nombre.asc", headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def abrir_imagen(src: str) -> Image.Image:
    """Abre una foto del repositorio (ruta relativa) o de Supabase Storage (URL)."""
    if src.startswith(("http://", "https://")):
        with urllib.request.urlopen(urllib.request.Request(src, headers=UA), timeout=30) as r:
            datos = r.read()
    else:
        datos = (RAIZ / src.lstrip("/")).read_bytes()
    return Image.open(io.BytesIO(datos))


def guardar_jpg(img: Image.Image, destino: Path) -> None:
    img = ImageOps.exif_transpose(img)
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        fondo = Image.new("RGB", img.size, (255, 255, 255))   # transparencias → fondo blanco
        fondo.paste(img, mask=img.split()[-1])
        img = fondo
    else:
        img = img.convert("RGB")
    w, h = img.size
    escala = min(1.0, MAX_LADO / max(w, h))
    if min(w, h) * escala < MIN_LADO:
        escala = MIN_LADO / min(w, h)
    if escala != 1.0:
        img = img.resize((round(w * escala), round(h * escala)), Image.LANCZOS)
    img.save(destino, "JPEG", quality=85, optimize=True)


def main() -> int:
    url, key, cats = leer_config()
    try:
        productos = leer_productos(url, key)
    except Exception as e:  # sin conexión: se conserva el catálogo anterior
        print(f"ERROR al leer Supabase: {e}")
        return 1
    if not productos:
        print("Supabase no devolvió productos: no se modifica el catálogo.")
        return 1

    if IMG_DIR.exists():
        shutil.rmtree(IMG_DIR)
    IMG_DIR.mkdir(parents=True)

    filas, omitidos = [], []
    for p in productos:
        fuentes = [s for s in [p.get("img"), *(p.get("fotos") or [])] if s][:MAX_FOTOS]
        imagenes = []
        for n, src in enumerate(fuentes, start=1):
            nombre = f"{p['id']}-{n}.jpg"
            try:
                guardar_jpg(abrir_imagen(src), IMG_DIR / nombre)
                imagenes.append(f"{DOMINIO}/catalogo/img/{nombre}")
            except Exception as e:
                print(f"  aviso: {p['id']} foto {n} omitida ({e})")
        if not imagenes:
            omitidos.append(p["id"])   # Meta rechaza productos sin imagen
            continue
        filas.append({
            "id": p["id"],
            "title": p["nombre"].strip()[:150],
            "description": (p.get("descripcion") or p["nombre"]).strip()[:5000],
            "availability": "out of stock" if p.get("agotado") else "in stock",
            "condition": "new",
            "price": f"{float(p['precio']):.2f} PEN",
            "link": f"{DOMINIO}/?p={p['id']}&src={ORIGEN}",
            "image_link": imagenes[0],
            "additional_image_link": ",".join(imagenes[1:]),
            "brand": MARCA,
            "product_type": cats.get(p["categoria"], p["categoria"]),
            "custom_label_0": "tendencia" if p.get("tendencia") else "",
            "custom_label_1": "temporada" if p.get("temporada") else "",
        })

    with open(SALIDA / "meta.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNAS, lineterminator="\n")
        w.writeheader()
        w.writerows(filas)

    print(f"Catálogo: {len(filas)} productos en catalogo/meta.csv")
    if omitidos:
        print(f"Sin foto (no se incluyen hasta que tengan una): {', '.join(omitidos)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
