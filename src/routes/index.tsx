import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Экотчи — AI-питомец экономии воды и света" },
      {
        name: "description",
        content:
          "Живой AI-питомец следит за расходом воды и электричества: сводка, цели, 3D-двойник и свет по солнцу.",
      },
      { property: "og:title", content: "Экотчи — AI-питомец экономии ресурсов" },
      {
        property: "og:description",
        content: "Сводка расходов, цели, 3D-двойник помещения и расчёт дневного света.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    window.location.replace("/app/index.html");
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Загружаем Экотчи…</p>
    </div>
  );
}
