from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


@dataclass(frozen=True)
class IconSpec:
    filename: str
    size: int


SOURCE = Path(__file__).resolve().parents[1] / "assets" / "app-icon-source.png"
OUT_DIR = Path(__file__).resolve().parents[1] / "public"


SPECS_ANY = [
    IconSpec("pwa-192.png", 192),
    IconSpec("pwa-512.png", 512),
]

SPECS_MASKABLE = [
    IconSpec("pwa-maskable-192.png", 192),
    IconSpec("pwa-maskable-512.png", 512),
]

SPECS_IOS = [
    IconSpec("apple-touch-icon.png", 180),
]

SPECS_FAVICON_PNG = [
    IconSpec("favicon-16x16.png", 16),
    IconSpec("favicon-32x32.png", 32),
]


def _avg_color(img: Image.Image, sample_points: list[tuple[int, int]]) -> tuple[int, int, int]:
    px = img.convert("RGB").load()
    rs: list[int] = []
    gs: list[int] = []
    bs: list[int] = []
    w, h = img.size
    for x, y in sample_points:
        x = max(0, min(w - 1, x))
        y = max(0, min(h - 1, y))
        r, g, b = px[x, y]
        rs.append(r)
        gs.append(g)
        bs.append(b)
    return (sum(rs) // len(rs), sum(gs) // len(gs), sum(bs) // len(bs))


def _is_corner_white(rgb: tuple[int, int, int]) -> bool:
    r, g, b = rgb
    return r >= 245 and g >= 245 and b >= 245


def _replace_corner_whites_with_bg(img: Image.Image, bg_rgb: tuple[int, int, int]) -> Image.Image:
    """
    The source icon has white pixels in the outer corners (outside the rounded-square artwork).
    We flood-fill from the four corners, and only replace those connected white regions.
    This avoids touching the bunny's white fill.
    """
    rgb = img.convert("RGB")
    px = rgb.load()
    w, h = rgb.size

    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()
    for start in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        q.append(start)

    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        if visited[y][x]:
            continue
        visited[y][x] = True

        if not _is_corner_white(px[x, y]):
            continue

        px[x, y] = bg_rgb
        q.append((x + 1, y))
        q.append((x - 1, y))
        q.append((x, y + 1))
        q.append((x, y - 1))

    return rgb


def _make_maskable(src_rgb: Image.Image, bg_rgb: tuple[int, int, int]) -> Image.Image:
    """
    Maskable icons should have a full-bleed background, with the foreground inset.
    We'll place the source artwork at ~80% scale on a solid background.
    """
    w, h = src_rgb.size
    canvas = Image.new("RGB", (w, h), bg_rgb)
    scale = 0.80
    fg = src_rgb.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    x = (w - fg.size[0]) // 2
    y = (h - fg.size[1]) // 2
    canvas.paste(fg, (x, y))
    return canvas


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    src = Image.open(SOURCE)
    w, h = src.size
    if w != h:
        # Keep it square for icon generation
        side = min(w, h)
        src = src.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))

    # Pick a representative purple from the background (avoid corners and bunny).
    # Sample near edges but inside the rounded-square background.
    s = src.size[0]
    bg_rgb = _avg_color(
        src,
        sample_points=[
            (s // 2, s // 10),
            (s // 2, s - (s // 10)),
            (s // 10, s // 2),
            (s - (s // 10), s // 2),
        ],
    )

    cleaned = _replace_corner_whites_with_bg(src, bg_rgb)

    # Write a canonical large icon too (handy for future use/debugging).
    cleaned_1024 = cleaned.resize((1024, 1024), Image.Resampling.LANCZOS)
    cleaned_1024.save(OUT_DIR / "pwa-1024.png", optimize=True)

    for spec in SPECS_ANY:
        cleaned.resize((spec.size, spec.size), Image.Resampling.LANCZOS).save(
            OUT_DIR / spec.filename, optimize=True
        )

    maskable_base = cleaned.resize((1024, 1024), Image.Resampling.LANCZOS)
    maskable_1024 = _make_maskable(maskable_base, bg_rgb)
    maskable_1024.save(OUT_DIR / "pwa-maskable-1024.png", optimize=True)
    for spec in SPECS_MASKABLE:
        _make_maskable(cleaned.resize((spec.size, spec.size), Image.Resampling.LANCZOS), bg_rgb).save(
            OUT_DIR / spec.filename, optimize=True
        )

    for spec in SPECS_IOS:
        cleaned.resize((spec.size, spec.size), Image.Resampling.LANCZOS).save(OUT_DIR / spec.filename, optimize=True)

    for spec in SPECS_FAVICON_PNG:
        cleaned.resize((spec.size, spec.size), Image.Resampling.LANCZOS).save(OUT_DIR / spec.filename, optimize=True)

    # Multi-size .ico for broad browser support
    cleaned_256 = cleaned.resize((256, 256), Image.Resampling.LANCZOS)
    cleaned_256.save(OUT_DIR / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


if __name__ == "__main__":
    main()

