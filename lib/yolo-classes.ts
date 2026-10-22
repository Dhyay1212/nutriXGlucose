// Generated: class names of the NutriX YOLOv8n detector (model/best.pt, order = training data.yaml)
// and the mapping from prepared-dish classes to NutriX dish IDs. Raw-ingredient classes are not mapped.
export const YOLO_CLASSES: string[] = ["almond", "aloogobi", "aloomasala", "apple", "artichoke", "ash gourd -kubhindo-", "asparagus", "avocado", "bamboo shoots -tama-", "banana", "beans", "beet", "bell pepper", "bhatura", "bhindimasala", "biryani", "bitter gourd", "black beans", "blackberry", "blueberry", "bottle gourd -lauka-", "bread", "brinjal", "broad beans -bakullo-", "broccoli", "brussels sprouts", "buff meat", "cabbage", "capsicum", "carrot", "cauliflower", "celery", "chai", "cherry", "chicken", "chicken gizzards", "chickpeas", "chili pepper -khursani-", "chole", "coconutchutney", "corn", "cucumber", "dal", "dosa", "dumaloo", "egg", "eggplant", "farsi ko munta", "fiddlehead ferns -niguro-", "fish", "fishcurry", "garlic", "ghevar", "grape", "green bean", "green brinjal", "green gram", "green lentils", "green onion", "green peas", "green soyabean -hariyo bhatmas-", "greenchutney", "gulabjamun", "gundruk", "hot pepper", "idli", "jack fruit", "jalebi", "kebab", "kheer", "kiwi", "kulfi", "lassi", "lemon", "lettuce", "lime", "long beans -bodi-", "mandarin", "masyaura", "minced meat", "mushroom", "mutton", "muttoncurry", "onion", "onionpakoda", "orange", "palakpaneer", "papaya", "pattypan squash", "pea", "peach", "pear", "pineapple", "poha", "potato", "pumpkin", "pumpkin -farsi-", "radish", "rahar ko daal", "rajmacurry", "rasmalai", "raspberry", "red beans", "red lentils", "rice -chamal-", "samosa", "shahipaneer", "soyabean-bhatmas-", "sponge gourd -ghiraula-", "squash -iskus-", "stinging nettle -sisnu-", "strawberry", "sweet potato -suthuni-", "tomato", "tree tomato -rukh tamatar-", "turnip", "vegetable marrow", "wallnut", "watermelon", "wheat", "whiterice", "yam -pidalu-", "yellow lentils"];

export const YOLO_TO_DISH: Record<string, string> = {
  "aloogobi": "aloo_gobi",
  "aloomasala": "aloo_sabzi",
  "bhatura": "ref_chole_bhature",
  "bhindimasala": "bhindi",
  "biryani": "veg_biryani",
  "chai": "tea",
  "chole": "chole",
  "coconutchutney": "ref_coconut_chutney",
  "dal": "toor_dal",
  "dosa": "plain_dosa",
  "fishcurry": "fish_curry",
  "greenchutney": "ref_mint_chutney",
  "gulabjamun": "ref_gulab_jamun",
  "idli": "idli",
  "jalebi": "ref_jalebi",
  "kebab": "ref_chicken_tikka",
  "kheer": "rice_kheer",
  "lassi": "sweet_lassi",
  "muttoncurry": "ref_mutton_curry",
  "onionpakoda": "ref_pakora",
  "palakpaneer": "palak_paneer",
  "poha": "poha",
  "rahar ko daal": "toor_dal",
  "rajmacurry": "rajma",
  "samosa": "ref_samosa",
  "shahipaneer": "ref_shahi_paneer",
  "whiterice": "plain_rice",
  "yellow lentils": "moong_dal",
  "egg": "indb_asc056",
  "ghevar": "reg_ghevar",
  "rasmalai": "indb_bfp393",
  "kulfi": "indb_asc321"
};
