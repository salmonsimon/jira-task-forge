const [commandName, portArg, ...initialRestArgs] = process.argv.slice(2);
const restArgs = [...initialRestArgs];
const port = Number(portArg || "9335");

if (!commandName || !Number.isFinite(port)) {
  usage();
  process.exit(2);
}

const endpoint = `http://127.0.0.1:${port}`;

let targetSelector = null;
if (restArgs[0] === "--target") {
  targetSelector = restArgs[1];
  restArgs.splice(0, 2);
}

function usage() {
  console.error("Usage: node windows-cdp-client.mjs <command> <port> [args...]");
  console.error("");
  console.error("Commands:");
  console.error("  version");
  console.error("  list");
  console.error("  info");
  console.error("  navigate <url>");
  console.error("  open <url>");
  console.error("  close <target-id|title-or-url-substring>");
  console.error("  inspect");
  console.error("  controls [filter]");
  console.error("  controls-top");
  console.error("  click-text <filter>");
  console.error("  eval <javascript-expression>");
  console.error("  click <x> <y>");
  console.error("  key <key> [windowsVirtualKeyCode]");
  console.error("  type <x> <y> <text>");
  console.error("  screenshot <windows-output-path>");
  console.error("");
  console.error("Page commands accept optional: --target <target-id|title-or-url-substring>");
}

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

async function textFetch(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return response.text();
}

async function cdpCommand(ws, id, method, params = {}, timeoutMs = 15000) {
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeoutMs);
    function onMessage(event) {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      clearTimeout(timer);
      ws.removeEventListener("message", onMessage);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
    ws.addEventListener("message", onMessage);
  });
}

function matchesTarget(tab, selector) {
  if (!selector) return false;
  const lower = selector.toLowerCase();
  return (
    tab.id === selector ||
    String(tab.title || "").toLowerCase().includes(lower) ||
    String(tab.url || "").toLowerCase().includes(lower)
  );
}

async function findPage(selector = targetSelector) {
  const tabs = await jsonFetch(`${endpoint}/json/list`);
  const pages = tabs.filter((tab) => tab.type === "page");
  const page = selector
    ? pages.find((tab) => matchesTarget(tab, selector))
    : pages.find((tab) => /notion/i.test(`${tab.url} ${tab.title}`)) || pages[0];
  if (!page) {
    const suffix = selector ? ` matching target: ${selector}` : "";
    throw new Error(`No page target found${suffix}`);
  }
  return page;
}

async function withPage(callback) {
  const page = await findPage();

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  let id = 1;
  try {
    return await callback({
      page,
      command(method, params = {}) {
        return cdpCommand(ws, id++, method, params);
      }
    });
  } finally {
    ws.close();
  }
}

function redactText(value) {
  const text = String(value || "");
  return text
    .replace(/ntn_[A-Za-z0-9_-]+/g, "[redacted-token]")
    .replace(/secret_[A-Za-z0-9_-]+/gi, "[redacted-secret]")
    .replace(/bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted-token]");
}

async function info() {
  const tabs = await jsonFetch(`${endpoint}/json/list`);
  const pages = tabs
    .filter((tab) => tab.type === "page")
    .map((tab) => ({
      id: tab.id,
      title: redactText(tab.title),
      url: redactText(tab.url)
    }));
  return { pages };
}

async function openPage(url) {
  if (!url) throw new Error("open requires a URL");
  return jsonFetch(`${endpoint}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
}

async function navigate(url) {
  if (!url) throw new Error("navigate requires a URL");
  return withPage(async ({ command }) => {
    await command("Page.enable");
    await command("Page.navigate", { url });
    return { ok: true, url };
  });
}

async function closePage(selector = targetSelector || restArgs.join(" ")) {
  if (!selector) throw new Error("close requires a target id or title/url substring");
  const page = await findPage(selector);
  const body = await textFetch(`${endpoint}/json/close/${page.id}`);
  return { ok: true, id: page.id, title: redactText(page.title), url: redactText(page.url), body };
}

async function inspect() {
  return withPage(async ({ command }) => {
    await command("Runtime.enable");
    const result = await command("Runtime.evaluate", {
      expression: `JSON.stringify({
        title: document.title,
        href: location.href,
        body: document.body ? document.body.innerText.slice(0, 1000) : ""
      })`,
      returnByValue: true
    });
    return JSON.parse(result.result.value);
  });
}

async function controls(filter = "") {
  return withPage(async ({ command }) => {
    await command("Runtime.enable", {}, 30000);
    const result = await command("Runtime.evaluate", {
      expression: `(() => {
        const filter = ${JSON.stringify(filter)}.toLowerCase();
        const redact = (value) => String(value || "")
          .replace(/ntn_[A-Za-z0-9_-]+/g, "[redacted-token]")
          .replace(/secret_[A-Za-z0-9_-]+/gi, "[redacted-secret]")
          .replace(/bearer\\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted-token]");
        return JSON.stringify(Array.from(document.querySelectorAll("button,[role=button],a,input,textarea,[aria-label]"))
          .map((el, i) => {
            const raw = [
              el.innerText,
              el.getAttribute("aria-label"),
              el.getAttribute("placeholder"),
              el.tagName === "INPUT" || el.tagName === "TEXTAREA" ? el.value : ""
            ].filter(Boolean).join(" ").trim();
            const text = redact(raw);
            const rect = el.getBoundingClientRect();
            return {
              i,
              tag: el.tagName,
              role: el.getAttribute("role"),
              type: el.getAttribute("type"),
              text,
              disabled: Boolean(el.disabled || el.getAttribute("aria-disabled") === "true"),
              rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
            };
          })
          .filter((item) => item.rect.w > 0 && item.rect.h > 0)
          .filter((item) => !filter || item.text.toLowerCase().includes(filter))
          .slice(0, 80));
      })()`,
      awaitPromise: true,
      returnByValue: true
    }, 30000);
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails, null, 2));
    }
    return JSON.parse(result.result.value);
  });
}

async function controlsTop() {
  return withPage(async ({ command }) => {
    await command("Runtime.enable", {}, 30000);
    const result = await command("Runtime.evaluate", {
      expression: `(() => {
        const redact = (value) => String(value || "")
          .replace(/ntn_[A-Za-z0-9_-]+/g, "[redacted-token]")
          .replace(/secret_[A-Za-z0-9_-]+/gi, "[redacted-secret]")
          .replace(/bearer\\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted-token]");
        return JSON.stringify(Array.from(document.querySelectorAll("button,[role=button],a,input,textarea,[aria-label]"))
          .map((el, i) => {
            const raw = [el.innerText, el.getAttribute("aria-label"), el.getAttribute("placeholder")]
              .filter(Boolean).join(" ").trim();
            const rect = el.getBoundingClientRect();
            return {
              i,
              tag: el.tagName,
              role: el.getAttribute("role"),
              text: redact(raw),
              disabled: Boolean(el.disabled || el.getAttribute("aria-disabled") === "true"),
              rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
            };
          })
          .filter((item) => item.rect.w > 0 && item.rect.h > 0)
          .filter((item) => item.rect.y >= 0 && item.rect.y < 80 && item.rect.x > 250)
          .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x));
      })()`,
      awaitPromise: true,
      returnByValue: true
    }, 30000);
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails, null, 2));
    }
    return JSON.parse(result.result.value);
  });
}

async function clickText(filter) {
  if (!filter) throw new Error("click-text requires a filter");
  return withPage(async ({ command }) => {
    await command("Runtime.enable", {}, 30000);
    const result = await command("Runtime.evaluate", {
      expression: `(() => {
        const filter = ${JSON.stringify(filter)}.toLowerCase();
        const candidates = Array.from(document.querySelectorAll("button,[role=button],a,[aria-label]"));
        const target = candidates.find((el) => {
          const text = [el.innerText, el.getAttribute("aria-label")].filter(Boolean).join(" ").trim().toLowerCase();
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && text.includes(filter);
        });
        if (!target) return null;
        const rect = target.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      })()`,
      awaitPromise: true,
      returnByValue: true
    }, 30000);
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails, null, 2));
    }
    const point = result.result?.value;
    if (!point) throw new Error(`No visible control matched filter: ${filter}`);
    await command("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
    await command("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: point.x,
      y: point.y,
      button: "left",
      clickCount: 1
    });
    await command("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: point.x,
      y: point.y,
      button: "left",
      clickCount: 1
    });
    return { ok: true, filter, x: point.x, y: point.y };
  });
}

async function evaluate(expression) {
  return withPage(async ({ command }) => {
    await command("Runtime.enable");
    const result = await command("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails, null, 2));
    }
    return result.result?.value ?? null;
  });
}

async function click(x, y) {
  return withPage(async ({ command }) => {
    await command("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await command("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x,
      y,
      button: "left",
      clickCount: 1
    });
    await command("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x,
      y,
      button: "left",
      clickCount: 1
    });
    return { ok: true, x, y };
  });
}

async function keyPress(key, codeArg) {
  if (!key) throw new Error("key requires a key name");
  const keyCodes = { Escape: 27, Enter: 13, Backspace: 8, Tab: 9 };
  const windowsVirtualKeyCode = Number(codeArg || keyCodes[key] || 0);
  return withPage(async ({ command }) => {
    await command("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      windowsVirtualKeyCode
    });
    await command("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      windowsVirtualKeyCode
    });
    return { ok: true, key, windowsVirtualKeyCode };
  });
}

async function typeText(x, y, text) {
  return withPage(async ({ command }) => {
    await command("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await command("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x,
      y,
      button: "left",
      clickCount: 3
    });
    await command("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x,
      y,
      button: "left",
      clickCount: 3
    });
    await command("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Backspace",
      windowsVirtualKeyCode: 8
    });
    await command("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Backspace",
      windowsVirtualKeyCode: 8
    });
    await command("Input.insertText", { text });
    return { ok: true, x, y, textLength: text.length };
  });
}

async function screenshot(outputPath) {
  if (!outputPath) throw new Error("screenshot requires a Windows output path");
  return withPage(async ({ command }) => {
    const fs = await import("node:fs");
    await command("Page.enable");
    const result = await command("Page.captureScreenshot", {
      format: "png",
      fromSurface: true
    });
    fs.writeFileSync(outputPath, Buffer.from(result.data, "base64"));
    return { outputPath };
  });
}

let result;
if (commandName === "version") {
  result = await jsonFetch(`${endpoint}/json/version`);
} else if (commandName === "list") {
  result = await jsonFetch(`${endpoint}/json/list`);
} else if (commandName === "info") {
  result = await info();
} else if (commandName === "navigate") {
  result = await navigate(restArgs.join(" "));
} else if (commandName === "open") {
  result = await openPage(restArgs.join(" "));
} else if (commandName === "close") {
  result = await closePage();
} else if (commandName === "inspect") {
  result = await inspect();
} else if (commandName === "controls") {
  result = await controls(restArgs.join(" "));
} else if (commandName === "controls-top") {
  result = await controlsTop();
} else if (commandName === "click-text") {
  result = await clickText(restArgs.join(" "));
} else if (commandName === "eval") {
  result = await evaluate(restArgs.join(" "));
} else if (commandName === "click") {
  result = await click(Number(restArgs[0]), Number(restArgs[1]));
} else if (commandName === "key") {
  result = await keyPress(restArgs[0], restArgs[1]);
} else if (commandName === "type") {
  result = await typeText(Number(restArgs[0]), Number(restArgs[1]), restArgs.slice(2).join(" "));
} else if (commandName === "screenshot") {
  result = await screenshot(restArgs[0]);
} else {
  usage();
  process.exit(2);
}

console.log(JSON.stringify(result, null, 2));
