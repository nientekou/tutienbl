import os
from PIL import Image

# Setup directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EMOJIS_DIR = os.path.join(BASE_DIR, "assets", "emojis")
BANNERS_DIR = os.path.join(BASE_DIR, "assets", "banners")
os.makedirs(EMOJIS_DIR, exist_ok=True)
os.makedirs(BANNERS_DIR, exist_ok=True)

print(f"Created directories:\n - {EMOJIS_DIR}\n - {BANNERS_DIR}")

def crop_original_emojis():
    demo_path = os.path.join(BASE_DIR, "demo.jpg")
    if not os.path.exists(demo_path):
        print(f"Error: demo.jpg not found at {demo_path}")
        return False
        
    print("Found demo.jpg. Cropping core emojis...")
    img = Image.open(demo_path)
    w, h = img.size
    col_w = w // 3
    row_h = h // 3
    
    emoji_mappings = [
        (0, 0, "gem_purple.png"),
        (0, 1, "umbrella_blue.png"),
        (0, 2, "shield_purple.png"),
        (1, 0, "ring_pink_flower.png"),
        (1, 1, "ring_fire.png"),
        (1, 2, "pendant_jade_horse.png"),
        (2, 0, "bag_gold_coins.png"),
        (2, 1, "bracelet_silver.png"),
        (2, 2, "bag_purple.png"),
    ]
    
    for row, col, name in emoji_mappings:
        left = col * col_w
        top = row * row_h
        right = (col + 1) * col_w
        bottom = (row + 1) * row_h
        
        # Crop slightly inward to avoid border lines
        margin = 6
        cropped = img.crop((left + margin, top + margin, right - margin, bottom - margin))
        # Resize to 128x128 for Discord emojis standard
        cropped = cropped.resize((128, 128), Image.Resampling.LANCZOS)
        
        save_path = os.path.join(EMOJIS_DIR, name)
        cropped.save(save_path, "PNG")
        print(f"Successfully saved: {name} to {save_path}")
        
    return True

if __name__ == "__main__":
    crop_original_emojis()
