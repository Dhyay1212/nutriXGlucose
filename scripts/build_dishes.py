"""Build data/dishes.json for NutriX Glucose from the NutriX Food Dataset.
Usage: python3 scripts/build_dishes.py "<Food Dataset dir>"
Sources:
  - INDB.xlsx (Indian Nutrient Databank, per 100 g and per serving) -> curated everyday dishes, checked=False until a dietitian signs off
  - all_217_regional_recipes_and_ingredients.csv -> regional catalogue, per-serving estimates
Katori sizes (NutriX design): 180 g for dals/curries/liquids, 150 g for rice and grain dishes, 120 g for dry sabzi.
"""
import json, re, sys
import pandas as pd

SRC = sys.argv[1]
indb = pd.read_excel(f"{SRC}/INDB.xlsx").set_index("food_code")

LIQ, GRAIN, DRY = 180, 150, 120
# Excluded after review: deep-fried items (INDB counts all frying oil), plain poha BFP044 and omelette ASC061 (oil-heavy),
# khaman BFP439 (serving weight inconsistent with its carbs).
# id, display name, INDB code, unit, mode, grams per unit (per100 mode), aliases (incl. YOLO class names)
CURATED = [
 ("plain_rice","Plain rice","ASC113","katori","per100",GRAIN,["boiled rice","steamed rice","white rice","chawal","bhaat","whiterice","rice -chamal-","rice"]),
 ("jeera_rice","Jeera rice","BFP134","katori","per100",GRAIN,["cumin rice","jeera pulao","zeera rice"]),
 ("plain_pulao","Plain pulao","ASC114","katori","per100",GRAIN,["pulao","pulav"]),
 ("veg_pulao","Vegetable pulao","ASC115","katori","per100",GRAIN,["mixed vegetable pulao","veg pulav"]),
 ("lemon_rice","Lemon rice","ASC124","katori","per100",GRAIN,["chitranna","pulihora","elumichai sadam"]),
 ("curd_rice","Curd rice","ASC126","katori","per100",GRAIN,["dahi chawal","thayir sadam","daddojanam"]),
 ("veg_biryani","Veg biryani","ASC123","katori","per100",GRAIN,["vegetable biryani","biryani","biriyani"]),
 ("mutton_biryani","Mutton biryani","ASC122","katori","per100",GRAIN,["meat biryani","gosht biryani"]),
 ("veg_khichdi","Vegetable khichdi","ASC487","katori","per100",GRAIN,["khichdi","khichri","dal khichdi"]),
 ("sabudana_khichdi","Sabudana khichdi","OSR099","katori","per100",GRAIN,["sago khichdi"]),
 ("poha","Poha","BFP045","katori","per100",GRAIN,["kanda poha","batata poha","vegetable poha","aval","flattened rice"]),
 ("upma","Rava upma","BFP039","katori","per100",GRAIN,["upma","suji upma","uppittu"]),
 ("veg_upma","Vegetable upma","BFP043","katori","per100",GRAIN,[]),
 ("roti","Roti / chapati","ASC096","piece","serving",None,["chapati","phulka","fulka","rotli","wheat roti","wheat"]),
 ("plain_paratha","Plain paratha","ASC097","piece","serving",None,["paratha","parantha"]),
 ("aloo_paratha","Aloo paratha","ASC098","piece","serving",None,["potato paratha","aloo parantha"]),
 ("thepla","Methi thepla","OSR104","piece","serving",None,["thepla"]),
 ("makki_roti","Makki ki roti","ASC150","piece","serving",None,["makki roti","corn roti"]),
 ("puran_poli","Puran poli","ASC467","piece","serving",None,["puranpoli","obbattu"]),
 ("idli","Idli","ASC144","piece","per100",40,["idly"]),
 ("plain_dosa","Plain dosa","BFP148","piece","serving",None,["dosa","sada dosa","dosai"]),
 ("masala_dosa","Masala dosa","ASC146","piece","serving",None,["potato dosa","aloomasala"]),
 ("rava_dosa","Rava dosa","ASC147","piece","serving",None,["semolina dosa","suji dosa"]),
 ("uttapam","Uttapam","BFP152","piece","serving",None,["uthappam"]),
 ("dhokla","Dhokla","ASC474","piece","serving",None,["besan dhokla","khaman","khaman dhokla"]),
 ("moong_dal","Moong dal","ASC151","katori","per100",LIQ,["yellow moong dal","dhuli moong dal","green gram dal","yellow lentils"]),
 ("toor_dal","Toor dal (with spinach)","BFP172","katori","per100",LIQ,["dal","toor dal","arhar dal","tuvar dal","rahar ko daal","dal tadka","dal fry","varan","pappu"]),
 ("urad_dal","Urad dal","ASC152","katori","per100",LIQ,["dhuli urad dal"]),
 ("sabut_moong","Whole moong dal","BFP178","katori","per100",LIQ,["sabut moong","green gram","green lentils"]),
 ("dal_makhani","Dal makhani","OSR139","katori","per100",LIQ,["maa ki dal"]),
 ("rajma","Rajma curry","ASC165","katori","per100",LIQ,["rajma","kidney bean curry","rajmacurry","red beans"]),
 ("chole","Chole / chana curry","ASC162","katori","per100",LIQ,["chole","chana masala","chickpea curry","chickpeas","chhole"]),
 ("sambar","Sambar","ASC167","katori","per100",LIQ,["sambhar"]),
 ("rasam","Rasam","BFP176","katori","per100",LIQ,["saaru","charu"]),
 ("palak_paneer","Palak paneer","ASC215","katori","per100",LIQ,["palakpaneer","saag paneer","spinach paneer"]),
 ("matar_paneer","Matar paneer","ASC191","katori","per100",LIQ,["mutter paneer","pea paneer"]),
 ("paneer_curry","Paneer curry","ASC195","katori","per100",LIQ,["paneer masala","shahipaneer","shahi paneer"]),
 ("chicken_curry","Chicken curry","ASC240","katori","per100",LIQ,["chicken masala","murgh curry","chicken"]),
 ("egg_curry","Egg curry","BFP240","katori","per100",LIQ,["anda curry"]),
 ("fish_curry","Fish curry","ASC246","katori","per100",LIQ,["machli curry","fishcurry","meen curry","fish"]),
 ("aloo_gobi","Aloo gobi","ASC171","katori","per100",DRY,["aloogobi","potato cauliflower"]),
 ("aloo_matar","Aloo matar","ASC190","katori","per100",LIQ,["potato peas curry"]),
 ("aloo_sabzi","Dry aloo sabzi","ASC178","katori","per100",DRY,["aloo sabzi","sukhe aloo","batata bhaji","potato sabzi","potato"]),
 ("aloo_methi","Aloo methi","ASC175","katori","per100",DRY,[]),
 ("bhindi","Bhindi sabzi","BFP269","katori","per100",DRY,["bhindimasala","okra","bhindi masala","lady finger"]),
 ("baingan_bharta","Baingan bharta","ASC177","katori","per100",DRY,["brinjal bharta","brinjal","eggplant"]),
 ("cabbage_matar","Cabbage matar","ASC173","katori","per100",DRY,["cabbage sabzi","patta gobhi","cabbage"]),
 ("cucumber_raita","Cucumber raita","ASC273","katori","per100",GRAIN,["raita","kheera raita"]),
 ("tomato_onion_raita","Tomato onion raita","ASC269","katori","per100",GRAIN,[]),
 ("salad","Tossed salad","ASC260","katori","per100",100,["salad","kachumber","green salad","cucumber"]),
 ("sprouts_salad","Sprouted moong salad","ASC259","katori","per100",100,["sprouts","moong sprouts"]),
 ("rice_kheer","Rice kheer","ASC282","katori","per100",GRAIN,["kheer","payasam","chawal ki kheer"]),
 ("shrikhand","Shrikhand","OSR024","katori","per100",100,["sweetened yogurt"]),
 ("sweet_lassi","Sweet lassi","ASC021","glass","per100",250,["lassi","meethi lassi"]),
 ("salted_lassi","Salted lassi / chaas","ASC022","glass","per100",250,["chaas","buttermilk","chhach"]),
 ("tea","Tea with milk and sugar","ASC001","cup","per100",150,["chai","masala chai","garam chai"]),
 ("coffee","Coffee with milk","BFP008","cup","per100",150,["filter coffee"]),
 ("tandoori_chicken","Tandoori chicken","ASC241","piece","per100",100,["kebab","chicken tikka"]),
 ("pav_bhaji","Pav bhaji (bhaji only)","OSR112","katori","per100",LIQ,["pav bhaji","bhaji"]),
]
NUTS = [("kcal","energy_kcal"),("carbs","carb_g"),("protein","protein_g"),("fat","fat_g"),("fibre","fibre_g"),("sugar","freesugar_g")]
out, issues = [], []
for did, name, code, unit, mode, grams, aliases in CURATED:
    r = indb.loc[code]
    if mode == "per100":
        g = grams
        per = {k: round(float(r[c]) * g / 100, 1) for k, c in NUTS}
    else:
        per = {k: round(float(r["unit_serving_" + c]), 1) for k, c in NUTS}
        g = round(float(r["unit_serving_carb_g"]) / float(r["carb_g"]) * 100) if r["carb_g"] > 0.5 else None
    macro = 4 * per["carbs"] + 4 * per["protein"] + 9 * per["fat"]
    if per["kcal"] and abs(macro / per["kcal"] - 1) > 0.15:
        issues.append(f"{did}: kcal {per['kcal']} vs macros {macro:.0f}")
    out.append({"id": did, "name": name, "aliases": aliases, "unit": unit, "unitGrams": g, "perUnit": per,
                "source": "INDB", "sourceCode": code, "sourceName": r["food_name"], "cuisine": "Everyday Indian",
                "checked": False})

# ---- All remaining INDB recipes (A to Z) ----
curated_codes = {c[2] for c in CURATED}
excluded_fried = []
BOWL = {"bowl", "small bowl", "curry bowl", "plate", "small plate", "dish", "soup bowl", "large bowl", "big bowl"}
DRINK = {"glass", "tall glass", "juice glass", "small glass", "cup", "tea cup", "mug", "coffee mug"}
SKIP = re.compile(r"powder|masala$|baghar|tadka\)|paste|stock|essence|infant", re.I)
def fnum(x):
    try:
        v = float(x); return None if v != v else v
    except Exception: return None
for code, r in indb.iterrows():
    if code in curated_codes or SKIP.search(str(r["food_name"])): continue
    e100, c100 = fnum(r["energy_kcal"]), fnum(r["carb_g"])
    if not e100: continue
    su = str(r["servings_unit"]).strip().lower() if isinstance(r["servings_unit"], str) else ""
    has_serv = fnum(r["unit_serving_energy_kcal"]) is not None
    oily = (fnum(r["fat_g"]) or 0) * 9 / e100 > 0.6 and e100 > 350
    warn = None
    if oily:
        excluded_fried.append(code); continue  # INDB counts all frying oil; the reference table covers common fried foods
    if su in BOWL or not su:
        unit, g = "katori", GRAIN
        per = {k: round((fnum(r[c]) or 0) * g / 100, 1) for k, c in NUTS}
    elif su in DRINK:
        unit = "glass" if "glass" in su else "cup"
        g = 250 if unit == "glass" else 150
        per = {k: round((fnum(r[c]) or 0) * g / 100, 1) for k, c in NUTS}
    elif has_serv:
        unit = "piece"
        per = {k: round(fnum(r["unit_serving_" + c]) or 0, 1) for k, c in NUTS}
        g = round(fnum(r["unit_serving_carb_g"]) / c100 * 100) if c100 and c100 > 0.5 and fnum(r["unit_serving_carb_g"]) else None
        if g is None or g > 200:  # INDB "serving" is a whole pie/cake/dish -> use a 100 g serving instead
            unit, g = "serving", 100
            per = {k: round((fnum(r[c]) or 0), 1) for k, c in NUTS}
    else:
        continue
    out.append({"id": "indb_" + code.lower(), "name": r["food_name"], "aliases": [], "unit": unit, "unitGrams": g,
                "perUnit": per, "source": "INDB", "sourceCode": code, "sourceName": r["food_name"],
                "cuisine": "INDB (all recipes)", "servingNote": su or None, "warning": warn, "checked": False})

# ---- Reference table (98 common dishes, generic per-serving values) ----
ref_rows = [l.rstrip("\n") for l in open(f"{SRC}/indian_food_nutrition_dataset.csv", encoding="utf-8")][1:]
for l in ref_rows:
    if not l.strip(): continue
    f = l.split(","); diet = f[-1]; fat, carb, prot, cal = [float(x) for x in (f[-2], f[-3], f[-4], f[-5])]
    rest = f[:-5]; serving = rest[-1].strip(); cat = rest[-2].strip(); name = ",".join(rest[:-2]).strip()
    if cat == "Spice Mix": continue
    m = re.match(r"\s*(\d+)\s*([a-zA-Z]+)\s*\((\d+)\s*(g|ml)\)", serving)
    if not m: continue
    n, kind, grams = int(m.group(1)), m.group(2).lower(), int(m.group(3))
    vals = {"kcal": cal, "carbs": carb, "protein": prot, "fat": fat, "fibre": 0.0, "sugar": None}
    if kind.startswith("piece"):
        unit, g = "piece", round(grams / n); per = {k: (round(v / n, 1) if v is not None else None) for k, v in vals.items()}
    elif kind in ("bowl", "plate") or (kind == "cup" and "Rice" in name):
        unit = "katori"; g = GRAIN if kind == "plate" or "Rice" in name else LIQ
        per = {k: (round(v * g / grams, 1) if v is not None else None) for k, v in vals.items()}
    elif kind in ("glass", "cup"):
        unit, g, per = kind, grams, vals
    else:
        unit, g, per = "serving", grams, vals
    out.append({"id": "ref_" + re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_"), "name": name + " (reference)", "aliases": [name.lower()],
                "unit": unit, "unitGrams": g, "perUnit": per, "source": "Reference table (estimate)", "sourceCode": serving,
                "sourceName": name, "cuisine": "Reference (" + cat + ")", "dietaryTag": diet, "checked": False})

# Regional catalogue (per-serving estimates); drop the duplicate Basundi
reg = pd.read_csv(f"{SRC}/all_217_regional_recipes_and_ingredients.csv")
reg = reg.drop_duplicates(subset=["Dish Name"], keep="first")
def g(s, k):
    m = re.search(k + r"[^0-9(]*\(?\s*([0-9.]+)\s*g", str(s), re.I)
    return float(m.group(1)) if m else 0.0
def slug(s): return "reg_" + re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")[:48]
for _, r in reg.iterrows():
    per = {"kcal": float(r["Calories (per serving)"]), "carbs": g(r["Key Nutrients"], "Carbohydrate"),
           "protein": g(r["Key Nutrients"], "Protein"), "fat": g(r["Key Nutrients"], "Fat"),
           "fibre": g(r["Key Nutrients"], "Fiber"), "sugar": None}
    out.append({"id": slug(r["Dish Name"]), "name": r["Dish Name"], "aliases": [], "unit": "serving", "unitGrams": None,
                "perUnit": per, "source": "Regional layer (estimate)", "sourceCode": f"class {int(r['Class_ID'])}",
                "sourceName": r["Dish Name"], "cuisine": r["Cuisine"], "mealType": r["Meal Type"],
                "dietaryTag": r["Dietary Tag"], "checked": False})

# ---- Micronutrients for INDB dishes (lazy-loaded by the app from public/data/micros.json) ----
# key, INDB column(s), divisor to app unit (mg -> g for fatty acids)
MICROS = [
    ("sugar", ["freesugar_g"], 1), ("satfat", ["sfa_mg"], 1000), ("mufa", ["mufa_mg"], 1000), ("pufa", ["pufa_mg"], 1000),
    ("cholesterol", ["cholesterol_mg"], 1), ("sodium", ["sodium_mg"], 1), ("potassium", ["potassium_mg"], 1),
    ("calcium", ["calcium_mg"], 1), ("phosphorus", ["phosphorus_mg"], 1), ("magnesium", ["magnesium_mg"], 1),
    ("iron", ["iron_mg"], 1), ("zinc", ["zinc_mg"], 1), ("copper", ["copper_mg"], 1), ("manganese", ["manganese_mg"], 1),
    ("selenium", ["selenium_ug"], 1), ("chromium", ["chromium_mg"], 1), ("vitA", ["vita_ug"], 1), ("carotenoids", ["carotenoids_ug"], 1),
    ("vitD", ["vitd2_ug", "vitd3_ug"], 1), ("vitE", ["vite_mg"], 1), ("vitK", ["vitk1_ug", "vitk2_ug"], 1),
    ("vitB1", ["vitb1_mg"], 1), ("vitB2", ["vitb2_mg"], 1), ("vitB3", ["vitb3_mg"], 1), ("vitB5", ["vitb5_mg"], 1),
    ("vitB6", ["vitb6_mg"], 1), ("vitB7", ["vitb7_ug"], 1), ("folate", ["folate_ug"], 1), ("vitC", ["vitc_mg"], 1),
]
micro_keys = [k for k, _, _ in MICROS]
micros = {}
code_of = {d["id"]: d["sourceCode"] for d in out if d["source"] == "INDB"}
for d in out:
    if d["source"] != "INDB": continue
    r = indb.loc[d["sourceCode"]]
    vals = []
    serving_mode = d["unit"] == "piece" and d["id"] in {c[0] for c in CURATED if c[4] == "serving"} or (d["id"].startswith("indb_") and d["unit"] == "piece")
    for k, cols, div in MICROS:
        tot = 0.0
        for c in cols:
            if serving_mode:
                v = r.get("unit_serving_" + c)
            else:
                v = r.get(c)
                v = (float(v) * (d["unitGrams"] or 100) / 100) if v == v and v is not None else None
            try:
                v = float(v)
                if v == v: tot += v
            except Exception:
                pass
        vals.append(round(tot / div, 3))
    micros[d["id"]] = vals
import os
os.makedirs("public/data", exist_ok=True)
json.dump({"keys": micro_keys, "source": "INDB", "values": micros}, open("public/data/micros.json", "w"), separators=(",", ":"))
print("micronutrients for", len(micros), "INDB dishes,", len(micro_keys), "nutrients")

ids = [d["id"] for d in out]
assert len(ids) == len(set(ids)), "duplicate ids"
json.dump(out, open("data/dishes.json", "w"), ensure_ascii=False, separators=(",", ":"))
from collections import Counter
print(len(out), "dishes:", Counter(d["source"] + (" (curated)" if d["cuisine"] == "Everyday Indian" else "") for d in out))
print("excluded deep-fried INDB rows:", len(excluded_fried))
print("kcal/macro mismatches:", issues or "none")
