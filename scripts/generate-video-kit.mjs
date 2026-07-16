import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import gifenc from "gifenc";
import { PNG } from "pngjs";

const { GIFEncoder, applyPalette, quantize } = gifenc;

const outDir = "docs/video-kit/generated";
const frameDir = "docs/video-kit/frames";
const animatedDir = "docs/video-kit/animated";
const gifWidth = 640;
const gifHeight = 360;
const gifDurationSeconds = 6;
const gifFps = 10;
const gifFrameDelayMs = 1000 / gifFps;

const palette = {
  ink: "#f4f5f7",
  muted: "#aeb3bd",
  subtle: "#7f858f",
  surface: "#151719",
  panel: "#1d1f23",
  raised: "#25272c",
  input: "#22252a",
  control: "#303238",
  line: "#454852",
  blue: "#0c66e4",
  blueLight: "#85b8ff",
  green: "#7ee2a8",
  red: "#ff9c8f",
  amber: "#f5cd47",
  purple: "#b8a7ff"
};

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function svgShell(title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-label="${esc(title)}">
  <style>
    .bg { fill: ${palette.surface}; }
    .panel { fill: ${palette.panel}; stroke: ${palette.line}; stroke-width: 2; }
    .raised { fill: ${palette.raised}; stroke: ${palette.line}; stroke-width: 2; }
    .input { fill: ${palette.input}; stroke: ${palette.line}; stroke-width: 2; }
    .title { fill: ${palette.ink}; font: 700 32px Inter, Segoe UI, Arial, sans-serif; }
    .label { fill: ${palette.ink}; font: 600 18px Inter, Segoe UI, Arial, sans-serif; }
    .body { fill: ${palette.ink}; font: 500 22px Inter, Segoe UI, Arial, sans-serif; }
    .small { fill: ${palette.muted}; font: 500 16px Inter, Segoe UI, Arial, sans-serif; }
    .tiny { fill: ${palette.muted}; font: 500 14px Inter, Segoe UI, Arial, sans-serif; }
    .mono { fill: ${palette.ink}; font: 600 20px Consolas, Menlo, monospace; }
    .chip { fill: #1d355c; stroke: #31588f; stroke-width: 1.5; }
    .blue { fill: ${palette.blue}; }
    .green { fill: ${palette.green}; }
    .red { fill: ${palette.red}; }
    .amber { fill: ${palette.amber}; }
    .purple { fill: ${palette.purple}; }
    .stroke-blue { stroke: ${palette.blue}; }
    .stroke-green { stroke: ${palette.green}; }
    .stroke-muted { stroke: ${palette.muted}; }
    .fade-in { opacity: 0; animation: fade 6s infinite; }
    .draw { stroke-dasharray: 500; stroke-dashoffset: 500; animation: draw 6s infinite; }
    @keyframes fade {
      0%, 10% { opacity: 0; transform: translateY(8px); }
      20%, 72% { opacity: 1; transform: translateY(0); }
      90%, 100% { opacity: 0; transform: translateY(-4px); }
    }
    @keyframes draw {
      0%, 18% { stroke-dashoffset: 500; opacity: 0; }
      32%, 78% { stroke-dashoffset: 0; opacity: 1; }
      100% { stroke-dashoffset: 0; opacity: 0; }
    }
  </style>
  <rect class="bg" width="1280" height="720"/>
  ${body}
</svg>
`;
}

function automaticNamingSvg() {
  return svgShell("Automatic naming animation", `
  <text class="title" x="72" y="78">Automatic Jira Naming</text>
  <text class="small" x="72" y="110">Local task fields become consistent Jira summaries</text>

  <rect class="panel" x="72" y="144" width="548" height="500" rx="8"/>
  <text class="label" x="106" y="188">Local Task</text>
  <text class="tiny" x="106" y="214">Preparation Tray fields</text>
  ${inputRow(106, 238, "Project", "F1 Car Simulator", palette.blueLight)}
  ${inputRow(106, 330, "Area", "Gameplay", palette.green)}
  ${inputRow(106, 422, "Scope", "Pit Stop Polish", palette.purple)}
  ${inputRow(106, 514, "Task", "Smooth pit entry steering assist", palette.amber)}

  <path class="draw stroke-blue" d="M650 360 C704 360 704 252 746 252" fill="none" stroke-width="5" stroke-linecap="round"/>
  <path class="draw stroke-green" d="M650 414 C704 414 704 498 746 498" fill="none" stroke-width="5" stroke-linecap="round" style="animation-delay:.6s"/>

  <g class="fade-in" style="animation-delay:.4s">
    <rect class="panel" x="746" y="166" width="462" height="176" rx="8"/>
    <rect x="770" y="190" width="54" height="24" rx="4" fill="#1d355c"/>
    <text x="782" y="207" fill="${palette.blueLight}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="13" font-weight="700">EPIC</text>
    <text class="label" x="770" y="246">Epic summary</text>
    <text class="mono" x="770" y="288">[F1 Car Simulator] [Gameplay]</text>
    <text class="mono" x="770" y="320">Pit Stop Polish</text>
  </g>

  <g class="fade-in" style="animation-delay:1s">
    <rect class="panel" x="746" y="412" width="462" height="176" rx="8"/>
    <rect x="770" y="436" width="64" height="24" rx="4" fill="#183f2e"/>
    <text x="782" y="453" fill="${palette.green}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="13" font-weight="700">STORY</text>
    <text class="label" x="770" y="492">Story / Bug summary</text>
    <text class="mono" x="770" y="534">[Gameplay] Smooth pit entry</text>
    <text class="mono" x="770" y="566">steering assist</text>
  </g>
  `);
}

function inputRow(x, y, label, value, color) {
  return `<text class="small" x="${x}" y="${y + 16}">${esc(label)}</text>
  <rect x="${x}" y="${y + 30}" width="474" height="48" rx="4" fill="${palette.input}" stroke="${color}" stroke-width="2"/>
  <text class="body" x="${x + 16}" y="${y + 62}">${esc(value)}</text>`;
}

function manualVsSyncSvg() {
  return svgShell("Manual versus sync catalog mode animation", `
  <rect class="panel" x="164" y="52" width="952" height="616" rx="8"/>
  <rect x="164" y="52" width="952" height="82" rx="8" fill="${palette.panel}"/>
  <line x1="164" y1="134" x2="1116" y2="134" stroke="${palette.line}" stroke-width="2"/>
  <text class="title" x="204" y="92">Categories</text>
  <text class="small" x="204" y="119">Projects and areas available in capture controls</text>
  <path d="M1072 78 L1092 98 M1092 78 L1072 98" stroke="${palette.muted}" stroke-width="3" stroke-linecap="round"/>

  <text class="label" x="204" y="184">Areas</text>
  <g>
    <rect x="760" y="153" width="88" height="42" rx="21" fill="${palette.control}" stroke="${palette.line}" stroke-width="2"/>
    <circle cx="783" cy="174" r="16" fill="#ffffff">
      <animate attributeName="cx" values="783;825;825;783" keyTimes="0;.28;.72;1" dur="6s" repeatCount="indefinite"/>
    </circle>
    <path d="M775 181 L791 165 L799 173 L783 189 L773 191 Z" fill="${palette.subtle}">
      <animate attributeName="opacity" values="1;0;0;1" keyTimes="0;.28;.72;1" dur="6s" repeatCount="indefinite"/>
    </path>
    <path d="M815 174 C815 166 821 160 829 160 C835 160 840 163 843 168 M843 160 L843 170 L833 168" fill="none" stroke="${palette.blue}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.28;.72;1" dur="6s" repeatCount="indefinite"/>
    </path>
  </g>
  ${appButton(866, 153, 98, "Sync", false)}
  ${appButton(978, 153, 98, "New", false)}

  <g>
    <rect class="raised" x="204" y="222" width="872" height="86" rx="6"/>
    <text class="body" x="232" y="258">Gameplay</text>
    <text class="tiny" x="232" y="286">Local Area</text>
    ${modeBadge(930, 246, "Manual", "#533f04", palette.amber)}
    <g class="fade-in" style="animation-delay:.3s">
      <rect x="224" y="267" width="176" height="24" fill="${palette.raised}"/>
      <text class="tiny" x="232" y="286">Notion catalog</text>
      <rect x="920" y="238" width="136" height="44" fill="${palette.raised}"/>
      ${modeBadge(930, 246, "Synced", "#183f2e", palette.green)}
    </g>
  </g>
  <g>
    <rect class="raised" x="204" y="324" width="872" height="86" rx="6"/>
    <text class="body" x="232" y="360">QA</text>
    <text class="tiny" x="232" y="388">Local Area</text>
    ${modeBadge(930, 348, "Manual", "#533f04", palette.amber)}
    <g class="fade-in" style="animation-delay:.3s">
      <rect x="224" y="369" width="176" height="24" fill="${palette.raised}"/>
      <text class="tiny" x="232" y="388">Notion catalog</text>
      <rect x="920" y="340" width="136" height="44" fill="${palette.raised}"/>
      ${modeBadge(930, 348, "Synced", "#183f2e", palette.green)}
    </g>
  </g>

  <g class="fade-in" style="animation-delay:.3s">
    <rect x="204" y="442" width="872" height="154" rx="6" fill="#172b4d" stroke="#344563" stroke-width="2"/>
    <circle cx="242" cy="480" r="18" fill="#1d355c"/>
    <path d="M232 480 C232 472 238 466 246 466 C252 466 257 469 260 474 M260 466 L260 476 L250 474" fill="none" stroke="${palette.blueLight}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <text class="label" x="276" y="480">Sync from Notion page</text>
    <text class="small" x="276" y="510">JTF Sync Catalog - My Copy</text>
    <text class="tiny" x="276" y="538">Owned top-level page selected in the OAuth picker</text>
    <rect x="856" y="548" width="190" height="32" rx="4" fill="#183f2e"/>
    <text x="880" y="570" fill="${palette.green}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="14" font-weight="700">Catalog validated</text>
  </g>
  `);
}

function proposalReviewSvg() {
  return svgShell("Proposal Review decisions animation", `
  <rect class="panel" x="98" y="42" width="1084" height="636" rx="8"/>
  <rect x="98" y="42" width="1084" height="96" rx="8" fill="${palette.panel}"/>
  <line x1="98" y1="138" x2="1182" y2="138" stroke="${palette.line}" stroke-width="2"/>
  <circle cx="132" cy="80" r="16" fill="#1d355c"/>
  <path d="M126 80 L132 86 L141 72 M136 88 L144 80" fill="none" stroke="${palette.blueLight}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <text class="title" x="162" y="82">Proposal review</text>
  <text class="small" x="162" y="112">[Gameplay] Smooth pit entry steering assist</text>
  ${modeBadge(906, 69, "Pending", "#533f04", palette.amber)}
  <text class="tiny" x="1004" y="88">Claude · Sonnet</text>

  <rect class="raised" x="132" y="162" width="1016" height="92" rx="6"/>
  <text class="label" x="158" y="196">Review proposed Jira description changes.</text>
  <text class="small" x="158" y="224">AI drafts remain local until you resolve each section.</text>
  ${appButton(944, 184, 174, "Request changes", false)}

  ${proposalReviewRow(132, 278, "Historia de usuario", "Improve driver control entering pit lane.", "accept", 0.2)}
  ${proposalReviewRow(132, 382, "Alcance", "Assist steering only below the pit speed threshold.", "edit", 1.1)}
  ${proposalReviewRow(132, 486, "Criterios de aceptacion", "Car remains controllable without auto-driving.", "reject", 2)}

  <line x1="98" y1="610" x2="1182" y2="610" stroke="${palette.line}" stroke-width="2"/>
  ${appButton(820, 628, 156, "Reject remaining", false)}
  ${appButton(992, 628, 156, "Accept remaining", true)}
  `);
}

function appButton(x, y, width, label, primary) {
  const fill = primary ? palette.blue : palette.control;
  const stroke = primary ? palette.blue : palette.line;
  return `<rect x="${x}" y="${y}" width="${width}" height="42" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  <text x="${x + width / 2}" y="${y + 27}" text-anchor="middle" fill="${palette.ink}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="15" font-weight="600">${esc(label)}</text>`;
}

function modeBadge(x, y, label, fill, textColor) {
  const width = Math.max(82, label.length * 9 + 28);
  return `<rect x="${x}" y="${y}" width="${width}" height="28" rx="4" fill="${fill}"/>
  <text x="${x + width / 2}" y="${y + 19}" text-anchor="middle" fill="${textColor}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="13" font-weight="700">${esc(label)}</text>`;
}

function proposalReviewRow(x, y, heading, detail, action, delay) {
  const actionColor = action === "accept" ? palette.green : action === "reject" ? palette.red : palette.amber;
  const actionLabel = action === "accept" ? "Accepted" : action === "reject" ? "Rejected" : "Edited";
  const actionFill = action === "accept" ? "#183f2e" : action === "reject" ? "#5d1f1a" : "#533f04";
  const iconX = x + 872;
  const icon = action === "accept"
    ? `<path d="M${iconX} ${y + 51} L${iconX + 7} ${y + 58} L${iconX + 20} ${y + 43}" fill="none" stroke="${actionColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
    : action === "reject"
      ? `<path d="M${iconX + 1} ${y + 44} L${iconX + 18} ${y + 61} M${iconX + 18} ${y + 44} L${iconX + 1} ${y + 61}" stroke="${actionColor}" stroke-width="3" stroke-linecap="round"/>`
      : `<path d="M${iconX + 1} ${y + 59} L${iconX + 16} ${y + 44} L${iconX + 23} ${y + 51} L${iconX + 8} ${y + 66} L${iconX - 1} ${y + 68} Z" fill="${actionColor}"/>`;

  return `<g>
    <rect class="raised" x="${x}" y="${y}" width="1016" height="88" rx="6"/>
    <text class="label" x="${x + 24}" y="${y + 32}">${esc(heading)}</text>
    <text class="small" x="${x + 24}" y="${y + 61}">${esc(detail)}</text>
    <rect x="${x + 846}" y="${y + 23}" width="54" height="42" rx="4" fill="${palette.control}" stroke="${palette.line}" stroke-width="2"/>
    <path d="M${x + 861} ${y + 54} L${x + 878} ${y + 37} L${x + 886} ${y + 45} L${x + 869} ${y + 62} L${x + 859} ${y + 64} Z" fill="${palette.muted}"/>
    <rect x="${x + 912}" y="${y + 23}" width="44" height="42" rx="4" fill="${palette.control}" stroke="${palette.line}" stroke-width="2"/>
    <path d="M${x + 925} ${y + 37} L${x + 943} ${y + 55} M${x + 943} ${y + 37} L${x + 925} ${y + 55}" stroke="${palette.red}" stroke-width="3" stroke-linecap="round"/>
    <rect x="${x + 968}" y="${y + 23}" width="44" height="42" rx="4" fill="${palette.control}" stroke="${palette.line}" stroke-width="2"/>
    <path d="M${x + 980} ${y + 47} L${x + 987} ${y + 54} L${x + 1000} ${y + 39}" fill="none" stroke="${palette.green}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <g class="fade-in" style="animation-delay:${delay}s">
      <rect x="${x + 840}" y="${y + 22}" width="176" height="44" rx="4" fill="${actionFill}" stroke="${actionColor}" stroke-width="2"/>
      ${icon}
      <text x="${x + 944}" y="${y + 51}" text-anchor="middle" fill="${actionColor}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="14" font-weight="700">${actionLabel}</text>
    </g>
  </g>`;
}

async function writeAssets() {
  await mkdir(outDir, { recursive: true });
  await mkdir(frameDir, { recursive: true });
  await mkdir(animatedDir, { recursive: true });

  const assets = [
    ["automatic-naming", automaticNamingSvg()],
    ["manual-vs-sync", manualVsSyncSvg()],
    ["proposal-review", proposalReviewSvg()]
  ];

  for (const [name, svg] of assets) {
    await writeFile(join(outDir, `${name}.svg`), svg, "utf8");
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  for (const [name, svg] of assets) {
    for (const [label, width] of [["desktop", 960], ["mobile", 480]]) {
      const buffer = await renderFrame(page, svg, width, 3.8);
      await writeFile(join(frameDir, `${name}-${label}.png`), buffer);
    }
    await writeGif(page, name, svg);
  }
  await browser.close();

  const manifest = {
    generatedAt: "deterministic",
    command: "npm run assets:video-kit",
    animatedExports: assets.map(([name]) => ({
      name,
      path: `docs/video-kit/animated/${name}.gif`,
      format: "GIF89a",
      dimensions: `${gifWidth}x${gifHeight}`,
      durationSeconds: gifDurationSeconds,
      fps: gifFps,
      frames: gifDurationSeconds * gifFps
    }))
  };
  await writeFile(join(animatedDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function svgAtTime(svg, seconds) {
  const cssPause = `.fade-in,.draw{animation-play-state:paused!important;animation-delay:-${seconds}s;}`;
  return svg
    .replace(/animation-delay:([0-9.]+)s/g, (_, delay) => `animation-delay:${Number(delay) - seconds}s`)
    .replace("</style>", `${cssPause}</style>`);
}

async function renderFrame(page, svg, width, seconds) {
  await page.setViewportSize({ width, height: Math.round(width * 9 / 16) });
  await page.setContent(`<body style="margin:0;background:${palette.surface}"><div style="width:100vw">${svgAtTime(svg, seconds)}</div><style>svg{width:100%;height:auto;display:block}</style></body>`, { waitUntil: "load" });
  await page.evaluate((time) => {
    const svgElement = document.querySelector("svg");
    svgElement.setCurrentTime(time);
    svgElement.pauseAnimations();
  }, seconds);
  return page.screenshot({ fullPage: true });
}

async function writeGif(page, name, svg) {
  const gif = GIFEncoder();
  const totalFrames = gifDurationSeconds * gifFps;
  for (let frame = 0; frame < totalFrames; frame += 1) {
    const seconds = frame / gifFps;
    const buffer = await renderFrame(page, svg, gifWidth, seconds);
    const png = PNG.sync.read(buffer);
    const palette = quantize(png.data, 128);
    const index = applyPalette(png.data, palette);
    gif.writeFrame(index, gifWidth, gifHeight, {
      palette,
      delay: gifFrameDelayMs,
      repeat: 0
    });
  }
  gif.finish();
  await writeFile(join(animatedDir, `${name}.gif`), gif.bytes());
}

await writeAssets();
