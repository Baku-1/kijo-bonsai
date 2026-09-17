import { i as __toESM } from "../_runtime.mjs";
import { $ as require_react, Q as require_jsx_runtime } from "../_libs/@react-three/drei+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BUnpQ-5M.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Home() {
	const [Game, setGame] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		import("./BonsaiGame-DqG4e2fI.mjs").then((m) => setGame(() => m.BonsaiGame));
	}, []);
	if (!Game) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "splash",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "splash-kicker",
			children: "A quiet practice"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "Bonsai Atelier" })] })
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Game, {});
}
//#endregion
export { Home as component };
