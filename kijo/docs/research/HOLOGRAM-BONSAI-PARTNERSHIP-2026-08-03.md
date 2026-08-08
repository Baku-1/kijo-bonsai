# Hologram Bonsai — Partnership Research
**Date:** 2026-08-03  
**Source:** https://www.kickstarter.com/projects/hologrambonsai/hologram-bonsai-japanese-bonsai-art-hologram-technology-0/description  
**Status:** Candidate partner — outreach recommended

---

## Who They Are

**Creator:** Japanese university senior, Tokyo, Japan  
**Project:** *Hologram Bonsai / ホログラム盆栽*  
**Tagline:** "Japanese bonsai, reimagined as hologram art. Maintenance-free. Updatable scenes."

The creator's philosophy directly mirrors Kijo's:
> "I felt that bonsai, a traditional Japanese art form, has become harder for many people to enjoy because of its demanding maintenance and high barrier to entry… That's why I began reinterpreting bonsai, thinking about a form that would let more people experience its beauty more freely."
> "Tradition must change to survive."

---

## The Technology

**Display type:** POV (Persistence of Vision) hologram fan  
- Spinning LED blades create a floating 3D effect
- Content delivered via microSD card (offline autoplay)
- Components: YESTEC-sourced LED display hardware
- Ships with acrylic case for safety (blades spin at speed)

**Display characteristics:**
- Creates a "floating" 3D depth effect — hologram-*ish*, not true hologram
- Best viewed in low-light environments
- Color tends slightly greener in person vs. video (LED/camera behavior)
- Minor blur possible on fast motion (POV physics)
- Black background = appears transparent → objects "float in air"

**Content format:**
- Seamless looping video files on microSD
- ~20-minute loop: Blooming / 360° Rotation / Falling scenes
- Updatable — new scenes can be loaded by swapping/updating the microSD

---

## Campaign Status (Critical Context)

**Campaign: FUNDING UNSUCCESSFUL**  
- Goal: $3,513 | Raised: $2,046 (58%) | Backers: 9  
- Closed: April 6, 2026 (4 months ago)

**Why this matters for partnership:**  
The creator is a student with a validated concept but no capital, no traction, and a failed campaign. They are almost certainly open to new approaches. Kijo could offer what they couldn't find on Kickstarter: a built-in audience of NFT holders who want a physical manifestation of their digital bonsai.

---

## The Kijo Fit

This is an exceptionally strong concept alignment:

| Kijo | Hologram Bonsai |
|------|----------------|
| Unique 3D bonsai generated from NFT seed | Hologram display showing bonsai scenes |
| Digital ownership (on-chain) | Physical display of that ownership |
| "Care for your tree" game loop | "Maintenance-free bonsai" hardware |
| Japanese aesthetics + web3 | Japanese aesthetics + hologram tech |
| Three.js 3D renderer | Needs video content for SD card |

**The pitch:** *"Mint a Kijo NFT → your unique tree, grown by you, displayed as a floating hologram in your home."*

---

## What We'd Need to Build (Technical)

To support hologram display, Kijo needs a video export pipeline:

### 1. Black-background render mode
Three.js scene already exists. Need a mode that:
- Sets scene background to `#000000` (black = transparent on POV fan)
- Removes any background geometry (skybox, floor, etc.)
- Renders the bonsai tree only, centered

### 2. Video export pipeline
POV fans accept MP4/AVI on microSD. Options:
- **Server-side render:** Node.js + headless Three.js + `ffmpeg` to generate a looping video of the tree (360° rotation, blooming animation, falling leaves)
- **Client-side capture:** `MediaRecorder` API on the Three.js canvas, record a rotation loop, export as webm/mp4
- Recommended resolution: 512×512 or 384×384 (circular display, square source)
- Target: seamless 30-second loop (rotation + seasonal moment)

### 3. Content delivery
- Option A: Generate video on-demand after mint, provide download link
- Option B: If partnered with hardware creator, pre-load on SD card included with physical package
- Option C: NFT metadata includes a link to the hologram video file (updatable when tree grows)

### 4. Scene variants to generate
Following their content model:
- **360° Rotation** — slow spin, black bg, showcasing the full tree structure
- **Blooming** — seasonal burst animation (spring blossoms if applicable)
- **Falling** — leaves/particles drifting (autumn, or a day-tick animation)

---

## Partnership Approach

### Angle 1: Content + Hardware bundle
Kijo provides: unique tree video content (generated from NFT)  
They provide: hologram fan hardware  
User buys: Kijo NFT → option to add hologram hardware display

### Angle 2: Co-brand / co-launch
Help them relaunch their Kickstarter with Kijo NFT integration as the content hook.  
Their campaign failed partly because "what do I display on it?" is a hard sell.  
Kijo answers that: *every NFT holder gets unique, personalized content.*

### Angle 3: License the hardware design
Commission them to manufacture for Kijo, white-label the hardware.

---

## Recommended Next Steps

1. **Outreach:** Contact via Kickstarter creator page. University student in Tokyo — likely responds to direct, respectful DMs. Reference the shared philosophy.
2. **Demo first:** Build the black-background 360° rotation export from Three.js (small task, ~1 day). Have something visual to show them.
3. **Propose:** Content partnership — Kijo generates the video files, they supply the hardware path.

---

## Open Questions

- What resolution/format does their specific POV display accept? (Need specs)
- Can the SD card content be updated OTA (wifi-capable unit?) or physical swap only?
- Are they open to white-label / volume manufacturing?
- What is their unit cost at scale vs. the $3,513 crowdfund goal?
- Are they still active / building? (Campaign closed April 2026 — follow up needed)
