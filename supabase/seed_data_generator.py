import json, random, re

random.seed(42)

IMAGES = [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80",
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80",
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80",
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80",
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80",
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80",
    "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80",
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80",
    "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1200&q=80",
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80",
]

DISCLAIMER = ("Indicative starting rate per night — placeholder pricing, not a live Booking.com feed. "
              "PengStays admin: verify current rates directly with the property (or via your Booking.com "
              "extranet/partner account) and update this listing's price and details before promoting it.")

def esc(s):
    return s.replace("'", "''")

# ---- Nigeria: one flagship hotel per state (36 states + FCT) ----
nigeria = [
    ("Eko Hotel & Suites", "Victoria Island", "Lagos", 165000),
    ("Transcorp Hilton Abuja", "Maitama", "FCT Abuja", 190000),
    ("Golden Tulip Port Harcourt", "GRA Phase 2", "Rivers", 95000),
    ("Tahir Guest Palace", "Nassarawa GRA", "Kano", 60000),
    ("Premier Hotel", "Mokola", "Oyo", 48000),
    ("Kaduna Guest Palace Hotel", "Kaduna Central", "Kaduna", 42000),
    ("Le Meridien Ibom Hotel & Golf Resort", "Uyo", "Akwa Ibom", 120000),
    ("Cross Point Hotel", "Amawbia", "Anambra", 38000),
    ("Zaranda Hotel", "Bauchi", "Bauchi", 32000),
    ("Aridolf Resort & Spa", "Yenagoa", "Bayelsa", 45000),
    ("Ashi Kene Hotel", "Makurdi", "Benue", 30000),
    ("Maiduguri International Hotel", "Maiduguri", "Borno", 28000),
    ("Transcorp Hotels Calabar", "Murtala Mohammed Highway", "Cross River", 85000),
    ("Grand Hotel", "Asaba", "Delta", 55000),
    ("Halogen Hotel", "Abakaliki", "Ebonyi", 26000),
    ("Protea Hotel by Marriott Benin City", "Reservation Road", "Edo", 65000),
    ("Fountain Hotels", "Ado-Ekiti", "Ekiti", 30000),
    ("Presidential Hotel", "Enugu", "Enugu", 50000),
    ("Family Support Hotel & Suites", "Gombe", "Gombe", 27000),
    ("Concorde Hotel", "Owerri", "Imo", 55000),
    ("Dutse International Hotel", "Dutse", "Jigawa", 24000),
    ("Grand Ivory Hotel", "Katsina", "Katsina", 28000),
    ("Kebbi Guest Inn", "Birnin Kebbi", "Kebbi", 24000),
    ("Confluence Beach Hotel", "Lokoja", "Kogi", 32000),
    ("Kwara Hotel", "Ilorin", "Kwara", 38000),
    ("Lafia City Hotel", "Lafia", "Nasarawa", 26000),
    ("Chida Hotel", "Minna", "Niger", 30000),
    ("Gateway Hotel", "Abeokuta", "Ogun", 40000),
    ("Owena Royal Hotel", "Akure", "Ondo", 38000),
    ("Osun Presidential Hotel", "Osogbo", "Osun", 32000),
    ("Hill Station Hotel", "Jos", "Plateau", 45000),
    ("Sokoto Guest Inn", "Sokoto", "Sokoto", 26000),
    ("Mayor's Hotel", "Jalingo", "Taraba", 24000),
    ("Pinnacle Hotel", "Damaturu", "Yobe", 24000),
    ("Zamfara Hotel", "Gusau", "Zamfara", 24000),
    ("Ahia-Ohuru Hotel", "Umuahia", "Abia", 28000),
    ("Tourist Centre Hotel", "Jimeta-Yola", "Adamawa", 26000),
]

# Africa: one flagship (well-known international-chain) hotel per major country
africa = [
    ("Four Seasons Hotel Cairo at Nile Plaza", "Cairo", "Egypt", 320000),
    ("Villa Rosa Kempinski Nairobi", "Nairobi", "Kenya", 260000),
    ("The Table Bay Hotel", "Cape Town", "South Africa", 340000),
    ("Kempinski Hotel Gold Coast City", "Accra", "Ghana", 280000),
    ("La Mamounia", "Marrakech", "Morocco", 450000),
    ("Sheraton Addis", "Addis Ababa", "Ethiopia", 210000),
    ("Hyatt Regency Dar es Salaam, The Kilimanjaro", "Dar es Salaam", "Tanzania", 230000),
    ("Kigali Marriott Hotel", "Kigali", "Rwanda", 240000),
    ("Radisson Blu Hotel Dakar Sea Plaza", "Dakar", "Senegal", 250000),
    ("Sofitel Abidjan Hotel Ivoire", "Abidjan", "Côte d'Ivoire", 260000),
    ("The Residence Tunis", "Tunis", "Tunisia", 300000),
    ("Sheraton Club des Pins Resort", "Algiers", "Algeria", 220000),
    ("Kampala Serena Hotel", "Kampala", "Uganda", 230000),
    ("Radisson Blu Hotel Lusaka", "Lusaka", "Zambia", 210000),
    ("The Victoria Falls Hotel", "Victoria Falls", "Zimbabwe", 280000),
    ("Hilton Windhoek", "Windhoek", "Namibia", 230000),
    ("Avani Gaborone Resort & Casino", "Gaborone", "Botswana", 200000),
    ("Polana Serena Hotel", "Maputo", "Mozambique", 220000),
    ("Akwa Palace Hotel", "Douala", "Cameroon", 150000),
    ("Pullman Kinshasa Grand Hotel", "Kinshasa", "Congo (DRC)", 260000),
    ("EPIC SANA Luanda Hotel", "Luanda", "Angola", 300000),
    ("One&Only Le Saint Géran", "Grand Baie", "Mauritius", 520000),
    ("Four Seasons Resort Seychelles", "Mahé", "Seychelles", 600000),
    ("Corinthia Hotel Tripoli", "Tripoli", "Libya", 210000),
    ("Corinthia Hotel Khartoum", "Khartoum", "Sudan", 190000),
]

def make_listing(title, city, region, country, price, is_nigeria):
    desc = (f"{title} is one of {region if is_nigeria else country}'s best-known hotels, located in {city}. "
            f"{DISCLAIMER}")
    img1 = random.choice(IMAGES)
    img2 = random.choice(IMAGES)
    while img2 == img1:
        img2 = random.choice(IMAGES)
    return {
        "title": f"{title}, {city}",
        "description": desc,
        "category": "hotel",
        "price": price,
        "price_period": "per_night",
        "country": "Nigeria" if is_nigeria else country,
        "state": region if is_nigeria else None,
        "city": city,
        "bedrooms": None,
        "bathrooms": None,
        "images": [img1, img2],
        "whatsapp_number": "2348146730044",
        "owner_email": "samuelivere92@gmail.com",
        "status": "approved",
        "featured": False,
    }

rows = []
for title, city, state, price in nigeria:
    rows.append(make_listing(title, city, state, "Nigeria", price, True))
for title, city, country, price in africa:
    rows.append(make_listing(title, city, None, country, price, False))

def sql_val(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        return "ARRAY[" + ",".join("'" + esc(x) + "'" for x in v) + "]"
    return "'" + esc(v) + "'"

lines = []
lines.append("-- PengStays starter hotel catalog (Nigeria: all 36 states + FCT, Africa: 25 flagship")
lines.append("-- hotels). Paste into the Supabase SQL Editor and run once, AFTER 0001_init.sql.")
lines.append("--")
lines.append("-- IMPORTANT: these are NOT a live Booking.com feed. Prices are indicative placeholders")
lines.append("-- (also stated in each listing's description) so the catalog isn't empty on launch.")
lines.append("-- Log into the /admin panel, open each listing's 'Edit' button, and update the price,")
lines.append("-- description, and photos once you've confirmed current rates directly with the")
lines.append("-- property or your Booking.com partner account.")
lines.append("")
lines.append("insert into public.listings")
lines.append("  (title, description, category, price, price_period, country, state, city, bedrooms, bathrooms, images, whatsapp_number, owner_email, status, featured)")
lines.append("values")

value_lines = []
for r in rows:
    vals = [
        sql_val(r["title"]), sql_val(r["description"]), sql_val(r["category"]), sql_val(r["price"]),
        sql_val(r["price_period"]), sql_val(r["country"]), sql_val(r["state"]), sql_val(r["city"]),
        sql_val(r["bedrooms"]), sql_val(r["bathrooms"]), sql_val(r["images"]), sql_val(r["whatsapp_number"]),
        sql_val(r["owner_email"]), sql_val(r["status"]), sql_val(r["featured"]),
    ]
    value_lines.append("  (" + ", ".join(vals) + ")")

lines.append(",\n".join(value_lines) + ";")
lines.append("")

with open("/home/claude/afrispace-stay-book/supabase/seed_data/seed_hotels.sql", "w") as f:
    f.write("\n".join(lines))

print(f"Generated {len(rows)} listings ({len(nigeria)} Nigeria + {len(africa)} Africa)")
