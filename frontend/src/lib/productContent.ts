export type ProductCategory = "Bedding" | "Pillows" | "Home";

export type ProductContent = {
  category: ProductCategory;
  image: string;
  tint: string;
  summary: string;
  details: string[];
};

const fallback: ProductContent = {
  category: "Home",
  image: "/images/products/fallback.svg",
  tint: "#eef1f7",
  summary: "A considered everyday essential.",
  details: ["Carefully selected materials", "Ships free"],
};

const contentById: Record<string, ProductContent> = {
  "11111111-1111-4111-8111-111111111111": {
    category: "Bedding",
    image: "/images/products/merino-blanket.svg",
    tint: "#efe6d6",
    summary: "A breathable merino layer that keeps you warm without trapping heat.",
    details: ["100% merino wool", "Temperature regulating", "Queen size, 230 × 250 cm"],
  },
  "22222222-2222-4222-8222-222222222222": {
    category: "Bedding",
    image: "/images/products/linen-sheet-set.svg",
    tint: "#eef0f4",
    summary: "Stonewashed linen that gets softer with every wash.",
    details: ["Fitted sheet, flat sheet, two pillowcases", "European flax linen", "Pre-washed for softness"],
  },
  "33333333-3333-4333-8333-333333333333": {
    category: "Pillows",
    image: "/images/products/down-pillow.svg",
    tint: "#e8eef8",
    summary: "Medium-support down pillow for back and side sleepers.",
    details: ["Responsibly sourced down", "Cotton sateen shell", "Machine washable"],
  },
  "44444444-4444-4444-8444-444444444444": {
    category: "Bedding",
    image: "/images/products/wool-throw.svg",
    tint: "#ece4dc",
    summary: "A heavyweight herringbone throw for the end of the bed or the sofa.",
    details: ["Woven wool blend", "Fringed edges", "130 × 180 cm"],
  },
  "55555555-5555-4555-8555-555555555555": {
    category: "Home",
    image: "/images/products/cedar-sachet.svg",
    tint: "#f1eadf",
    summary: "Natural cedar blocks that keep drawers fresh and moth-free.",
    details: ["Set of four sachets", "Untreated red cedar", "Refresh by lightly sanding"],
  },
  "66666666-6666-4666-8666-666666666666": {
    category: "Pillows",
    image: "/images/products/travel-eye-mask.svg",
    tint: "#e5e8ef",
    summary: "Contoured silk eye mask that blocks light without pressing on your eyes.",
    details: ["Mulberry silk", "Adjustable strap", "Includes travel pouch"],
  },
};

export const productCategories: ProductCategory[] = ["Bedding", "Pillows", "Home"];

export function productContent(productId: string): ProductContent {
  return contentById[productId] ?? fallback;
}
