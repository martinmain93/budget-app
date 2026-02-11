import type { Category } from "./types";

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "groceries", name: "Groceries", color: "#A8D8EA", isDefault: true },
  { id: "housing", name: "Housing", color: "#AA96DA", isDefault: true },
  { id: "utilities", name: "Utilities", color: "#FCBAD3", isDefault: true },
  { id: "transport", name: "Transport", color: "#FBC687", isDefault: true },
  { id: "dining", name: "Dining", color: "#B5EAD7", isDefault: true },
  { id: "health", name: "Health", color: "#C7CEEA", isDefault: true },
  { id: "shopping", name: "Shopping", color: "#FFDAC1", isDefault: true },
  { id: "entertainment", name: "Fun", color: "#E2F0CB", isDefault: true },
  { id: "uncategorized", name: "Uncategorized", color: "#E6E6EA", isDefault: true },
];

export const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
