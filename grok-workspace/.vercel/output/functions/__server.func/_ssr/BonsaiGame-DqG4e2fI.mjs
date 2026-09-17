import { i as __toESM } from "../_runtime.mjs";
import { $ as require_react, C as LatheGeometry, I as QuadraticBezierCurve3, J as Vector3, L as Quaternion, N as Object3D, O as MathUtils, Q as require_jsx_runtime, R as RepeatWrapping, S as IcosahedronGeometry, U as TextureLoader, b as FogExp2, d as BufferGeometry, f as CanvasTexture, g as Euler, i as Canvas, n as SoftShadows, o as useFrame, p as Color, q as Vector2, r as OrbitControls, s as useThree, t as ContactShadows, u as BufferAttribute, v as Float32BufferAttribute, z as SRGBColorSpace } from "../_libs/@react-three/drei+[...].mjs";
import { a as Scissors, c as Droplets, i as Spline, l as CircleHelp, n as Volume2, o as RotateCcw, s as Moon, t as VolumeX } from "../_libs/lucide-react.mjs";
import { t as create } from "../_libs/zustand.mjs";
import { i as Vignette, n as EffectComposer, r as SMAA, t as Bloom } from "../_libs/@react-three/postprocessing+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/BonsaiGame-DqG4e2fI.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var SEASONS = [
	"Spring",
	"Summer",
	"Autumn",
	"Winter"
];
var ctx = null;
var master = null;
var sfx = null;
var music = null;
var ambient = null;
var muted = false;
function ac() {
	if (!ctx) {
		ctx = new AudioContext({ latencyHint: "interactive" });
		master = ctx.createGain();
		sfx = ctx.createGain();
		music = ctx.createGain();
		sfx.gain.value = .7;
		music.gain.value = .22;
		sfx.connect(master);
		music.connect(master);
		master.connect(ctx.destination);
	}
	return ctx;
}
function unlockAudio() {
	const c = ac();
	if (c.state === "suspended") c.resume();
	if (!ambient) ambient = startAmbient();
}
function setMuted(v) {
	muted = v;
	if (master && ctx) master.gain.setTargetAtTime(v ? 0 : 1, ctx.currentTime, .04);
}
function isMuted() {
	return muted;
}
function envGain(peak, a, r) {
	const c = ac();
	const g = c.createGain();
	g.gain.setValueAtTime(1e-4, c.currentTime);
	g.gain.exponentialRampToValueAtTime(peak, c.currentTime + a);
	g.gain.exponentialRampToValueAtTime(1e-4, c.currentTime + a + r);
	return g;
}
function playWater() {
	const c = ac();
	if (!sfx) return;
	const bufferSize = 2 * c.sampleRate;
	const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
	const src = c.createBufferSource();
	src.buffer = buffer;
	const filter = c.createBiquadFilter();
	filter.type = "bandpass";
	filter.frequency.value = 1400;
	filter.Q.value = .7;
	const g = envGain(.45, .04, .55);
	src.connect(filter);
	filter.connect(g);
	g.connect(sfx);
	src.start();
	src.stop(c.currentTime + .7);
}
function playSnip() {
	const c = ac();
	if (!sfx) return;
	const osc = c.createOscillator();
	osc.type = "triangle";
	osc.frequency.setValueAtTime(1400, c.currentTime);
	osc.frequency.exponentialRampToValueAtTime(180, c.currentTime + .09);
	const g = envGain(.35, .005, .12);
	osc.connect(g);
	g.connect(sfx);
	osc.start();
	osc.stop(c.currentTime + .14);
}
function playBell() {
	const c = ac();
	if (!sfx) return;
	for (const f of [
		392,
		494,
		587
	]) {
		const osc = c.createOscillator();
		osc.type = "sine";
		osc.frequency.value = f * (.98 + Math.random() * .04);
		const g = envGain(.12, .01, .9);
		osc.connect(g);
		g.connect(sfx);
		osc.start();
		osc.stop(c.currentTime + 1);
	}
}
function startAmbient() {
	const c = ac();
	if (!music) return { stop() {} };
	const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
	const src = c.createBufferSource();
	src.buffer = buffer;
	src.loop = true;
	const filter = c.createBiquadFilter();
	filter.type = "lowpass";
	filter.frequency.value = 480;
	const g = c.createGain();
	g.gain.value = .18;
	src.connect(filter);
	filter.connect(g);
	g.connect(music);
	src.start();
	const pad = c.createOscillator();
	pad.type = "sine";
	pad.frequency.value = 110;
	const pg = c.createGain();
	pg.gain.value = .04;
	pad.connect(pg);
	pg.connect(music);
	pad.start();
	return { stop() {
		src.stop();
		pad.stop();
	} };
}
function hash(n) {
	const x = Math.sin(n * 127.1) * 43758.5453;
	return x - Math.floor(x);
}
function hash3(x, y, z) {
	return hash(x * 19.19 + y * 47.7 + z * 13.13);
}
function valueNoise3(x, y, z) {
	const ix = Math.floor(x);
	const iy = Math.floor(y);
	const iz = Math.floor(z);
	const fx = x - ix;
	const fy = y - iy;
	const fz = z - iz;
	const u = fx * fx * (3 - 2 * fx);
	const v = fy * fy * (3 - 2 * fy);
	const w = fz * fz * (3 - 2 * fz);
	const n = (i, j, k) => hash3(i, j, k);
	const x0 = n(ix, iy, iz) * (1 - v) * (1 - w) + n(ix, iy + 1, iz) * v * (1 - w) + n(ix, iy, iz + 1) * (1 - v) * w + n(ix, iy + 1, iz + 1) * v * w;
	const x1 = n(ix + 1, iy, iz) * (1 - v) * (1 - w) + n(ix + 1, iy + 1, iz) * v * (1 - w) + n(ix + 1, iy, iz + 1) * (1 - v) * w + n(ix + 1, iy + 1, iz + 1) * v * w;
	return x0 * (1 - u) + x1 * u;
}
var Rng = class {
	s;
	constructor(seed) {
		this.s = seed >>> 0 || 1;
	}
	next() {
		this.s = this.s * 1664525 + 1013904223 >>> 0;
		return this.s / 4294967295;
	}
	range(a, b) {
		return a + (b - a) * this.next();
	}
};
function b(partial) {
	return {
		pruned: false,
		wired: false,
		wirePitch: 0,
		wireYaw: 0,
		vigor: .85,
		...partial
	};
}
function maturePine(seed = 7) {
	const tree = {
		seed,
		ageYears: 18,
		season: 1,
		moisture: .62,
		health: .92,
		maturity: 1,
		branches: [
			b({
				id: "t0",
				parentId: null,
				attach: 0,
				length: .26,
				radius: .052,
				pitch: .06,
				yaw: .18,
				roll: 0,
				bend: .045,
				dead: false,
				foliage: null
			}),
			b({
				id: "t1",
				parentId: "t0",
				attach: 1,
				length: .3,
				radius: .04,
				pitch: -.14,
				yaw: -.28,
				roll: .1,
				bend: .05,
				dead: false,
				foliage: null
			}),
			b({
				id: "t2",
				parentId: "t1",
				attach: 1,
				length: .28,
				radius: .03,
				pitch: .12,
				yaw: .2,
				roll: -.08,
				bend: .04,
				dead: false,
				foliage: null
			}),
			b({
				id: "t3",
				parentId: "t2",
				attach: 1,
				length: .2,
				radius: .02,
				pitch: -.08,
				yaw: -.1,
				roll: 0,
				bend: .02,
				dead: false,
				foliage: {
					size: .17,
					flatten: .38,
					hue: .02
				}
			}),
			b({
				id: "b-low-r",
				parentId: "t0",
				attach: .82,
				length: .36,
				radius: .018,
				pitch: 1.12,
				yaw: .55,
				roll: .2,
				bend: .08,
				dead: false,
				foliage: {
					size: .21,
					flatten: .34,
					hue: -.02
				}
			}),
			b({
				id: "b-low-r2",
				parentId: "b-low-r",
				attach: .72,
				length: .18,
				radius: .01,
				pitch: .4,
				yaw: .6,
				roll: 0,
				bend: .05,
				dead: false,
				foliage: {
					size: .13,
					flatten: .36,
					hue: .01
				}
			}),
			b({
				id: "jin",
				parentId: "t0",
				attach: .5,
				length: .28,
				radius: .012,
				pitch: 1.05,
				yaw: 3.45,
				roll: .4,
				bend: .1,
				dead: true,
				foliage: null
			}),
			b({
				id: "b-mid-l",
				parentId: "t1",
				attach: .62,
				length: .33,
				radius: .016,
				pitch: .95,
				yaw: 3.05,
				roll: -.15,
				bend: .07,
				dead: false,
				foliage: {
					size: .19,
					flatten: .35,
					hue: 0
				}
			}),
			b({
				id: "b-mid-l2",
				parentId: "b-mid-l",
				attach: .7,
				length: .16,
				radius: .009,
				pitch: .35,
				yaw: -.4,
				roll: 0,
				bend: .04,
				dead: false,
				foliage: {
					size: .11,
					flatten: .4,
					hue: .03
				}
			}),
			b({
				id: "b-mid-r",
				parentId: "t1",
				attach: .92,
				length: .3,
				radius: .015,
				pitch: .78,
				yaw: .42,
				roll: .1,
				bend: .06,
				dead: false,
				foliage: {
					size: .175,
					flatten: .33,
					hue: -.01
				}
			}),
			b({
				id: "b-back",
				parentId: "t1",
				attach: .48,
				length: .24,
				radius: .013,
				pitch: .82,
				yaw: 2.05,
				roll: 0,
				bend: .05,
				dead: false,
				foliage: {
					size: .14,
					flatten: .37,
					hue: .04
				}
			}),
			b({
				id: "b-up-l",
				parentId: "t2",
				attach: .55,
				length: .23,
				radius: .012,
				pitch: .7,
				yaw: 3.25,
				roll: 0,
				bend: .05,
				dead: false,
				foliage: {
					size: .155,
					flatten: .36,
					hue: .01
				}
			}),
			b({
				id: "b-up-r",
				parentId: "t2",
				attach: .82,
				length: .2,
				radius: .011,
				pitch: .62,
				yaw: .35,
				roll: 0,
				bend: .04,
				dead: false,
				foliage: {
					size: .14,
					flatten: .34,
					hue: -.03
				}
			}),
			b({
				id: "b-apex-l",
				parentId: "t3",
				attach: .45,
				length: .14,
				radius: .008,
				pitch: .55,
				yaw: 2.8,
				roll: 0,
				bend: .03,
				dead: false,
				foliage: {
					size: .1,
					flatten: .4,
					hue: .02
				}
			})
		],
		harmony: 0,
		wateredThisSeason: false
	};
	tree.harmony = scoreHarmony(tree);
	return tree;
}
function sapling(seed = Date.now() % 99991) {
	const tree = maturePine(seed);
	tree.ageYears = 3;
	tree.maturity = .38;
	tree.moisture = .55;
	tree.health = .88;
	tree.season = 0;
	tree.wateredThisSeason = false;
	for (const br of tree.branches) {
		br.length *= .42;
		br.radius *= .55;
		if (br.foliage) br.foliage.size *= .45;
		if (br.id.startsWith("b-") && br.id.endsWith("2")) br.pruned = true;
		if (br.id === "b-apex-l") br.pruned = true;
	}
	tree.harmony = scoreHarmony(tree);
	return tree;
}
var _up$1 = new Vector3(0, 1, 0);
var _v = new Vector3();
var _side = new Vector3();
function solveTree(tree) {
	const byId = new Map(tree.branches.map((br) => [br.id, br]));
	const solved = /* @__PURE__ */ new Map();
	const mat = MathUtils.lerp(.55, 1, tree.maturity);
	const order = [];
	const visit = (id) => {
		const br = byId.get(id);
		if (!br) return;
		order.push(br);
		for (const child of tree.branches) if (child.parentId === id) visit(child.id);
	};
	for (const br of tree.branches) if (!br.parentId) visit(br.id);
	for (const br of order) {
		if (br.pruned) continue;
		let origin = new Vector3(0, 0, 0);
		let parentQuat = new Quaternion();
		let parentTan = new Vector3(0, 1, 0);
		let parentRadius = br.radius * mat;
		if (br.parentId) {
			const ps = solved.get(br.parentId);
			const parent = byId.get(br.parentId);
			if (!ps || !parent || parent.pruned) continue;
			const curve = new QuadraticBezierCurve3(ps.start, ps.ctrl, ps.end);
			origin = curve.getPoint(br.attach);
			parentTan = curve.getTangent(br.attach).normalize();
			parentQuat = ps.tipQuat.clone();
			parentRadius = MathUtils.lerp(ps.radiusStart, ps.radiusEnd, br.attach);
		}
		const e = new Euler(br.pitch + br.wirePitch, br.yaw + br.wireYaw, br.roll, "YXZ");
		const local = new Quaternion().setFromEuler(e);
		const worldQ = parentQuat.clone().multiply(local);
		const tangent = _up$1.clone().applyQuaternion(worldQ).normalize();
		if (tangent.dot(parentTan) < .15 && br.parentId) tangent.addScaledVector(parentTan, .35).normalize();
		const length = br.length * mat;
		const start = origin;
		const end = origin.clone().addScaledVector(tangent, length);
		_side.set(tangent.z, 0, -tangent.x);
		if (_side.lengthSq() < 1e-6) _side.set(1, 0, 0);
		_side.normalize();
		const ctrl = start.clone().lerp(end, .48).addScaledVector(_side, br.bend * length).addScaledVector(_v.set(0, 1, 0), br.bend * length * .15);
		const radiusStart = br.parentId ? parentRadius * .86 : br.radius * mat;
		const radiusEnd = Math.max(.0035, br.radius * mat * .42);
		const tipQuat = new Quaternion().setFromUnitVectors(_up$1, tangent);
		solved.set(br.id, {
			branch: br,
			start,
			ctrl,
			end,
			radiusStart,
			radiusEnd,
			tipQuat,
			tangent
		});
	}
	return [...solved.values()];
}
function scoreHarmony(tree) {
	const living = tree.branches.filter((br) => !br.pruned && !br.dead);
	const pads = living.filter((br) => br.foliage);
	if (pads.length === 0) return .12;
	let taper = 0;
	let nTaper = 0;
	const byId = new Map(tree.branches.map((br) => [br.id, br]));
	for (const br of living) {
		if (!br.parentId) continue;
		const p = byId.get(br.parentId);
		if (!p || p.pruned) continue;
		taper += p.radius > br.radius ? 1 : .2;
		nTaper++;
	}
	const taperScore = nTaper ? taper / nTaper : .5;
	const padCount = MathUtils.clamp(pads.length / 8, 0, 1);
	const moistureScore = 1 - Math.abs(tree.moisture - .55) * 1.2;
	const ageScore = MathUtils.clamp(tree.ageYears / 24, 0, 1);
	const health = tree.health;
	const jin = tree.branches.some((br) => br.dead && !br.pruned) ? .08 : 0;
	const raw = taperScore * .28 + padCount * .22 + moistureScore * .18 + ageScore * .18 + health * .14 + jin;
	return MathUtils.clamp(raw, .08, .99);
}
function pruneBranch(tree, id) {
	const kill = /* @__PURE__ */ new Set();
	const walk = (pid) => {
		kill.add(pid);
		for (const br of tree.branches) if (br.parentId === pid) walk(br.id);
	};
	const target = tree.branches.find((br) => br.id === id);
	if (!target || !target.parentId) return tree;
	walk(id);
	const branches = tree.branches.map((br) => {
		if (kill.has(br.id)) return {
			...br,
			pruned: true
		};
		if (br.id === target.parentId) return {
			...br,
			vigor: Math.min(1, br.vigor + .12)
		};
		return br;
	});
	const next = {
		...tree,
		branches,
		health: Math.min(1, tree.health + .03)
	};
	next.harmony = scoreHarmony(next);
	return next;
}
function waterTree(tree) {
	const moisture = Math.min(1, tree.moisture + .34);
	const health = Math.min(1, tree.health + (moisture > .92 ? -.04 : .06));
	const next = {
		...tree,
		moisture,
		health,
		wateredThisSeason: true
	};
	next.harmony = scoreHarmony(next);
	return next;
}
function restSeason(tree) {
	const rng = new Rng(tree.seed + Math.floor(tree.ageYears * 8) + tree.season + 3);
	const wet = tree.moisture;
	const canGrow = wet > .28 && tree.health > .35;
	const season = (tree.season + 1) % 4;
	const maturity = Math.min(1, tree.maturity + (canGrow ? .045 : .01));
	const moisture = Math.max(.08, tree.moisture * .52);
	const health = MathUtils.clamp(tree.health + (canGrow ? .02 : -.08) + (wet < .2 ? -.1 : 0), .15, 1);
	const branches = tree.branches.map((br) => {
		if (br.pruned) return br;
		const grow = canGrow ? 1 + .028 * br.vigor * (.6 + wet) : 1;
		const foliage = br.foliage ? {
			...br.foliage,
			size: br.foliage.size * (canGrow ? 1.02 : .985)
		} : null;
		return {
			...br,
			length: br.length * grow,
			radius: br.radius * (canGrow ? 1.01 : 1),
			foliage,
			vigor: MathUtils.clamp(br.vigor * .98 + (canGrow ? .03 : -.04), .2, 1)
		};
	});
	if (canGrow && maturity > .55 && rng.next() > .55) {
		const hosts = branches.filter((br) => !br.pruned && !br.dead && br.parentId && !br.foliage);
		const host = hosts[Math.floor(rng.next() * hosts.length)];
		if (host) {
			const id = `sprout-${tree.ageYears.toFixed(2)}-${Math.floor(rng.next() * 999)}`;
			branches.push(b({
				id,
				parentId: host.id,
				attach: .7 + rng.range(0, .2),
				length: host.length * .45,
				radius: host.radius * .45,
				pitch: rng.range(.4, .9),
				yaw: rng.range(0, Math.PI * 2),
				roll: 0,
				bend: rng.range(.02, .07),
				dead: false,
				foliage: {
					size: .08 * maturity,
					flatten: .38,
					hue: rng.range(-.04, .04)
				}
			}));
		}
	}
	const next = {
		...tree,
		season,
		maturity,
		moisture,
		health,
		ageYears: tree.ageYears + .25,
		wateredThisSeason: false,
		branches
	};
	next.harmony = scoreHarmony(next);
	return next;
}
function wireBranch(tree, id, dPitch, dYaw) {
	const branches = tree.branches.map((br) => {
		if (br.id !== id || br.pruned || !br.parentId) return br;
		return {
			...br,
			wired: true,
			wirePitch: MathUtils.clamp(br.wirePitch + dPitch, -.7, .7),
			wireYaw: br.wireYaw + dYaw
		};
	});
	const next = {
		...tree,
		branches
	};
	next.harmony = scoreHarmony(next);
	return next;
}
function foliageColor(season, hue, health) {
	const c = [
		new Color("#4d7a3a"),
		new Color("#1e3d24"),
		new Color("#5a5a28"),
		new Color("#243528")
	][season].clone();
	c.offsetHSL(hue * .08, (health - .5) * .15, (health - .6) * .12);
	return c;
}
var KEY = "bonsai-atelier-save-v1";
var BACKUP = "bonsai-atelier-save-v1-bak";
var defaults = {
	version: 1,
	tree: maturePine(),
	phase: "title"
};
function migrate(raw) {
	const s = {
		...defaults,
		...raw
	};
	if (!s.version) s.version = 1;
	s.version = 1;
	s.tree = {
		...defaults.tree,
		...s.tree
	};
	return s;
}
function loadSave() {
	try {
		const text = localStorage.getItem(KEY);
		if (!text) return structuredClone(defaults);
		return migrate(JSON.parse(text));
	} catch {
		try {
			const bak = localStorage.getItem(BACKUP);
			if (bak) return migrate(JSON.parse(bak));
		} catch {}
		return structuredClone(defaults);
	}
}
function writeSave(tree, phase) {
	const blob = {
		version: 1,
		tree,
		phase
	};
	try {
		const prev = localStorage.getItem(KEY);
		if (prev) localStorage.setItem(BACKUP, prev);
		localStorage.setItem(KEY, JSON.stringify(blob));
	} catch {}
}
var loaded = typeof window !== "undefined" ? loadSave() : {
	tree: maturePine(),
	phase: "title"
};
var useGame = create((set, get) => ({
	phase: loaded.phase,
	tool: "look",
	tree: loaded.tree,
	selectedId: null,
	hoverId: null,
	watering: 0,
	toast: null,
	help: false,
	muted: false,
	enter: () => {
		unlockAudio();
		set({ phase: "play" });
		get().persist();
	},
	newSapling: () => {
		unlockAudio();
		set({
			phase: "play",
			tree: sapling(),
			tool: "look",
			selectedId: null
		});
		get().persist();
	},
	setTool: (tool) => {
		unlockAudio();
		set({
			tool,
			selectedId: tool === "wire" ? get().selectedId : null
		});
		if (tool === "rest") get().rest();
	},
	setHover: (hoverId) => set({ hoverId }),
	prune: (id) => {
		playSnip();
		set({
			tree: pruneBranch(get().tree, id),
			toast: "Pruned"
		});
		get().persist();
	},
	water: () => {
		playWater();
		set({
			tree: waterTree(get().tree),
			watering: 1,
			toast: "Watered"
		});
		get().persist();
	},
	rest: () => {
		playBell();
		set({
			tree: restSeason(get().tree),
			toast: "A season turns",
			tool: "look"
		});
		get().persist();
	},
	wire: (id, dp, dy) => {
		set({
			tree: wireBranch(get().tree, id, dp, dy),
			selectedId: id
		});
	},
	select: (selectedId) => set({ selectedId }),
	tickWater: (dt) => {
		const w = get().watering;
		if (w <= 0) return;
		set({ watering: Math.max(0, w - dt * .85) });
	},
	persist: () => {
		const { tree, phase } = get();
		writeSave(tree, phase);
	}
}));
var TOOLS = [
	{
		id: "look",
		label: "Look",
		icon: RotateCcw
	},
	{
		id: "water",
		label: "Water",
		icon: Droplets
	},
	{
		id: "prune",
		label: "Prune",
		icon: Scissors
	},
	{
		id: "wire",
		label: "Wire",
		icon: Spline
	},
	{
		id: "rest",
		label: "Rest",
		icon: Moon
	}
];
function Overlay() {
	const phase = useGame((s) => s.phase);
	const tree = useGame((s) => s.tree);
	const tool = useGame((s) => s.tool);
	const toast = useGame((s) => s.toast);
	const help = useGame((s) => s.help);
	const enter = useGame((s) => s.enter);
	const newSapling = useGame((s) => s.newSapling);
	const setTool = useGame((s) => s.setTool);
	const [mute, setMute] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!toast) return;
		const t = window.setTimeout(() => useGame.setState({ toast: null }), 1600);
		return () => window.clearTimeout(t);
	}, [toast]);
	const hint = tool === "prune" ? "Click a branch to cut it. Energy returns to the parent." : tool === "wire" ? "Click a branch, then drag to bend it." : tool === "water" ? "Water the pot. Moisture is spent when you rest." : "Drag to orbit. Scroll or pinch to move closer.";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "hud",
		children: [
			phase === "title" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "title-layer",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "overlay-title",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "hud-kicker",
							children: "A quiet practice"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "Bonsai Atelier" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Tend a living pine. Water, prune, wire, and rest through the seasons until the silhouette finds its form." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "title-actions",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "btn btn-primary",
								onClick: () => {
									unlockAudio();
									enter();
								},
								children: "Enter the atelier"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "btn btn-ghost",
								onClick: () => {
									unlockAudio();
									newSapling();
								},
								children: "Start a sapling"
							})]
						})
					]
				})
			}),
			phase === "play" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "hud-top",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "hud-panel hud-meta",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hud-kicker",
								children: SEASONS[tree.season]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "hud-stat",
								children: [tree.ageYears.toFixed(1), " years"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "hud-row",
								style: { marginTop: 8 },
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "hud-kicker",
									children: ["Harmony ", Math.round(tree.harmony * 100)]
								})
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							gap: 8,
							alignItems: "flex-start"
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "hud-panel meter",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "meter-label",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Moisture" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: Math.round(tree.moisture * 100) })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "meter-track",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "meter-fill",
											style: { width: `${tree.moisture * 100}%` }
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "meter-label",
										style: { marginTop: 10 },
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Harmony" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: Math.round(tree.harmony * 100) })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "meter-track",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "meter-fill harmony",
											style: { width: `${tree.harmony * 100}%` }
										})
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "icon-btn",
								"aria-label": mute ? "Unmute" : "Mute",
								onClick: () => {
									const next = !mute;
									setMute(next);
									setMuted(next);
									useGame.setState({ muted: next });
								},
								children: mute || isMuted() ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { size: 18 }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { size: 18 })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "icon-btn",
								"aria-label": "Help",
								onClick: () => useGame.setState({ help: !help }),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleHelp, { size: 18 })
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "hint",
					children: hint
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "tool-bar",
					role: "toolbar",
					"aria-label": "Bonsai tools",
					children: TOOLS.map((t) => {
						const Icon = t.icon;
						const active = tool === t.id;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: `tool-btn${active ? " active" : ""}`,
							onClick: () => {
								if (t.id === "water") {
									useGame.getState().water();
									setTool("look");
									return;
								}
								setTool(t.id);
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { size: 18 }), t.label]
						}, t.id);
					})
				})
			] }),
			help && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "hud-panel help-card",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "How to tend" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Water before you rest, or the pine will thin." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Prune to open negative space and thicken remaining limbs." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Wire a branch, then drag to set its line." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Rest advances a season. Harmony scores taper, pads, age, and care." })
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "btn btn-ghost",
						style: { marginTop: 14 },
						onClick: () => useGame.setState({ help: false }),
						children: "Close"
					})
				]
			}),
			toast && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "saved-toast",
				children: toast
			})
		]
	});
}
function taperedTube(start, ctrl, end, radiusStart, radiusEnd, tubular = 16, radial = 8) {
	const curve = new QuadraticBezierCurve3(start, ctrl, end);
	const frames = curve.computeFrenetFrames(tubular, false);
	const positions = [];
	const normals = [];
	const uvs = [];
	const indices = [];
	const len = Math.max(.08, curve.getLength());
	for (let i = 0; i <= tubular; i++) {
		const t = i / tubular;
		const r = MathUtils.lerp(radiusStart, radiusEnd, t);
		const p = curve.getPointAt(t);
		const N = frames.normals[i];
		const B = frames.binormals[i];
		for (let j = 0; j <= radial; j++) {
			const u = j / radial;
			const angle = u * Math.PI * 2;
			const cx = Math.cos(angle);
			const sx = Math.sin(angle);
			const nx = N.x * cx + B.x * sx;
			const ny = N.y * cx + B.y * sx;
			const nz = N.z * cx + B.z * sx;
			positions.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
			normals.push(nx, ny, nz);
			uvs.push(u * 2.2, t * len * 6);
		}
	}
	for (let i = 0; i < tubular; i++) for (let j = 0; j < radial; j++) {
		const a = i * (radial + 1) + j;
		const b = a + radial + 1;
		indices.push(a, b, a + 1, b, b + 1, a + 1);
	}
	const geo = new BufferGeometry();
	geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
	geo.setAttribute("normal", new Float32BufferAttribute(normals, 3));
	geo.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
	geo.setIndex(indices);
	geo.computeVertexNormals();
	return geo;
}
function lumpIcosahedron(radius, flatten, seed, detail = 3) {
	const geo = new IcosahedronGeometry(radius, detail);
	const pos = geo.attributes.position;
	const v = new Vector3();
	for (let i = 0; i < pos.count; i++) {
		v.fromBufferAttribute(pos, i);
		const n = valueNoise3(v.x * 3.4 + seed, v.y * 3.4, v.z * 3.4 + seed * .3);
		const n2 = valueNoise3(v.x * 8 + seed, v.y * 8, v.z * 8);
		v.multiplyScalar(1 + n * .28 + n2 * .08);
		v.y *= flatten;
		pos.setXYZ(i, v.x, v.y, v.z);
	}
	geo.computeVertexNormals();
	return geo;
}
function potLathe() {
	const pts = [
		new Vector2(0, 0),
		new Vector2(.168, 0),
		new Vector2(.186, .012),
		new Vector2(.172, .026),
		new Vector2(.154, .04),
		new Vector2(.148, .12),
		new Vector2(.152, .155),
		new Vector2(.178, .168),
		new Vector2(.17, .184),
		new Vector2(.148, .184)
	];
	return new LatheGeometry(pts, 48);
}
function makeEquirectEnv() {
	const c = document.createElement("canvas");
	c.width = 1024;
	c.height = 512;
	const g = c.getContext("2d");
	const grd = g.createLinearGradient(0, 0, 0, 512);
	grd.addColorStop(0, "#f3d7a6");
	grd.addColorStop(.38, "#c9a57c");
	grd.addColorStop(.52, "#4a3c32");
	grd.addColorStop(1, "#16120e");
	g.fillStyle = grd;
	g.fillRect(0, 0, 1024, 512);
	const tex = new CanvasTexture(c);
	tex.mapping = 303;
	tex.colorSpace = SRGBColorSpace;
	tex.needsUpdate = true;
	return tex;
}
function albedoToNormal(map, strength = 1.8) {
	const img = map.image;
	const sw = Math.min(512, img.width || 512);
	const sh = Math.min(512, img.height || 512);
	const src = document.createElement("canvas");
	src.width = sw;
	src.height = sh;
	const sctx = src.getContext("2d");
	sctx.drawImage(img, 0, 0, sw, sh);
	const srcData = sctx.getImageData(0, 0, sw, sh).data;
	const dst = document.createElement("canvas");
	dst.width = sw;
	dst.height = sh;
	const dctx = dst.getContext("2d");
	const out = dctx.createImageData(sw, sh);
	const lumAt = (x, y) => {
		const xx = (x % sw + sw) % sw;
		const p = ((y % sh + sh) % sh * sw + xx) * 4;
		return (srcData[p] * .3 + srcData[p + 1] * .54 + srcData[p + 2] * .16) / 255;
	};
	for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
		const dx = (lumAt(x + 1, y) - lumAt(x - 1, y)) * strength;
		const dy = (lumAt(x, y + 1) - lumAt(x, y - 1)) * strength;
		const nx = -dx;
		const ny = -dy;
		const nz = 1;
		const inv = 1 / Math.hypot(nx, ny, nz);
		const i = (y * sw + x) * 4;
		out.data[i] = (nx * inv * .5 + .5) * 255;
		out.data[i + 1] = (ny * inv * .5 + .5) * 255;
		out.data[i + 2] = (nz * inv * .5 + .5) * 255;
		out.data[i + 3] = 255;
	}
	dctx.putImageData(out, 0, 0);
	const tex = new CanvasTexture(dst);
	tex.wrapS = tex.wrapT = RepeatWrapping;
	tex.colorSpace = "";
	tex.needsUpdate = true;
	return tex;
}
function makeScrollTexture() {
	const c = document.createElement("canvas");
	c.width = 512;
	c.height = 768;
	const g = c.getContext("2d");
	g.fillStyle = "#d8c7a4";
	g.fillRect(0, 0, 512, 768);
	g.fillStyle = "#cbb892";
	g.fillRect(24, 24, 464, 720);
	g.strokeStyle = "rgba(40,28,18,0.55)";
	g.lineWidth = 3;
	for (let i = 0; i < 18; i++) {
		const x = 80 + Math.sin(i * 1.7) * 90 + i * 8;
		g.beginPath();
		g.moveTo(x, 80);
		g.bezierCurveTo(x + 40, 220, x - 60, 420, x + 10, 680);
		g.stroke();
	}
	g.fillStyle = "rgba(30,22,16,0.45)";
	g.beginPath();
	g.ellipse(250, 260, 70, 28, -.4, 0, Math.PI * 2);
	g.fill();
	g.beginPath();
	g.moveTo(250, 250);
	g.quadraticCurveTo(310, 180, 340, 120);
	g.stroke();
	const tex = new CanvasTexture(c);
	tex.colorSpace = SRGBColorSpace;
	tex.needsUpdate = true;
	return tex;
}
function Atelier({ textures }) {
	const watering = useGame((s) => s.watering);
	const potGeo = (0, import_react.useMemo)(() => potLathe(), []);
	const mossGeos = (0, import_react.useMemo)(() => [
		lumpIcosahedron(.085, .32, 1.2, 2),
		lumpIcosahedron(.06, .3, 4.1, 2),
		lumpIcosahedron(.05, .28, 7.7, 2)
	], []);
	const stoneGeos = (0, import_react.useMemo)(() => [
		lumpIcosahedron(.038, .62, 2.2, 1),
		lumpIcosahedron(.028, .7, 5.5, 1),
		lumpIcosahedron(.022, .65, 9.1, 1)
	], []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Room, { textures }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Workbench, { textures }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
			position: [
				0,
				.785,
				0
			],
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("mesh", {
					geometry: potGeo,
					scale: [
						1.32,
						1,
						1
					],
					castShadow: true,
					receiveShadow: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshPhysicalMaterial", {
						map: textures.ceramic,
						normalMap: textures.ceramicN,
						roughness: .18,
						metalness: .08,
						clearcoat: .85,
						clearcoatRoughness: .2,
						envMapIntensity: .9,
						color: "#1a1614"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
					rotation: [
						-Math.PI / 2,
						0,
						0
					],
					position: [
						0,
						.175,
						0
					],
					receiveShadow: true,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circleGeometry", { args: [.148, 32] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
						map: textures.soil,
						normalMap: textures.soilN,
						roughness: .92,
						color: "#4a3018"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("mesh", {
					geometry: mossGeos[0],
					position: [
						.04,
						.188,
						.03
					],
					castShadow: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
						map: textures.moss,
						normalMap: textures.mossN,
						roughness: .86,
						color: "#3d6a32"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("mesh", {
					geometry: mossGeos[1],
					position: [
						-.06,
						.182,
						-.02
					],
					castShadow: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
						map: textures.moss,
						normalMap: textures.mossN,
						roughness: .86,
						color: "#2f5a28"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("mesh", {
					geometry: mossGeos[2],
					position: [
						.02,
						.18,
						-.07
					],
					castShadow: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
						map: textures.moss,
						roughness: .86,
						color: "#4a7a38"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("mesh", {
					geometry: stoneGeos[0],
					position: [
						-.05,
						.19,
						.05
					],
					castShadow: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
						map: textures.stone,
						normalMap: textures.stoneN,
						roughness: .45,
						color: "#c8c0b0"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("mesh", {
					geometry: stoneGeos[1],
					position: [
						.07,
						.186,
						-.04
					],
					castShadow: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
						map: textures.stone,
						roughness: .5,
						color: "#d2cbb8"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("mesh", {
					geometry: stoneGeos[2],
					position: [
						.01,
						.185,
						.08
					],
					castShadow: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
						map: textures.stone,
						roughness: .48,
						color: "#b8b09e"
					})
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tools, { watering }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scroll, { textures }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Garden, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GodRays, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dust, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaterDrops, {})
	] });
}
function Room({ textures }) {
	const wall = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
		map: textures.plaster,
		normalMap: textures.plasterN,
		roughness: .9,
		color: "#1c1814"
	});
	const woodMat = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
		map: textures.wood,
		normalMap: textures.woodN,
		roughness: .62,
		color: "#3a2a1c"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			rotation: [
				-Math.PI / 2,
				0,
				0
			],
			position: [
				0,
				0,
				.2
			],
			receiveShadow: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [8, 7] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				map: textures.wood,
				normalMap: textures.woodN,
				roughness: .7,
				color: "#2a1e14"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				0,
				1.7,
				-2.35
			],
			receiveShadow: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [8, 3.5] }), wall]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				2.55,
				1.7,
				0
			],
			rotation: [
				0,
				-Math.PI / 2,
				0
			],
			receiveShadow: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [7, 3.5] }), wall]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				-2.45,
				2.55,
				0
			],
			rotation: [
				0,
				Math.PI / 2,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [7, 1.1] }), wall]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				-2.45,
				.38,
				0
			],
			rotation: [
				0,
				Math.PI / 2,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [7, .76] }), wall]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				-2.45,
				1.45,
				-1.85
			],
			rotation: [
				0,
				Math.PI / 2,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [1.3, 2.2] }), wall]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				-2.45,
				1.45,
				1.85
			],
			rotation: [
				0,
				Math.PI / 2,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [1.3, 2.2] }), wall]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				0,
				3.15,
				0
			],
			rotation: [
				Math.PI / 2,
				0,
				0
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [8, 7] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#14110e",
				roughness: 1
			})]
		}),
		[
			-1.4,
			0,
			1.4
		].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				x,
				3.02,
				-.2
			],
			castShadow: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
				.12,
				.16,
				4.6
			] }), woodMat]
		}, x)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shoji, { textures })
	] });
}
function Shoji({ textures }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
		position: [
			-2.42,
			1.48,
			0
		],
		rotation: [
			0,
			Math.PI / 2,
			0
		],
		children: [
			[
				-1.15,
				-.38,
				.38,
				1.15
			].map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				position: [
					x,
					0,
					0
				],
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
					.045,
					2.15,
					.05
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
					map: textures.wood,
					roughness: .55,
					color: "#4a3828"
				})]
			}, x)),
			[
				-.95,
				0,
				.95
			].map((y) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				position: [
					0,
					y,
					0
				],
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
					2.4,
					.04,
					.045
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
					map: textures.wood,
					roughness: .55,
					color: "#4a3828"
				})]
			}, y)),
			[
				-.76,
				0,
				.76
			].map((x, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				position: [
					x,
					.08,
					-.01
				],
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [.68, 1.72] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshPhysicalMaterial", {
					map: textures.shoji,
					color: "#f0e4cc",
					roughness: .82,
					transmission: i === 1 ? .55 : .28,
					thickness: .02,
					transparent: true,
					opacity: i === 1 ? .55 : .92,
					side: 2
				})]
			}, x))
		]
	});
}
function Workbench({ textures }) {
	const mat = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
		map: textures.wood,
		normalMap: textures.woodN,
		roughness: .48,
		metalness: .02,
		color: "#c4a06a"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				.08,
				.74,
				.04
			],
			castShadow: true,
			receiveShadow: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
				2.35,
				.09,
				1.05
			] }), mat]
		}),
		[
			[-.95, -.38],
			[1.05, -.38],
			[-.95, .42],
			[1.05, .42]
		].map(([x, z]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				x,
				.36,
				z
			],
			castShadow: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
				.08,
				.72,
				.08
			] }), mat]
		}, `${x}${z}`)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				.08,
				.38,
				-.46
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
				2.2,
				.04,
				.06
			] }), mat]
		})
	] });
}
function Tools({ watering }) {
	const can = (0, import_react.useRef)(null);
	useFrame(() => {
		if (!can.current) return;
		const t = watering;
		can.current.position.y = .82 + t * .18;
		can.current.position.x = .72 - t * .55;
		can.current.rotation.z = t * .7;
	});
	const copper = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
		color: "#b87333",
		metalness: 1,
		roughness: .32,
		envMapIntensity: 1.1
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
		ref: can,
		position: [
			.72,
			.82,
			.28
		],
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				rotation: [
					0,
					0,
					0
				],
				castShadow: true,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("cylinderGeometry", { args: [
					.045,
					.05,
					.09,
					20
				] }), copper]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				position: [
					.07,
					.02,
					0
				],
				rotation: [
					0,
					0,
					-.7
				],
				castShadow: true,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("cylinderGeometry", { args: [
					.008,
					.012,
					.09,
					8
				] }), copper]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				position: [
					-.05,
					.03,
					0
				],
				rotation: [
					0,
					0,
					Math.PI / 2
				],
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("torusGeometry", { args: [
					.035,
					.006,
					8,
					16,
					Math.PI
				] }), copper]
			})
		]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
		position: [
			.92,
			.8,
			.08
		],
		rotation: [
			0,
			.4,
			.15
		],
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				rotation: [
					0,
					0,
					.5
				],
				position: [
					-.02,
					0,
					0
				],
				castShadow: true,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
					.11,
					.012,
					.018
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
					color: "#8a9399",
					metalness: 1,
					roughness: .25
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				rotation: [
					0,
					0,
					-.5
				],
				position: [
					.02,
					0,
					0
				],
				castShadow: true,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
					.11,
					.012,
					.018
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
					color: "#8a9399",
					metalness: 1,
					roughness: .25
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				position: [
					-.07,
					-.015,
					0
				],
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("cylinderGeometry", { args: [
					.007,
					.007,
					.08,
					8
				] }), copper]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				position: [
					.07,
					-.015,
					0
				],
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("cylinderGeometry", { args: [
					.007,
					.007,
					.08,
					8
				] }), copper]
			})
		]
	})] });
}
function Scroll({ textures }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
		position: [
			1.55,
			1.85,
			-2.28
		],
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [.42, .72] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
			map: textures.scroll,
			roughness: .8
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				0,
				.38,
				.01
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("cylinderGeometry", { args: [
				.02,
				.02,
				.46,
				10
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#2a1c12",
				roughness: .5
			})]
		})]
	});
}
function Garden() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
		position: [
			-4.4,
			0,
			0
		],
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				rotation: [
					-Math.PI / 2,
					0,
					0
				],
				position: [
					0,
					.02,
					0
				],
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [8, 8] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
					color: "#6a6a58",
					roughness: 1
				})]
			}),
			[
				[
					-.8,
					.6,
					.55
				],
				[
					.4,
					-.8,
					.7
				],
				[
					-.2,
					1.4,
					.4
				],
				[
					.9,
					.3,
					.85
				]
			].map(([z, x, s], i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
				position: [
					x,
					0,
					z
				],
				scale: s,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
						position: [
							0,
							.5,
							0
						],
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("cylinderGeometry", { args: [
							.05,
							.08,
							1,
							6
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: "#2a1c12" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
						position: [
							0,
							1.15,
							0
						],
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("coneGeometry", { args: [
							.42,
							.9,
							7
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: "#1c3320" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
						position: [
							0,
							1.55,
							0
						],
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("coneGeometry", { args: [
							.28,
							.7,
							7
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: "#243e28" })]
					})
				]
			}, i)),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				position: [
					0,
					1.6,
					0
				],
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
					.05,
					8,
					8
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshBasicMaterial", { color: "#f0d8b0" })]
			})
		]
	});
}
function GodRays() {
	const ref = (0, import_react.useRef)(null);
	useFrame((state) => {
		if (!ref.current) return;
		const t = state.clock.elapsedTime;
		ref.current.children.forEach((ch, i) => {
			const m = ch.material;
			m.opacity = .045 + Math.sin(t * .4 + i) * .015;
		});
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("group", {
		ref,
		position: [
			-1.6,
			1.55,
			.05
		],
		rotation: [
			0,
			0,
			-.55
		],
		children: [
			0,
			1,
			2,
			3,
			4
		].map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				i * .18,
				0,
				(i - 2) * .08
			],
			rotation: [
				.1,
				0,
				.02 * i
			],
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [.35, 3.4] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshBasicMaterial", {
				color: "#f6d7a4",
				transparent: true,
				opacity: .05,
				depthWrite: false,
				blending: 2,
				side: 2
			})]
		}, i))
	});
}
function Dust() {
	const ref = (0, import_react.useRef)(null);
	const geo = (0, import_react.useMemo)(() => {
		const g = new BufferGeometry();
		const n = 90;
		const pos = /* @__PURE__ */ new Float32Array(270);
		for (let i = 0; i < n; i++) {
			pos[i * 3] = -2.1 + Math.random() * 1.8;
			pos[i * 3 + 1] = .9 + Math.random() * 1.6;
			pos[i * 3 + 2] = -.9 + Math.random() * 1.8;
		}
		g.setAttribute("position", new BufferAttribute(pos, 3));
		return g;
	}, []);
	useFrame((_, dt) => {
		const pts = ref.current;
		if (!pts) return;
		const arr = pts.geometry.attributes.position.array;
		const d = Math.min(dt, .1);
		for (let i = 0; i < arr.length; i += 3) {
			arr[i + 1] += d * .04;
			arr[i] += Math.sin(arr[i + 1] * 2) * d * .02;
			if (arr[i + 1] > 2.6) arr[i + 1] = .85;
		}
		pts.geometry.attributes.position.needsUpdate = true;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("points", {
		ref,
		geometry: geo,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointsMaterial", {
			color: "#f2e2c4",
			size: .012,
			transparent: true,
			opacity: .45,
			depthWrite: false
		})
	});
}
function WaterDrops() {
	const watering = useGame((s) => s.watering);
	const ref = (0, import_react.useRef)(null);
	const dummy = (0, import_react.useMemo)(() => new Object3D(), []);
	useFrame((state) => {
		const mesh = ref.current;
		if (!mesh) return;
		mesh.visible = watering > .05;
		if (!mesh.visible) return;
		for (let i = 0; i < 24; i++) {
			const t = (state.clock.elapsedTime * 2 + i * .17) % 1;
			dummy.position.set(i % 5 * .02 - .04, 1.05 - t * .28, Math.floor(i / 5) % 4 * .02 - .03);
			dummy.scale.setScalar(.008 * watering);
			dummy.updateMatrix();
			mesh.setMatrixAt(i, dummy.matrix);
		}
		mesh.instanceMatrix.needsUpdate = true;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("instancedMesh", {
		ref,
		args: [
			void 0,
			void 0,
			24
		],
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
			1,
			6,
			6
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshPhysicalMaterial", {
			color: "#9ec4d4",
			roughness: .1,
			transmission: .6,
			thickness: .4,
			transparent: true,
			opacity: .7
		})]
	});
}
var _dummy = new Object3D();
var _n = new Vector3();
var _q = new Quaternion();
var _up = new Vector3(0, 1, 0);
function BonsaiMesh({ tree, textures }) {
	const solved = (0, import_react.useMemo)(() => solveTree(tree), [tree]);
	const tool = useGame((s) => s.tool);
	const hoverId = useGame((s) => s.hoverId);
	const selectedId = useGame((s) => s.selectedId);
	const setHover = useGame((s) => s.setHover);
	const prune = useGame((s) => s.prune);
	const select = useGame((s) => s.select);
	const wire = useGame((s) => s.wire);
	const geos = (0, import_react.useMemo)(() => {
		return solved.map((s) => ({
			id: s.branch.id,
			geo: taperedTube(s.start, s.ctrl, s.end, s.radiusStart, s.radiusEnd, 14, 7),
			dead: s.branch.dead
		}));
	}, [solved]);
	(0, import_react.useEffect)(() => {
		return () => {
			geos.forEach((g) => g.geo.dispose());
		};
	}, [geos]);
	const pads = (0, import_react.useMemo)(() => {
		return solved.filter((s) => s.branch.foliage && !s.branch.dead).map((s) => {
			const f = s.branch.foliage;
			const geo = lumpIcosahedron(f.size, f.flatten, hashId(s.branch.id), 2);
			const color = foliageColor(tree.season, f.hue, tree.health);
			return {
				id: s.branch.id,
				geo,
				color,
				end: s.end,
				tangent: s.tangent,
				size: f.size
			};
		});
	}, [
		solved,
		tree.season,
		tree.health
	]);
	(0, import_react.useEffect)(() => {
		return () => pads.forEach((p) => p.geo.dispose());
	}, [pads]);
	const needleRef = (0, import_react.useRef)(null);
	const needleCount = pads.length * 22;
	(0, import_react.useEffect)(() => {
		const mesh = needleRef.current;
		if (!mesh) return;
		let i = 0;
		for (const pad of pads) for (let k = 0; k < 22; k++) {
			const a = k / 22 * Math.PI * 2;
			const r = pad.size * (.55 + k % 3 * .12);
			_n.copy(pad.tangent).normalize();
			const side = new Vector3(Math.cos(a), 0, Math.sin(a));
			side.addScaledVector(_n, -.25).normalize();
			const pos = pad.end.clone().addScaledVector(side, r);
			pos.y += Math.sin(a * 2) * pad.size * .08;
			_dummy.position.copy(pos);
			_q.setFromUnitVectors(_up, side);
			_dummy.quaternion.copy(_q);
			_dummy.scale.set(.012, pad.size * .28, .012);
			_dummy.updateMatrix();
			mesh.setMatrixAt(i, _dummy.matrix);
			i++;
		}
		mesh.count = i;
		mesh.instanceMatrix.needsUpdate = true;
	}, [pads]);
	const drag = (0, import_react.useRef)(null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		geos.map((g) => {
			const live = !g.dead;
			const highlight = hoverId === g.id || selectedId === g.id;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("mesh", {
				geometry: g.geo,
				castShadow: true,
				receiveShadow: true,
				onPointerOver: (e) => {
					e.stopPropagation();
					if (tool === "prune" || tool === "wire") {
						setHover(g.id);
						document.body.style.cursor = "pointer";
					}
				},
				onPointerOut: () => {
					setHover(null);
					document.body.style.cursor = "auto";
				},
				onPointerDown: (e) => {
					e.stopPropagation();
					if (tool === "prune") prune(g.id);
					if (tool === "wire") {
						select(g.id);
						drag.current = {
							id: g.id,
							x: e.clientX
						};
					}
				},
				onPointerMove: (e) => {
					if (!drag.current || tool !== "wire") return;
					const dx = e.clientX - drag.current.x;
					drag.current.x = e.clientX;
					wire(drag.current.id, 0, dx * .008);
				},
				onPointerUp: () => {
					drag.current = null;
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
					map: live ? textures.bark : void 0,
					normalMap: live ? textures.barkN : void 0,
					color: g.dead ? "#c8b79a" : highlight ? "#6a5340" : "#3b2a20",
					roughness: live ? .9 : .55,
					metalness: 0,
					normalScale: new Vector2(.85, .85)
				})
			}, g.id);
		}),
		pads.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("mesh", {
			geometry: p.geo,
			position: p.end,
			castShadow: true,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshPhysicalMaterial", {
				color: p.color,
				roughness: .78,
				metalness: 0,
				sheen: .45,
				sheenColor: new Color("#6a9a4a"),
				sheenRoughness: .7
			})
		}, `pad-${p.id}`)),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("instancedMesh", {
			ref: needleRef,
			args: [
				void 0,
				void 0,
				Math.max(needleCount, 1)
			],
			castShadow: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("coneGeometry", { args: [
				1,
				1,
				5
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: foliageColor(tree.season, 0, tree.health),
				roughness: .72
			})]
		}),
		solved.filter((s) => s.branch.wired && !s.branch.pruned).map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: s.start.clone().lerp(s.end, .4),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("torusGeometry", { args: [
				s.radiusStart * 1.35,
				.0028,
				6,
				12
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
				color: "#b87333",
				metalness: 1,
				roughness: .3
			})]
		}, `wire-${s.branch.id}`))
	] });
}
function hashId(id) {
	let h = 0;
	for (let i = 0; i < id.length; i++) h = h * 31 + id.charCodeAt(i) >>> 0;
	return h / 4294967295 * 20;
}
function WindSway({ children }) {
	const ref = (0, import_react.useRef)(null);
	useFrame((state) => {
		if (!ref.current) return;
		const t = state.clock.elapsedTime;
		ref.current.rotation.z = Math.sin(t * .35) * .012;
		ref.current.rotation.x = Math.sin(t * .22) * .006;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("group", {
		ref,
		children
	});
}
function prep(tex, repeatX = 1, repeatY = 1) {
	tex.colorSpace = SRGBColorSpace;
	tex.wrapS = tex.wrapT = RepeatWrapping;
	tex.repeat.set(repeatX, repeatY);
	tex.anisotropy = 8;
	tex.needsUpdate = true;
	return tex;
}
function useGameTextures() {
	const [maps, setMaps] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const loader = new TextureLoader();
		const names = [
			"bark",
			"wood",
			"ceramic",
			"moss",
			"soil",
			"stone",
			"shoji",
			"plaster"
		];
		let cancelled = false;
		Promise.all(names.map((n) => loader.loadAsync(`/textures/${n}.jpg`))).then((loaded) => {
			if (cancelled) {
				loaded.forEach((t) => t.dispose());
				return;
			}
			const [bark, wood, ceramic, moss, soil, stone, shoji, plaster] = loaded;
			prep(bark, 2, 3);
			prep(wood, 2, 1);
			prep(ceramic, 1, 1);
			prep(moss, 2, 2);
			prep(soil, 2, 2);
			prep(stone, 1, 1);
			prep(shoji, 1, 1);
			prep(plaster, 2, 2);
			const kit = {
				bark,
				barkN: albedoToNormal(bark, 2.2),
				wood,
				woodN: albedoToNormal(wood, 1.4),
				ceramic,
				ceramicN: albedoToNormal(ceramic, .9),
				moss,
				mossN: albedoToNormal(moss, 1.6),
				soil,
				soilN: albedoToNormal(soil, 1.8),
				stone,
				stoneN: albedoToNormal(stone, 1.2),
				shoji,
				plaster,
				plasterN: albedoToNormal(plaster, 1.1),
				env: makeEquirectEnv(),
				scroll: makeScrollTexture()
			};
			setMaps(kit);
		});
		return () => {
			cancelled = true;
		};
	}, []);
	return maps;
}
function useSeasonLight(season) {
	return (0, import_react.useMemo)(() => {
		const keys = [
			{
				dir: "#ffe6c2",
				amb: "#6a7a88",
				fill: 2.6,
				hemi: .38
			},
			{
				dir: "#ffd7a0",
				amb: "#5a6a62",
				fill: 3.2,
				hemi: .42
			},
			{
				dir: "#ffc078",
				amb: "#6a5a4a",
				fill: 2.4,
				hemi: .34
			},
			{
				dir: "#d8e2ee",
				amb: "#4a5560",
				fill: 1.7,
				hemi: .28
			}
		];
		return keys[season] ?? keys[1];
	}, [season]);
}
function Lights({ env }) {
	const light = useSeasonLight(useGame((s) => s.tree.season));
	const { scene } = useThree();
	(0, import_react.useEffect)(() => {
		scene.background = new Color("#16120e");
		scene.fog = new FogExp2("#16120e", .045);
		scene.environment = env;
		scene.environmentIntensity = .32;
	}, [scene, env]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("hemisphereLight", { args: [
			light.dir,
			"#1a1410",
			light.hemi
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ambientLight", {
			intensity: .08,
			color: "#3a322c"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("directionalLight", {
			position: [
				-4.4,
				3.6,
				1.1
			],
			intensity: light.fill,
			color: light.dir,
			castShadow: true,
			"shadow-mapSize-width": 2048,
			"shadow-mapSize-height": 2048,
			"shadow-camera-near": .5,
			"shadow-camera-far": 16,
			"shadow-camera-left": -4,
			"shadow-camera-right": 4,
			"shadow-camera-top": 4,
			"shadow-camera-bottom": -4,
			"shadow-bias": -4e-4
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("spotLight", {
			position: [
				-3.4,
				2.9,
				.3
			],
			angle: .55,
			penumbra: .7,
			intensity: 6.5,
			color: "#ffe6bf",
			castShadow: true,
			distance: 10
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointLight", {
			position: [
				1.4,
				1.5,
				.8
			],
			intensity: .35,
			color: "#c9a07a"
		})
	] });
}
function World() {
	const textures = useGameTextures();
	const tree = useGame((s) => s.tree);
	const tickWater = useGame((s) => s.tickWater);
	const persist = useGame((s) => s.persist);
	const tool = useGame((s) => s.tool);
	useFrame((_, delta) => {
		tickWater(Math.min(delta, .1));
	});
	(0, import_react.useEffect)(() => {
		const onHide = () => {
			if (document.visibilityState === "hidden") persist();
		};
		document.addEventListener("visibilitychange", onHide);
		window.addEventListener("pagehide", persist);
		return () => {
			document.removeEventListener("visibilitychange", onHide);
			window.removeEventListener("pagehide", persist);
		};
	}, [persist]);
	if (!textures) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lights, { env: textures.env }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SoftShadows, {
			size: 18,
			samples: 8,
			focus: .9
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Atelier, { textures }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("group", {
			position: [
				0,
				.97,
				0
			],
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WindSway, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BonsaiMesh, {
				tree,
				textures
			}) })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContactShadows, {
			position: [
				0,
				.786,
				0
			],
			opacity: .45,
			scale: 2.4,
			blur: 2.2,
			far: .6,
			color: "#1a120c"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrbitControls, {
			enablePan: false,
			enableDamping: true,
			dampingFactor: .08,
			minPolarAngle: .7,
			maxPolarAngle: 1.45,
			minDistance: 1.55,
			maxDistance: 4.2,
			target: [
				.05,
				1.05,
				0
			],
			enabled: tool === "look" || tool === "water",
			makeDefault: true
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(EffectComposer, {
			enableNormalPass: false,
			multisampling: 0,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SMAA, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bloom, {
					intensity: .18,
					luminanceThreshold: .82,
					mipmapBlur: true
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Vignette, {
					darkness: .55,
					offset: .28
				})
			]
		})
	] });
}
function GameCanvas() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Canvas, {
		className: "game-canvas",
		shadows: true,
		dpr: [1, 1.75],
		gl: {
			antialias: true,
			toneMapping: 4,
			toneMappingExposure: 1.05,
			powerPreference: "high-performance"
		},
		camera: {
			position: [
				1.62,
				1.38,
				2.28
			],
			fov: 36,
			near: .08,
			far: 40
		},
		onCreated: ({ gl }) => {
			gl.shadowMap.enabled = true;
			gl.shadowMap.type = 2;
			gl.outputColorSpace = SRGBColorSpace;
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(World, {})
	});
}
function BonsaiGame() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "game-root",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCanvas, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlay, {})]
	});
}
//#endregion
export { BonsaiGame };
