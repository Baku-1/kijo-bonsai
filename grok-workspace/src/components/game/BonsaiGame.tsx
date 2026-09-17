import { Overlay } from "./Overlay";
import { GameCanvas } from "./Scene";

export function BonsaiGame() {
  return (
    <main className="game-root">
      <GameCanvas />
      <Overlay />
    </main>
  );
}
