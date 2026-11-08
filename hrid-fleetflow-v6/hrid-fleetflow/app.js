/* HRID FleetFlow – company transport: requests, approvals, step-by-step trips with locations,
   weekly vehicle checklists, vehicle problems and monthly reports.
   Plain HTML/CSS/JS – no build step. Works on GitHub Pages, Azure Static Web Apps or any static host. */
import "./js/i18n.js";
import { route, state, router } from "./js/core.js";
import "./js/auth.js";
import { homes } from "./js/requests.js";
import { driverHome } from "./js/run.js";
import "./js/admin.js";
import "./js/reports.js";

route("/", null, async () => (homes[state.user.role] || driverHome)());
router();
