const [commandName, portArg, ...restArgs] = process.argv.slice(2);
const port = Number(portArg || "9335");

if (!commandName || !Number.isFinite(port)) {
  usage();
  process.exit(2);
}

const endpoint = `http://127.0.0.1:${port}`;

function usage() {
  console.error("Usage: node windows-cdp-client.mjs <command> <port> [args...]");
  console.error("");
  console.error("Commands:");
  console.error("  version");
  console.error("  list");
  console.error("  inspect");
  console.error("  eval <javascript-expression>");
  console.error("  click <x> <y>");
  console.error("  type <x> <y> <text>");
  console.error("  screenshot <windows-output-path>");
}

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
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

async function withPage(callback) {
  const tabs = await jsonFetch(`${endpoint}/json/list`);
  const page =
    tabs.find((tab) => tab.type === "page" && /notion/i.test(`${tab.url} ${tab.title}`)) ||
    tabs.find((tab) => tab.type === "page");
  if (!page) throw new Error("No page target found");

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
} else if (commandName === "inspect") {
  result = await inspect();
} else if (commandName === "eval") {
  result = await evaluate(restArgs.join(" "));
} else if (commandName === "click") {
  result = await click(Number(restArgs[0]), Number(restArgs[1]));
} else if (commandName === "type") {
  result = await typeText(Number(restArgs[0]), Number(restArgs[1]), restArgs.slice(2).join(" "));
} else if (commandName === "screenshot") {
  result = await screenshot(restArgs[0]);
} else {
  usage();
  process.exit(2);
}

console.log(JSON.stringify(result, null, 2));
