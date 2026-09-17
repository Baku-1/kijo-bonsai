import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [Game, setGame] = useState<ComponentType | null>(null);

  useEffect(() => {
    void import("@/components/game/BonsaiGame").then((m) => setGame(() => m.BonsaiGame));
  }, []);

  if (!Game) {
    return (
      <div className="splash">
        <div>
          <p className="splash-kicker">A quiet practice</p>
          <h1>Bonsai Atelier</h1>
        </div>
      </div>
    );
  }

  return <Game />;
}
