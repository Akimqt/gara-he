export type Size = "12oz" | "16oz" | "20oz" | "single";

export type MenuItem = {
  id: string;
  name: string;
  category: string;
  sizes: { size: Size; price: number }[];
  bestSeller?: boolean;
  available: boolean;
};

// Default category list used to seed the (now editable, see pos-store.ts
// `useCategories`) category list on first run. Kept as a plain string[]
// (not `as const`) since categories are no longer a fixed set — new ones
// can be added/removed from the Admin page and persisted to localStorage.
export const SEED_CATEGORIES: string[] = [
  "Iced Coffee",
  "Hot Coffee",
  "Berries Series",
  "Non-Coffee",
  "Fruit Soda",
  "Frappe",
  "Waffles",
  "Nachos",
  "Add-ons",
];

const s2 = (a: number, b: number): { size: Size; price: number }[] => [
  { size: "16oz", price: a },
  { size: "20oz", price: b },
];
const s3 = (a: number, b: number, c: number): { size: Size; price: number }[] => [
  { size: "12oz", price: a },
  { size: "16oz", price: b },
  { size: "20oz", price: c },
];
const single = (p: number): { size: Size; price: number }[] => [{ size: "single", price: p }];
// Hot Coffee only comes in one size (16oz), priced 10 pesos below the
// corresponding Iced Coffee 16oz price.
const hot16 = (p: number): { size: Size; price: number }[] => [{ size: "16oz", price: p }];

export const SEED_MENU: MenuItem[] = [
  // Iced Coffee
  { id: "ic-americano", name: "Americano / Long Black", category: "Iced Coffee", sizes: s2(99, 129), available: true },
  { id: "ic-spanish", name: "Spanish Latte", category: "Iced Coffee", sizes: s2(119, 149), available: true },
  { id: "ic-oreo", name: "Oreo Latte", category: "Iced Coffee", sizes: s2(129, 159), available: true },
  { id: "ic-nutella", name: "Nutella Latte", category: "Iced Coffee", sizes: s2(179, 209), available: false },
  { id: "ic-biscoff", name: "Biscoff Latte", category: "Iced Coffee", sizes: s2(179, 209), available: true },
  { id: "ic-caramel", name: "Caramel Macchiato", category: "Iced Coffee", sizes: s2(169, 199), bestSeller: true, available: true },
  { id: "ic-mocha", name: "Café Mocha", category: "Iced Coffee", sizes: s2(129, 159), available: true },
  { id: "ic-cinnamon", name: "Cinnamon Latte", category: "Iced Coffee", sizes: s2(139, 169), available: true },
  { id: "ic-vanilla", name: "Vanilla Latte", category: "Iced Coffee", sizes: s2(129, 159), available: true },
  { id: "ic-whitemocha", name: "White Choco Mocha", category: "Iced Coffee", sizes: s2(129, 159), available: true },
  { id: "ic-einspanner", name: "Einspänner Latte", category: "Iced Coffee", sizes: s2(169, 199), available: true },

  // Hot Coffee (mirrors Iced Coffee, 16oz only, 10 pesos cheaper than the iced 16oz price)
  { id: "hc-americano", name: "Americano / Long Black", category: "Hot Coffee", sizes: hot16(89), available: true },
  { id: "hc-spanish", name: "Spanish Latte", category: "Hot Coffee", sizes: hot16(109), available: true },
  { id: "hc-oreo", name: "Oreo Latte", category: "Hot Coffee", sizes: hot16(119), available: true },
  { id: "hc-nutella", name: "Nutella Latte", category: "Hot Coffee", sizes: hot16(169), available: false },
  { id: "hc-biscoff", name: "Biscoff Latte", category: "Hot Coffee", sizes: hot16(169), available: true },
  { id: "hc-caramel", name: "Caramel Macchiato", category: "Hot Coffee", sizes: hot16(159), bestSeller: true, available: true },
  { id: "hc-mocha", name: "Café Mocha", category: "Hot Coffee", sizes: hot16(119), available: true },
  { id: "hc-cinnamon", name: "Cinnamon Latte", category: "Hot Coffee", sizes: hot16(129), available: true },
  { id: "hc-vanilla", name: "Vanilla Latte", category: "Hot Coffee", sizes: hot16(119), available: true },
  { id: "hc-whitemocha", name: "White Choco Mocha", category: "Hot Coffee", sizes: hot16(119), available: true },
  { id: "hc-einspanner", name: "Einspänner Latte", category: "Hot Coffee", sizes: hot16(159), available: true },

  // Berries
  { id: "br-strawberry", name: "Strawberry Latte", category: "Berries Series", sizes: s2(129, 159), available: true },
  { id: "br-strawmatcha", name: "Strawberry Matcha Latte", category: "Berries Series", sizes: s2(169, 199), available: true },

  // Non-Coffee
  { id: "nc-nutella", name: "Nutella Milk", category: "Non-Coffee", sizes: s2(169, 199), available: false },
  { id: "nc-biscoff", name: "Biscoff Milk", category: "Non-Coffee", sizes: s2(169, 199), available: true },
  { id: "nc-matcha", name: "Matcha Latte", category: "Non-Coffee", sizes: s2(159, 189), bestSeller: true, available: true },
  { id: "nc-matchacloud", name: "Matcha Cloud", category: "Non-Coffee", sizes: s2(189, 219), available: true },
  { id: "nc-milkyoreo", name: "Milky Oreo", category: "Non-Coffee", sizes: s2(129, 159), available: true },
  { id: "nc-darkchoco", name: "Dark Choco", category: "Non-Coffee", sizes: s2(128, 159), available: true },
  { id: "nc-cocoa", name: "Cocoa Milk", category: "Non-Coffee", sizes: s2(129, 159), available: false },
  { id: "nc-milodino", name: "Milo Dino", category: "Non-Coffee", sizes: s2(129, 159), available: true },
  { id: "nc-ube", name: "Ube Cloud", category: "Non-Coffee", sizes: s2(119, 149), available: false },
  { id: "nc-biscoffie", name: "Biscoffie Match", category: "Non-Coffee", sizes: s2(189, 219), available: true },

  // Fruit Soda
  { id: "fs-strawberry", name: "Strawberry Soda", category: "Fruit Soda", sizes: s3(59, 79, 99), available: true },
  { id: "fs-lychee", name: "Lychee Soda", category: "Fruit Soda", sizes: s3(59, 79, 99), available: true },
  { id: "fs-blueberry", name: "Blueberry Soda", category: "Fruit Soda", sizes: s3(59, 79, 99), available: true },
  { id: "fs-apple", name: "Green Apple Soda", category: "Fruit Soda", sizes: s3(59, 79, 99), available: true },
  { id: "fs-mango", name: "Mango Soda", category: "Fruit Soda", sizes: s3(59, 79, 99), available: true },

  // Frappe
  { id: "fr-javachip", name: "Java Chip Frappe", category: "Frappe", sizes: s2(159, 189), available: true },
  { id: "fr-cookies", name: "Cookies & Cream Frappe", category: "Frappe", sizes: s2(129, 159), available: true },
  { id: "fr-doublechoco", name: "Double Chocolate Frappe", category: "Frappe", sizes: s2(139, 159), available: true },

  // Waffles
  { id: "wf-plain", name: "Waffle", category: "Waffles", sizes: single(99), available: true },
  { id: "wf-nutella", name: "Nutella Alcapone", category: "Waffles", sizes: single(129), available: true },
  { id: "wf-cookies", name: "Cookies & Cream", category: "Waffles", sizes: single(109), available: true },
  { id: "wf-biscoff", name: "Biscoff Waffle", category: "Waffles", sizes: single(129), available: true },

  // Nachos
  { id: "na-overload", name: "Nachos Overloaaad", category: "Nachos", sizes: single(160), available: true },

  // Add-ons
  { id: "ad-espresso", name: "Espresso Shot", category: "Add-ons", sizes: single(40), available: true },
  { id: "ad-sauce", name: "Sauce / Syrup", category: "Add-ons", sizes: single(35), available: true },
  { id: "ad-whip", name: "Whipped Cream", category: "Add-ons", sizes: single(40), available: true },
];
