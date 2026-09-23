import { render } from "preact";
import { App } from "./app/App";
import { reportError } from "./app/errors";
import { registerServiceWorker } from "./pwa/registerSW";
import "./styles/base.css";

window.addEventListener("unhandledrejection", (e) => reportError(e.reason));

// Ask the browser not to evict our data under storage pressure (research R3).
void navigator.storage?.persist?.().catch(() => undefined);

render(<App />, document.getElementById("app")!);
void registerServiceWorker();
