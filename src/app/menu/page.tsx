import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/placeholder-page";
export const metadata: Metadata = { title: "Моето меню" };
export default function MenuPage() {
  return <PlaceholderPage title="Моето меню" description="Скоро тук ще можеш да планираш какво да сготвиш през седмицата. А дотогава — открий следващата си любима рецепта." action={{ href: "/search", label: "Открий рецепти" }} />;
}
