export interface MealItem {
  dishId: string;
  name: string; // display name (dish table name)
  aiName?: string; // what Claude called it
  portion: number; // number of katoris or pieces
  confidence?: number; // 0..1 from Claude
  custom?: import("./dishes").Dish; // AI-estimated dish not in the NutriX table (kept with the meal)
}

export interface Meal {
  id: string;
  userId: string;
  eatenAt: string; // ISO
  items: MealItem[];
  photo?: string | null; // small JPEG data URL thumbnail
  totals: { kcal: number; carbs: number; protein: number; fat: number; fibre: number };
  logSeconds?: number | null; // time from opening the log screen to saving (pilot metric)
  source?: "photo" | "manual";
  createdAt: string;
}

export interface Reading {
  id: string;
  userId: string;
  takenAt: string; // ISO
  mgdl: number;
  createdAt: string;
}

export interface Note {
  id: string;
  userId: string;
  weekStart: string; // ISO date
  text: string;
  createdAt: string;
}

export interface UserProfile {
  id: string; // pilot ID, e.g. P01
  name: string;
}
