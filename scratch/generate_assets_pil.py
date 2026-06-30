import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# Setup directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EMOJIS_DIR = os.path.join(BASE_DIR, "assets", "emojis")
BANNERS_DIR = os.path.join(BASE_DIR, "assets", "banners")
os.makedirs(EMOJIS_DIR, exist_ok=True)
os.makedirs(BANNERS_DIR, exist_ok=True)

# Try loading a nice font, fallback to default if not found
def get_font(size):
    font_paths = [
        "C:\\Windows\\Fonts\\msyh.ttc",       # Microsoft YaHei
        "C:\\Windows\\Fonts\\msyhl.ttc",      # Microsoft YaHei Light
        "C:\\Windows\\Fonts\\times.ttf",      # Times New Roman
        "C:\\Windows\\Fonts\\arial.ttf",      # Arial
    ]
    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()

def draw_gradient_ellipse(draw, box, color1, color2):
    """Draws an ellipse with a simple vertical gradient."""
    x0, y0, x1, y1 = box
    for y in range(int(y0), int(y1) + 1):
        ratio = (y - y0) / (y1 - y0) if (y1 - y0) > 0 else 0
        r = int(color1[0] + (color2[0] - color1[0]) * ratio)
        g = int(color1[1] + (color2[1] - color1[1]) * ratio)
        b = int(color1[2] + (color2[2] - color1[2]) * ratio)
        # Determine width at this y
        h = (y1 - y0) / 2
        cy = y0 + h
        dy = abs(y - cy)
        if dy <= h:
            dx = math.sqrt(1 - (dy / h)**2) * ((x1 - x0) / 2)
            cx = (x0 + x1) / 2
            draw.line((cx - dx, y, cx + dx, y), fill=(r, g, b))

def draw_shadow(draw, cx, cy, rx, ry):
    """Draws a soft shadow ellipse."""
    # Draw multiple transparent layers for soft blur
    for r_offset in range(5, 0, -1):
        opacity = int(30 * (1 - r_offset/6))
        draw.ellipse([cx - rx - r_offset, cy - ry - r_offset, cx + rx + r_offset, cy + ry + r_offset], fill=(20, 20, 20, opacity))

def create_pill():
    """Generates pill_tuvi.png (Cultivation Pill)"""
    img = Image.new("RGBA", (128, 128), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    # Shadow
    draw_shadow(draw, 64, 100, 32, 10)
    # Outer energy ring (glow)
    draw.ellipse([24, 24, 104, 104], outline=(255, 215, 0, 80), width=3)
    draw.arc([16, 16, 112, 112], start=45, end=270, fill=(255, 140, 0, 100), width=2)
    # Pill body
    draw_gradient_ellipse(draw, [34, 34, 94, 94], (220, 20, 60), (255, 140, 0))
    # Highlight
    draw.ellipse([46, 42, 66, 62], fill=(255, 255, 255, 150))
    # Glow sparkle
    draw.line([64, 15, 64, 30], fill=(255, 215, 0), width=2)
    draw.line([56, 22, 72, 22], fill=(255, 215, 0), width=2)
    img.save(os.path.join(EMOJIS_DIR, "pill_tuvi.png"))

def create_sword():
    """Generates sword_mythic.png (Spiritual Sword)"""
    img = Image.new("RGBA", (128, 128), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    # Shadow
    draw_shadow(draw, 40, 95, 20, 5)
    # Cyan Glow
    draw.line([30, 98, 98, 30], fill=(0, 255, 255, 60), width=10)
    # Blade
    draw.polygon([(34, 94), (38, 98), (98, 38), (94, 34)], fill=(220, 240, 255))
    draw.line([36, 96, 96, 36], fill=(255, 255, 255), width=2) # Blade center line
    # Hilt / Crossguard
    draw.line([30, 86, 44, 100], fill=(255, 215, 0), width=6)
    # Grip & Pommel
    draw.line([37, 91, 23, 105], fill=(139, 69, 19), width=4)
    draw.ellipse([18, 102, 26, 110], fill=(255, 215, 0))
    img.save(os.path.join(EMOJIS_DIR, "sword_mythic.png"))

def create_robe():
    """Generates robe_mystic.png (Cultivator Robe)"""
    img = Image.new("RGBA", (128, 128), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    # Shadow
    draw_shadow(draw, 64, 105, 36, 8)
    # Robe outline & fill
    draw.polygon([(64, 30), (34, 55), (44, 70), (52, 65), (44, 100), (84, 100), (76, 65), (84, 70), (94, 55)], fill=(30, 144, 255))
    # Wide sleeves overlay
    draw.polygon([(34, 55), (44, 70), (52, 65), (46, 52)], fill=(70, 130, 180))
    draw.polygon([(94, 55), (84, 70), (76, 65), (82, 52)], fill=(70, 130, 180))
    # Gold Sash/Belt
    draw.polygon([(52, 68), (76, 68), (75, 74), (53, 74)], fill=(255, 215, 0))
    # Inner collar
    draw.line([64, 30, 58, 68], fill=(255, 255, 255), width=2)
    draw.line([64, 30, 70, 68], fill=(255, 255, 255), width=2)
    img.save(os.path.join(EMOJIS_DIR, "robe_mystic.png"))

def create_linh_thao():
    """Generates linh_thao.png (Spirit Herb)"""
    img = Image.new("RGBA", (128, 128), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    # Shadow
    draw_shadow(draw, 64, 102, 24, 7)
    # Golden background glow
    draw.ellipse([34, 34, 94, 94], fill=(255, 223, 0, 40))
    # Stem
    draw.line([64, 100, 64, 40], fill=(139, 90, 43), width=4)
    # Leaves
    draw.ellipse([40, 50, 64, 66], fill=(46, 139, 87)) # Left leaf
    draw.ellipse([64, 60, 88, 76], fill=(46, 139, 87)) # Right leaf
    draw.ellipse([44, 75, 64, 88], fill=(34, 139, 34)) # Bottom-left leaf
    draw.ellipse([54, 30, 74, 48], fill=(60, 179, 113)) # Top leaf
    # Gold leaf veins
    draw.line([40, 58, 64, 58], fill=(255, 215, 0), width=1)
    draw.line([64, 68, 88, 68], fill=(255, 215, 0), width=1)
    img.save(os.path.join(EMOJIS_DIR, "linh_thao.png"))

def create_cauldron():
    """Generates cauldron.png (Refining Cauldron)"""
    img = Image.new("RGBA", (128, 128), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    # Shadow
    draw_shadow(draw, 64, 106, 32, 8)
    # Legs
    draw.polygon([(40, 94), (32, 106), (44, 106)], fill=(139, 105, 20))
    draw.polygon([(88, 94), (96, 106), (84, 106)], fill=(139, 105, 20))
    draw.polygon([(64, 94), (64, 108), (68, 108)], fill=(184, 134, 11))
    # Cauldron Body
    draw_gradient_ellipse(draw, [32, 54, 96, 96], (184, 134, 11), (139, 105, 20))
    # Rim
    draw.ellipse([30, 50, 98, 58], fill=(218, 165, 32))
    # Lid
    draw.polygon([(36, 50), (64, 34), (92, 50)], fill=(205, 127, 50))
    draw.ellipse([58, 28, 70, 36], fill=(255, 215, 0)) # Lid knob
    # Glowing green vapors
    draw.ellipse([44, 18, 56, 30], fill=(0, 255, 127, 80))
    draw.ellipse([68, 14, 80, 28], fill=(0, 255, 127, 60))
    img.save(os.path.join(EMOJIS_DIR, "cauldron.png"))

def create_book():
    """Generates book_martial.png (Martial Scroll)"""
    img = Image.new("RGBA", (128, 128), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    # Shadow
    draw_shadow(draw, 64, 98, 38, 8)
    # Scroll body (unrolled slightly or classical book style)
    # We will do a classical Chinese thread-bound book
    draw.rectangle([34, 30, 94, 96], fill=(0, 50, 100)) # Dark blue cover
    # Pages showing at the edge
    draw.rectangle([94, 34, 98, 92], fill=(245, 245, 220))
    # Binding threads (gold lines)
    draw.line([34, 36, 44, 36], fill=(255, 215, 0), width=2)
    draw.line([34, 50, 44, 50], fill=(255, 215, 0), width=2)
    draw.line([34, 76, 44, 76], fill=(255, 215, 0), width=2)
    draw.line([34, 90, 44, 90], fill=(255, 215, 0), width=2)
    # Label strip
    draw.rectangle([54, 38, 72, 88], fill=(245, 245, 245))
    # Runic vertical text (placeholders: red/black lines)
    draw.line([63, 44, 63, 56], fill=(0, 0, 0), width=2)
    draw.line([63, 62, 63, 70], fill=(0, 0, 0), width=2)
    draw.line([63, 76, 63, 82], fill=(139, 0, 0), width=2)
    img.save(os.path.join(EMOJIS_DIR, "book_martial.png"))

def create_beast_egg():
    """Generates beast_egg.png (Beast Egg)"""
    img = Image.new("RGBA", (128, 128), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    # Shadow
    draw_shadow(draw, 64, 104, 26, 8)
    # Egg shape
    draw_gradient_ellipse(draw, [36, 30, 92, 100], (72, 209, 204), (32, 178, 170))
    # Glowing cracks (drawn manually)
    draw.line([54, 45, 60, 52], fill=(255, 215, 0), width=2)
    draw.line([60, 52, 54, 68], fill=(255, 215, 0), width=2)
    draw.line([60, 52, 74, 58], fill=(255, 215, 0), width=2)
    draw.line([74, 58, 80, 72], fill=(255, 215, 0), width=2)
    draw.line([54, 68, 64, 82], fill=(255, 215, 0), width=2)
    img.save(os.path.join(EMOJIS_DIR, "beast_egg.png"))

def create_talisman():
    """Generates talisman.png (Talisman)"""
    img = Image.new("RGBA", (128, 128), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    # Shadow
    draw_shadow(draw, 64, 106, 26, 6)
    # Yellow paper slip (tilted)
    # Create scratch surface rotated
    slip = Image.new("RGBA", (60, 100), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(slip)
    # Draw yellow background
    s_draw.rectangle([0, 0, 58, 98], fill=(255, 223, 0), outline=(218, 165, 32), width=2)
    # Draw red runic ink (complex pattern)
    s_draw.line([29, 10, 29, 88], fill=(220, 20, 60), width=3)
    s_draw.arc([14, 20, 44, 40], start=0, end=360, fill=(220, 20, 60), width=2)
    s_draw.line([14, 50, 44, 50], fill=(220, 20, 60), width=2)
    s_draw.line([19, 65, 39, 65], fill=(220, 20, 60), width=2)
    s_draw.line([24, 75, 34, 75], fill=(220, 20, 60), width=2)
    # Rotate slip
    rotated = slip.rotate(15, expand=True, resample=Image.Resampling.BICUBIC)
    # Paste rotated slip onto main canvas
    x_pos = (128 - rotated.width) // 2
    y_pos = (128 - rotated.height) // 2
    img.alpha_composite(rotated, (x_pos, y_pos - 5))
    # Save
    img.save(os.path.join(EMOJIS_DIR, "talisman.png"))

def crop_original_emojis():
    """Crops the 9 core emojis from demo.jpg"""
    demo_path = os.path.join(BASE_DIR, "demo.jpg")
    if not os.path.exists(demo_path):
        print("demo.jpg not found, skipping crop step.")
        return
        
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
        
        margin = 4
        cropped = img.crop((left + margin, top + margin, right - margin, bottom - margin))
        cropped = cropped.resize((128, 128), Image.Resampling.LANCZOS)
        
        # Save
        save_path = os.path.join(EMOJIS_DIR, name)
        cropped.save(save_path, "PNG")
        print(f"Saved cropped emoji: {name}")

def create_banner(filename, title, subtitle, color_start, color_end, left_emoji_name, right_emoji_name):
    """Generates a professional 800x300 embed banner with text, graphics, and custom emojis."""
    banner = Image.new("RGBA", (800, 300), (0, 0, 0, 0))
    draw = ImageDraw.Draw(banner)
    
    # Draw background gradient
    for x in range(800):
        ratio = x / 800.0
        r = int(color_start[0] + (color_end[0] - color_start[0]) * ratio)
        g = int(color_start[1] + (color_end[1] - color_start[1]) * ratio)
        b = int(color_start[2] + (color_end[2] - color_start[2]) * ratio)
        draw.line((x, 0, x, 300), fill=(r, g, b, 255))
        
    # Draw nice double-frame border
    draw.rectangle([10, 10, 790, 290], outline=(255, 255, 255, 40), width=3)
    draw.rectangle([15, 15, 785, 285], outline=(255, 215, 0, 80), width=1)
    
    # Corner decorative brackets
    bracket_len = 30
    # Top-Left
    draw.line([8, 8, 8 + bracket_len, 8], fill=(255, 215, 0), width=3)
    draw.line([8, 8, 8, 8 + bracket_len], fill=(255, 215, 0), width=3)
    # Top-Right
    draw.line([792 - bracket_len, 8, 792, 8], fill=(255, 215, 0), width=3)
    draw.line([792, 8, 792, 8 + bracket_len], fill=(255, 215, 0), width=3)
    # Bottom-Left
    draw.line([8, 292 - bracket_len, 8, 292], fill=(255, 215, 0), width=3)
    draw.line([8, 292, 8 + bracket_len, 292], fill=(255, 215, 0), width=3)
    # Bottom-Right
    draw.line([792, 292 - bracket_len, 792, 292], fill=(255, 215, 0), width=3)
    draw.line([792 - bracket_len, 292, 792, 292], fill=(255, 215, 0), width=3)

    # Paste Left Emoji
    left_path = os.path.join(EMOJIS_DIR, left_emoji_name)
    if os.path.exists(left_path):
        e_img = Image.open(left_path).convert("RGBA")
        # Add a subtle glow behind emoji
        glow = Image.new("RGBA", (140, 140), (0, 0, 0, 0))
        g_draw = ImageDraw.Draw(glow)
        g_draw.ellipse([10, 10, 130, 130], fill=(255, 215, 0, 40))
        glow = glow.filter(ImageFilter.GaussianBlur(10))
        banner.alpha_composite(glow, (40, 70))
        
        e_img = e_img.resize((120, 120), Image.Resampling.LANCZOS)
        banner.alpha_composite(e_img, (50, 80))

    # Paste Right Emoji
    right_path = os.path.join(EMOJIS_DIR, right_emoji_name)
    if os.path.exists(right_path):
        e_img = Image.open(right_path).convert("RGBA")
        glow = Image.new("RGBA", (140, 140), (0, 0, 0, 0))
        g_draw = ImageDraw.Draw(glow)
        g_draw.ellipse([10, 10, 130, 130], fill=(255, 215, 0, 40))
        glow = glow.filter(ImageFilter.GaussianBlur(10))
        banner.alpha_composite(glow, (620, 70))
        
        e_img = e_img.resize((120, 120), Image.Resampling.LANCZOS)
        banner.alpha_composite(e_img, (630, 80))
        
    # Draw text shadow & title
    font_title = get_font(38)
    font_sub = get_font(20)
    
    # Calculate title size and center it
    t_bbox = draw.textbbox((0, 0), title, font=font_title)
    t_w = t_bbox[2] - t_bbox[0]
    t_x = (800 - t_w) // 2
    t_y = 80
    
    # Shadow text
    draw.text((t_x + 2, t_y + 2), title, fill=(0, 0, 0, 180), font=font_title)
    # Gold gradient / solid color text
    draw.text((t_x, t_y), title, fill=(255, 223, 0), font=font_title)
    
    # Subtitle centering
    s_bbox = draw.textbbox((0, 0), subtitle, font=font_sub)
    s_w = s_bbox[2] - s_bbox[0]
    s_x = (800 - s_w) // 2
    s_y = 150
    
    draw.text((s_x + 1, s_y + 1), subtitle, fill=(0, 0, 0, 150), font=font_sub)
    draw.text((s_x, s_y), subtitle, fill=(240, 240, 240), font=font_sub)
    
    # Underline text
    draw.line((t_x - 30, t_y + 55, t_x + t_w + 30, t_y + 55), fill=(255, 215, 0, 150), width=2)
    
    # Save
    banner.save(os.path.join(BANNERS_DIR, filename), "PNG")
    print(f"Saved banner: {filename}")

if __name__ == "__main__":
    print("Starting generation of Tu Tien asset pack...")
    
    # 1. Core Cropped Emojis
    crop_original_emojis()
    
    # 2. Draw Custom Emojis using PIL
    print("Drawing custom emojis...")
    create_pill()
    create_sword()
    create_robe()
    create_linh_thao()
    create_cauldron()
    create_book()
    create_beast_egg()
    create_talisman()
    
    # 3. Create the themed banners
    print("Generating banners...")
    
    # Profile
    create_banner(
        filename="hoso_banner.png",
        title="VẠN THẾ TU TIÊN - HỒ SƠ",
        subtitle="Hồ sơ tu sĩ & Cảnh giới tu hành",
        color_start=(64, 18, 96), # Purple
        color_end=(24, 12, 40), # Dark blue/purple
        left_emoji_name="gem_purple.png",
        right_emoji_name="ring_pink_flower.png"
    )
    
    # Secret Realm
    create_banner(
        filename="bicanh_banner.png",
        title="BÍ CẢNH THỬ THÁCH",
        subtitle="Thám hiểm bí cảnh cổ xưa, tầm bảo vật",
        color_start=(24, 76, 120), # Deep blue
        color_end=(12, 38, 60), # Slate blue
        left_emoji_name="umbrella_blue.png",
        right_emoji_name="shield_purple.png"
    )
    
    # Arena
    create_banner(
        filename="arena_banner.png",
        title="ĐẤU TRƯỜNG TỈ THÍ",
        subtitle="Quyết chiến sinh tử võ học, thăng hạng",
        color_start=(139, 0, 0), # Crimson
        color_end=(45, 0, 0), # Deep crimson/black
        left_emoji_name="ring_fire.png",
        right_emoji_name="sword_mythic.png"
    )
    
    # Sect
    create_banner(
        filename="tongmon_banner.png",
        title="TÔNG MÔN LÃNH ĐỊA",
        subtitle="Đại hội tông môn & Tranh đoạt linh địa",
        color_start=(46, 139, 87), # Jade Green
        color_end=(10, 40, 24), # Dark green
        left_emoji_name="pendant_jade_horse.png",
        right_emoji_name="bag_purple.png"
    )
    
    # World Boss
    create_banner(
        filename="worldboss_banner.png",
        title="MA THẦN PHÒ BẢN",
        subtitle="Tiêu diệt Ma Thần, giải cứu nhân gian",
        color_start=(75, 0, 130), # Indigo
        color_end=(20, 0, 40), # Deep indigo
        left_emoji_name="ring_fire.png",
        right_emoji_name="shield_purple.png"
    )
    
    # Forging
    create_banner(
        filename="chetao_banner.png",
        title="RÈN ĐÚC BẢO VẬT",
        subtitle="Rèn đúc trang bị, đúc kiếm khí",
        color_start=(112, 128, 144), # Steel gray
        color_end=(47, 79, 79), # Dark slate gray
        left_emoji_name="bracelet_silver.png",
        right_emoji_name="cauldron.png"
    )
    
    # Alchemy
    create_banner(
        filename="luyendan_banner.png",
        title="LUYỆN ĐAN THẤT",
        subtitle="Bào chế linh dược, dược thảo thần kỳ",
        color_start=(0, 100, 80), # Tealish Green
        color_end=(0, 40, 30), # Dark forest
        left_emoji_name="pill_tuvi.png",
        right_emoji_name="linh_thao.png"
    )
    
    # Pagoda Tower
    create_banner(
        filename="leothap_banner.png",
        title="THÁP CỔ VÔ HẠN",
        subtitle="Chinh phục tầng tháp tối cao, khai phá",
        color_start=(50, 0, 100), # Purple violet
        color_end=(10, 0, 30), # Deep violet
        left_emoji_name="talisman.png",
        right_emoji_name="book_martial.png"
    )
    
    print("All assets generated successfully!")
