import cv2
import numpy as np
import sys

def process_image(filepath, output_path):
    img = cv2.imread(filepath)
    if img is None:
        raise ValueError("Image not found or path is invalid")

    scale = 0.4
    h, w = int(img.shape[0] * scale), int(img.shape[1] * scale)
    temp = cv2.resize(img, (w, h), interpolation=cv2.INTER_LINEAR)
    pixelated = cv2.resize(temp, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_NEAREST)

    gray = cv2.cvtColor(pixelated, cv2.COLOR_BGR2GRAY)

    colors = {
        "black":         np.array([12, 12, 30]),
        "dark_burgundy": np.array([60, 20, 40]),
        "maroon":        np.array([92, 36, 60]),
        "soft_red":      np.array([150, 30, 40]),
        "red":           np.array([203, 43, 43]),
    }

    brightness = (gray / 255 * 5).astype(np.uint8)
    colorized = np.zeros((*gray.shape, 3), dtype=np.uint8)

    color_levels = [
        (0, 1, colors["black"]),
        (1, 2, colors["dark_burgundy"]),
        (2, 3, colors["maroon"]),
        (3, 4, colors["soft_red"]),
        (4, 6, colors["red"]),
    ]

    for low, high, color in color_levels:
        mask = (brightness >= low) & (brightness < high)
        colorized[mask] = color

    # Save the result in RGB format
    colorized_rgb = cv2.cvtColor(colorized, cv2.COLOR_BGR2RGB)
    cv2.imwrite(output_path, colorized_rgb)


# CLI usage: python colorize.py input_path output_path
if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("how to use: python milkify.py input_path output_path")
        sys.exit(1)
    process_image(sys.argv[1], sys.argv[2])