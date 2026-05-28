#!/usr/bin/env python3
import math
import os
import struct
import zlib


def clamp(value):
    return max(0, min(255, int(value)))


def rounded_mask(x, y, size, radius):
    dx = min(x, size - 1 - x)
    dy = min(y, size - 1 - y)
    if dx >= radius or dy >= radius:
        return 255
    cx = radius - dx
    cy = radius - dy
    dist = math.sqrt(cx * cx + cy * cy)
    edge = radius - dist
    return clamp(edge * 255)


def line_distance(px, py, ax, ay, bx, by):
    vx = bx - ax
    vy = by - ay
    wx = px - ax
    wy = py - ay
    c1 = vx * wx + vy * wy
    if c1 <= 0:
        return math.hypot(px - ax, py - ay)
    c2 = vx * vx + vy * vy
    if c2 <= c1:
        return math.hypot(px - bx, py - by)
    t = c1 / c2
    return math.hypot(px - (ax + t * vx), py - (ay + t * vy))


def png_chunk(kind, payload):
    return (
        struct.pack(">I", len(payload))
        + kind
        + payload
        + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
    )


def write_png(path, size):
    rows = []
    radius = size * 0.19
    stroke = size * 0.08
    a = (size * 0.29, size * 0.53)
    b = (size * 0.44, size * 0.68)
    c = (size * 0.73, size * 0.34)
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            t = (x + y) / (size * 2)
            r = 78 + 40 * (1 - t)
            g = 124 + 74 * (1 - t)
            bcol = 255 - 28 * t
            alpha = rounded_mask(x, y, size, radius)
            shine = max(0, 1 - math.hypot(x - size * 0.25, y - size * 0.18) / (size * 0.58))
            r += 18 * shine
            g += 18 * shine
            bcol += 8 * shine
            d = min(line_distance(x, y, *a, *b), line_distance(x, y, *b, *c))
            if d < stroke:
                blend = max(0, min(1, (stroke - d) / (stroke * 0.45)))
                r = r * (1 - blend) + 255 * blend
                g = g * (1 - blend) + 255 * blend
                bcol = bcol * (1 - blend) + 255 * blend
            row.extend([clamp(r), clamp(g), clamp(bcol), alpha])
        rows.append(bytes(row))

    raw = b"".join(rows)
    data = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + png_chunk(b"IDAT", zlib.compress(raw, 9))
        + png_chunk(b"IEND", b"")
    )
    with open(path, "wb") as fh:
        fh.write(data)


def write_icns(path, iconset_dir):
    entries = [
        (b"icp4", "icon_16x16.png"),
        (b"icp5", "icon_32x32.png"),
        (b"icp6", "icon_32x32@2x.png"),
        (b"ic07", "icon_128x128.png"),
        (b"ic08", "icon_256x256.png"),
        (b"ic09", "icon_512x512.png"),
        (b"ic10", "icon_512x512@2x.png"),
    ]
    chunks = []
    for kind, name in entries:
        with open(os.path.join(iconset_dir, name), "rb") as fh:
            payload = fh.read()
        chunks.append(kind + struct.pack(">I", len(payload) + 8) + payload)
    body = b"".join(chunks)
    with open(path, "wb") as fh:
        fh.write(b"icns" + struct.pack(">I", len(body) + 8) + body)


def main():
    out_dir = os.environ["ICONSET_DIR"]
    os.makedirs(out_dir, exist_ok=True)
    specs = [
        ("icon_16x16.png", 16),
        ("icon_16x16@2x.png", 32),
        ("icon_32x32.png", 32),
        ("icon_32x32@2x.png", 64),
        ("icon_128x128.png", 128),
        ("icon_128x128@2x.png", 256),
        ("icon_256x256.png", 256),
        ("icon_256x256@2x.png", 512),
        ("icon_512x512.png", 512),
        ("icon_512x512@2x.png", 1024),
    ]
    for name, size in specs:
        write_png(os.path.join(out_dir, name), size)
    if "ICNS_PATH" in os.environ:
        write_icns(os.environ["ICNS_PATH"], out_dir)


if __name__ == "__main__":
    main()
