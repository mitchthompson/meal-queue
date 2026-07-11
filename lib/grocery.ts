export type GroceryMealItem = {
  recipe_id: string | null;
  serving_multiplier: number;
};

export type GroceryIngredient = {
  recipe_id: string;
  name: string;
  amount: number;
  unit_code: string;
  is_pantry_staple: boolean;
};

export type GeneratedGroceryRow = {
  meal_plan_id: string;
  ingredient_name: string;
  amount: number;
  unit_code: string;
  is_pantry_staple: boolean;
  source_key: string;
  is_on_hand: false;
  is_checked: false;
};

export function roundAmount(value: number) {
  return Number(value.toFixed(3));
}

export function formatAmount(value: number) {
  return roundAmount(value).toString();
}

// Imported recipes store "to taste" / "pinch" / "as needed" ingredients as
// amount 0 (see lib/import/prompt.ts), so a zero amount means unquantified,
// not "none".
export function formatIngredientAmount(value: number, unitLabel: string) {
  const rounded = roundAmount(Number(value));
  if (rounded === 0) return "to taste";
  return `${rounded} ${unitLabel}`;
}

export function scaleIngredientAmount(amount: number, multiplier: number) {
  return Number(amount) * Number(multiplier || 1);
}

export function buildGroceryRows(
  plan: { id: string; version: number },
  mealItems: GroceryMealItem[],
  ingredients: GroceryIngredient[],
): GeneratedGroceryRow[] {
  const ingredientsByRecipe = new Map<string, GroceryIngredient[]>();
  for (const ingredient of ingredients) {
    const current = ingredientsByRecipe.get(ingredient.recipe_id) ?? [];
    current.push(ingredient);
    ingredientsByRecipe.set(ingredient.recipe_id, current);
  }

  const combined = new Map<
    string,
    Omit<GeneratedGroceryRow, "meal_plan_id" | "amount" | "is_on_hand" | "is_checked"> & { amount: number }
  >();

  for (const mealItem of mealItems) {
    if (!mealItem.recipe_id) continue;
    const recipeIngredients = ingredientsByRecipe.get(mealItem.recipe_id) ?? [];

    for (const ingredient of recipeIngredients) {
      const ingredientName = ingredient.name.trim();
      const normalizedName = ingredientName.toLowerCase();
      const bucketKey = `${normalizedName}|${ingredient.unit_code}|${ingredient.is_pantry_staple ? "1" : "0"}`;
      const scaledAmount = scaleIngredientAmount(ingredient.amount, mealItem.serving_multiplier);
      const current = combined.get(bucketKey);

      if (current) {
        current.amount += scaledAmount;
      } else {
        combined.set(bucketKey, {
          ingredient_name: ingredientName,
          amount: scaledAmount,
          unit_code: ingredient.unit_code,
          is_pantry_staple: ingredient.is_pantry_staple,
          source_key: `v${plan.version}|${bucketKey}`,
        });
      }
    }
  }

  return Array.from(combined.values()).map((item) => ({
    meal_plan_id: plan.id,
    ingredient_name: item.ingredient_name,
    amount: roundAmount(item.amount),
    unit_code: item.unit_code,
    is_pantry_staple: item.is_pantry_staple,
    source_key: item.source_key,
    is_on_hand: false,
    is_checked: false,
  }));
}
