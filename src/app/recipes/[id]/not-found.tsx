import { PlaceholderPage } from "@/components/ui/placeholder-page";

export default function RecipeNotFound() {
  return <PlaceholderPage title="Рецептата не е намерена." description="Тази рецепта не присъства в демо колекцията. Избери друга вкусна идея от търсенето." action={{ href: "/search", label: "Открий рецепти" }} />;
}
