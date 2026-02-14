# UI DESIGN INSPIRATION

## Design Gallery Resources

### Meal Planner App Examples
**Dribbble** (Great for overall app inspiration)
- https://dribbble.com/tags/meal-planner
- https://dribbble.com/tags/meal-plan-app
- Look for: weekly calendar views, tag/filter systems, clean navigation

**Behance** (Full case studies with design decisions)
- https://www.behance.net/search/projects/meal%20planner%20app
- https://www.behance.net/search/projects/meal%20plan%20app
- Look for: UX flows, user research, complete design systems

**Pinterest** (Quick visual inspiration)
- https://www.pinterest.com/ideas/meal-planner-app/939284685237/
- Look for: color schemes, layout patterns, component styles

### Recipe Card Design
**Dribbble Recipe Cards**
- https://dribbble.com/tags/recipe_card
- Focus on: how ingredients are displayed, image treatment, card layouts

**Tubik Studio Case Studies** (In-depth analysis)
- https://blog.tubikstudio.com/ui-experiments-options-for-recipe-cards-in-a-food-app/
- https://blog.tubikstudio.com/case-study-recipes-app-ux-design/
- Key takeaways: Various approaches to recipe cards, pros/cons of each layout

**CSS Recipe Cards** (Code examples)
- https://freefrontend.com/css-recipe-cards/
- Useful for: Implementation ideas, interactive effects

### Grocery/Shopping List UI
Search "grocery list app UI" on Dribbble/Behance for:
- Checkoff interactions
- List organization (categories, pantry staples separation)
- Smart combining visual treatment

## Key Design Patterns to Consider

### 1. Recipe Cards
**Visual Hierarchy:**
- Large hero image (appetizing food photo)
- Recipe title prominent
- Quick stats visible (time, servings, difficulty)
- Tags/categories as chips or badges

**Information Display:**
- Ingredients list with clear amounts and units
- Step-by-step instructions numbered
- Expandable sections for space efficiency

### 2. Weekly Calendar View
**Common Patterns:**
- Grid layout: 7 columns (days) × meal types (rows)
- Card-based: Each day is a card with meal slots
- Timeline view: Horizontal scroll through days

**Best Practice:**
- Empty state should be inviting (add your first recipe)
- Drag-and-drop feels natural for meal planning
- Visual indicator for which day is today

### 3. Grocery List
**Organization:**
- Group by category (produce, dairy, meat, pantry)
- OR by recipe (see which recipe needs what)
- Clear visual distinction for checked items (strikethrough, fade out)

**Pantry Staples:**
- Collapsible section (accordion)
- Different visual treatment (lighter, smaller)
- Easy "add to list" action

### 4. Filter/Tag System
**Display:**
- Horizontal scrolling chips (mobile-friendly)
- Multi-select with checkboxes
- Active filters clearly shown with dismiss action

**Categories to Consider:**
- Protein type
- Cuisine
- Cooking method
- Prep time
- Difficulty
- Dietary restrictions

## Color Palette Ideas

**Common Approaches:**
- Fresh/Healthy: Greens and whites (NutriNest pattern)
- Warm/Appetizing: Oranges, reds, warm neutrals
- Modern/Clean: Blues and grays with accent color
- Earthy/Natural: Browns, greens, cream

**Recommended:**
Start with a simple, clean palette:
- Primary: One main brand color
- Neutral: Grays for text and backgrounds
- Accent: One vibrant color for CTAs
- Success/Error: Standard green/red for interactions

## Typography Patterns

**Recipe Apps Commonly Use:**
- Serif fonts for recipe names (feels classic, homey)
- Sans-serif for ingredients and instructions (clear, scannable)
- Monospace for measurements (easy to read numbers)

**Recommended Starting Point:**
- Use system fonts (SF Pro on iOS/Mac, Roboto on Android/web)
- Add one Google Font for personality if desired
- 2-3 font sizes maximum to start

## Interactive Elements

**Servings Adjuster:**
- Stepper buttons (+/-) 
- OR slider
- Live preview of scaled ingredient amounts

**Recipe Addition to Meal Plan:**
- Modal/dialog with day selector
- Drag-and-drop from recipe list to calendar
- Quick add button with dropdown for day selection

**Grocery List Checkoff:**
- Swipe gestures (swipe right to check)
- Tap the item itself
- Checkbox on the left side

## Mobile-First Considerations

Since you're building web app used on phone:
- Touch targets minimum 44×44px
- Bottom navigation for key actions (thumb-friendly)
- Avoid tiny text (16px minimum for body)
- Generous spacing between interactive elements
- Consider sticky headers when scrolling long lists

## Component Libraries to Consider

**Shadcn/ui** (matches your Next.js stack)
- https://ui.shadcn.com/
- Unstyled, customizable components
- Built on Radix UI (accessibility built-in)
- Works great with Tailwind CSS

**Radix UI** (headless components)
- https://www.radix-ui.com/
- Gives you behavior, you style it
- Excellent accessibility
- Used by many recipe/food apps

## Quick Wins for Polish

**Empty States:**
- Friendly illustrations or icons
- Clear call-to-action
- Helpful microcopy ("No recipes yet. Add your first one!")

**Loading States:**
- Skeleton screens for cards
- Smooth transitions
- Optimistic UI updates

**Delight Details:**
- Subtle hover effects on cards
- Satisfying checkmark animation
- Toast notifications for actions

## Examples Worth Deep Diving

**Purple Carrot** (meal planner iOS app)
- Clean, modern aesthetic
- Good calendar/planning interface
- Referenced frequently in design galleries

**NutriNest Case Study**
- https://medium.com/design-bootcamp/family-nutritional-meal-plan-mobile-app-d02d5144f707
- Full UX research and design process
- Good for understanding user flows

## Reference Apps to Try

Actually download and use these to see UX patterns:
- Paprika (recipe keeper - excellent UX)
- Mealime (meal planning - good grocery list)
- Whisk (recipe organization - smart features)
- Plan to Eat (close to your concept)

## Next Steps

1. Browse Dribbble/Behance galleries above
2. Save 10-15 screenshots of patterns you like
3. Create a mood board (can use Figma, Pinterest, or just a folder)
4. Identify 3-5 key patterns to start with:
   - Recipe card layout
   - Weekly calendar structure  
   - Grocery list style
   - Navigation pattern
5. Sketch basic wireframes before jumping to code

## Notes

- Don't copy designs directly - use for inspiration
- Start simple - add polish later
- Test on your actual phone early and often
- Good design is mostly about clear hierarchy and generous spacing
