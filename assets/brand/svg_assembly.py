"""SVG group assembly and centering helpers for the brand generator."""


def assemble_single_group(paths, uses, color="currentColor"):
    inner = []
    for x, y, href in uses:
        d = paths[href]
        if x != 0 or y != 0:
            inner.append(
                f'<path fill="{color}" transform="translate({x:.3f}, {y:.3f})" d="{d}"/>'
            )
        else:
            inner.append(f'<path fill="{color}" d="{d}"/>')
    return "\n        ".join(inner)


def calc_center(vb, target_w, target_h, pad_ratio=0.22):
    min_x, min_y, w, h = vb
    avail_w = target_w * (1.0 - 2.0 * pad_ratio)
    avail_h = target_h * (1.0 - 2.0 * pad_ratio)
    scale = min(avail_w / w, avail_h / h)
    orig_cx = min_x + w / 2.0
    orig_cy = min_y + h / 2.0
    tx = (target_w / 2.0) - (orig_cx * scale)
    ty = (target_h / 2.0) - (orig_cy * scale)
    return tx, ty, scale
