from __future__ import annotations

"""Lightweight image-input quality gate with no extra runtime dependency."""

import struct
from typing import Any


MIN_BYTES = 12_000
MIN_WIDTH = 320
MIN_HEIGHT = 240
MAX_ASPECT_RATIO = 4.0


def _dimensions(image_bytes: bytes, content_type: str) -> tuple[int, int] | None:
    if content_type == "image/png" and len(image_bytes) >= 24:
        if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
            return struct.unpack(">II", image_bytes[16:24])

    if content_type in {"image/jpeg", "image/jpg"}:
        if image_bytes[:2] != b"\xff\xd8":
            return None
        index = 2
        while index + 9 < len(image_bytes):
            if image_bytes[index] != 0xFF:
                index += 1
                continue
            marker = image_bytes[index + 1]
            index += 2
            if marker in {0xD8, 0xD9}:
                continue
            if index + 2 > len(image_bytes):
                return None
            segment_length = int.from_bytes(image_bytes[index:index + 2], "big")
            if segment_length < 2 or index + segment_length > len(image_bytes):
                return None
            if marker in set(range(0xC0, 0xC4)) | set(range(0xC5, 0xC8)) | set(range(0xC9, 0xCC)) | set(range(0xCD, 0xD0)):
                if segment_length >= 7:
                    height = int.from_bytes(image_bytes[index + 3:index + 5], "big")
                    width = int.from_bytes(image_bytes[index + 5:index + 7], "big")
                    return width, height
            index += segment_length

    if content_type == "image/webp" and len(image_bytes) >= 30:
        if image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
            chunk = image_bytes[12:16]
            if chunk == b"VP8X":
                width = 1 + int.from_bytes(image_bytes[24:27], "little")
                height = 1 + int.from_bytes(image_bytes[27:30], "little")
                return width, height

    return None


def validate_image_quality(image_bytes: bytes, content_type: str) -> dict[str, Any]:
    """Return a deterministic quality decision before calling the vision model."""
    issues: list[str] = []

    if len(image_bytes) < MIN_BYTES:
        issues.append("Image file is too small; retake a clearer photo.")

    dimensions = _dimensions(image_bytes, content_type)
    if dimensions is None:
        issues.append("Image dimensions could not be verified.")
        width = height = None
    else:
        width, height = dimensions
        if width < MIN_WIDTH or height < MIN_HEIGHT:
            issues.append(
                f"Image resolution is too low ({width}x{height}); use a closer, clearer photo."
            )
        if max(width, height) / max(1, min(width, height)) > MAX_ASPECT_RATIO:
            issues.append("Image framing is unusually wide or narrow; center the affected plant or leaf.")

    return {
        "accepted": not issues,
        "issues": issues,
        "bytes": len(image_bytes),
        "width": width,
        "height": height,
        "quality_gate": "pass" if not issues else "fail",
    }
