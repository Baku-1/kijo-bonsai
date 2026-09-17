import { Droplets, HelpCircle, Moon, Scissors, Spline, Volume2, VolumeX, RotateCcw } from "lucide-react";
import { SEASONS } from "@/lib/game/types";
import type { Tool } from "@/lib/game/types";
import { isMuted, setMuted, unlockAudio } from "@/lib/game/audio";
import { useGame } from "@/lib/game/store";
import { useEffect, useState } from "react";

const TOOLS: { id: Tool; label: string; icon: typeof Droplets }[] = [
  { id: "look", label: "Look", icon: RotateCcw },
  { id: "water", label: "Water", icon: Droplets },
  { id: "prune", label: "Prune", icon: Scissors },
  { id: "wire", label: "Wire", icon: Spline },
  { id: "rest", label: "Rest", icon: Moon },
];

export function Overlay() {
  const phase = useGame((s) => s.phase);
  const tree = useGame((s) => s.tree);
  const tool = useGame((s) => s.tool);
  const toast = useGame((s) => s.toast);
  const help = useGame((s) => s.help);
  const enter = useGame((s) => s.enter);
  const newSapling = useGame((s) => s.newSapling);
  const setTool = useGame((s) => s.setTool);
  const [mute, setMute] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => useGame.setState({ toast: null }), 1600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const hint =
    tool === "prune"
      ? "Click a branch to cut it. Energy returns to the parent."
      : tool === "wire"
        ? "Click a branch, then drag to bend it."
        : tool === "water"
          ? "Water the pot. Moisture is spent when you rest."
          : "Drag to orbit. Scroll or pinch to move closer.";

  return (
    <div className="hud">
      {phase === "title" && (
        <div className="title-layer">
          <div className="overlay-title">
            <p className="hud-kicker">A quiet practice</p>
            <h1>Bonsai Atelier</h1>
            <p>Tend a living pine. Water, prune, wire, and rest through the seasons until the silhouette finds its form.</p>
            <div className="title-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  unlockAudio();
                  enter();
                }}
              >
                Enter the atelier
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  unlockAudio();
                  newSapling();
                }}
              >
                Start a sapling
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "play" && (
        <>
          <div className="hud-top">
            <div className="hud-panel hud-meta">
              <span className="hud-kicker">{SEASONS[tree.season]}</span>
              <span className="hud-stat">{tree.ageYears.toFixed(1)} years</span>
              <div className="hud-row" style={{ marginTop: 8 }}>
                <span className="hud-kicker">Harmony {Math.round(tree.harmony * 100)}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div className="hud-panel meter">
                <div className="meter-label">
                  <span>Moisture</span>
                  <span>{Math.round(tree.moisture * 100)}</span>
                </div>
                <div className="meter-track">
                  <div className="meter-fill" style={{ width: `${tree.moisture * 100}%` }} />
                </div>
                <div className="meter-label" style={{ marginTop: 10 }}>
                  <span>Harmony</span>
                  <span>{Math.round(tree.harmony * 100)}</span>
                </div>
                <div className="meter-track">
                  <div className="meter-fill harmony" style={{ width: `${tree.harmony * 100}%` }} />
                </div>
              </div>
              <button
                className="icon-btn"
                aria-label={mute ? "Unmute" : "Mute"}
                onClick={() => {
                  const next = !mute;
                  setMute(next);
                  setMuted(next);
                  useGame.setState({ muted: next });
                }}
              >
                {mute || isMuted() ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <button
                className="icon-btn"
                aria-label="Help"
                onClick={() => useGame.setState({ help: !help })}
              >
                <HelpCircle size={18} />
              </button>
            </div>
          </div>

          <p className="hint">{hint}</p>

          <div className="tool-bar" role="toolbar" aria-label="Bonsai tools">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              const active = tool === t.id;
              return (
                <button
                  key={t.id}
                  className={`tool-btn${active ? " active" : ""}`}
                  onClick={() => {
                    if (t.id === "water") {
                      useGame.getState().water();
                      setTool("look");
                      return;
                    }
                    setTool(t.id);
                  }}
                >
                  <Icon size={18} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {help && (
        <div className="hud-panel help-card">
          <h2>How to tend</h2>
          <ol>
            <li>Water before you rest, or the pine will thin.</li>
            <li>Prune to open negative space and thicken remaining limbs.</li>
            <li>Wire a branch, then drag to set its line.</li>
            <li>Rest advances a season. Harmony scores taper, pads, age, and care.</li>
          </ol>
          <button
            className="btn btn-ghost"
            style={{ marginTop: 14 }}
            onClick={() => useGame.setState({ help: false })}
          >
            Close
          </button>
        </div>
      )}

      {toast && <div className="saved-toast">{toast}</div>}
    </div>
  );
}
