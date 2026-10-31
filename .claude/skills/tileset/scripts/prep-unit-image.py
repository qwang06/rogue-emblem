"""Prepares a generated character picture as a single-image unit (see
SINGLE_IMAGE_UNITS in src/game/tileset.ts). Usage, from the repo root:

  python3 .claude/skills/tileset/scripts/prep-unit-image.py in.png src/assets/units/Knight.png
      [--size 128] [--flip] [--key-background] [--tolerance 40]

It drops faint alpha noise (generators leave near-invisible pixels that would
give the outline a box), optionally keys out a flat background color taken
from the corners (--key-background, for a generator that can't do
transparency), crops to the character, mirrors it to face right (--flip, for
art that faces left), and centers it on a transparent square `--size` px
wide with its feet where the unit shadow sits (UNIT_SHADOW, ~30/32 down),
scaled down with Lanczos. Needs Pillow.
"""

import argparse
from collections import deque

from PIL import Image

# Pixels at or under this alpha (of 255) count as empty.
ALPHA_FLOOR = 24
# Where the feet land, and how much of the square the character may fill,
# as fractions of the square: matches the pixel-art units (feet at y 28-31
# of 32) and leaves room for the outline at the sides.
FEET_Y = 30 / 32
FILL = 28 / 32


def key_background(image: Image.Image, tolerance: int) -> None:
    """Flood-fills from the corners, clearing pixels close to the corner color."""
    width, height = image.size
    pixels = image.load()
    seed = pixels[0, 0][:3]
    close = lambda c: sum(abs(a - b) for a, b in zip(c[:3], seed)) <= tolerance
    queue = deque([(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)])
    seen = set(queue)
    while queue:
        x, y = queue.popleft()
        if not close(pixels[x, y]):
            continue
        pixels[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in seen:
                seen.add((nx, ny))
                queue.append((nx, ny))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('input')
    parser.add_argument('output')
    parser.add_argument('--size', type=int, default=128)
    parser.add_argument('--flip', action='store_true')
    parser.add_argument('--key-background', action='store_true')
    parser.add_argument('--tolerance', type=int, default=40)
    args = parser.parse_args()

    image = Image.open(args.input).convert('RGBA')
    if args.key_background:
        key_background(image, args.tolerance)
    alpha = image.getchannel('A').point(lambda a: 0 if a <= ALPHA_FLOOR else a)
    image.putalpha(alpha)
    box = alpha.getbbox()
    if box is None:
        raise SystemExit('the image is empty once its background is gone')
    image = image.crop(box)
    if args.flip:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)

    size = args.size
    scale = FILL * size / max(image.size)
    width, height = max(1, round(image.width * scale)), max(1, round(image.height * scale))
    image = image.resize((width, height), Image.Resampling.LANCZOS)
    # Resampling smears faint alpha back in around the edges.
    image.putalpha(image.getchannel('A').point(lambda a: 0 if a <= ALPHA_FLOOR else a))

    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    left = (size - width) // 2
    top = max(0, round(FEET_Y * size) - height)
    out.paste(image, (left, top))
    out.save(args.output)
    print(f'{args.output}: {size}x{size}, character {width}x{height} at ({left}, {top})')


if __name__ == '__main__':
    main()
