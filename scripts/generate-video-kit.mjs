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
  ink: "#182230",
  muted: "#53627a",
  surface: "#f7f9fc",
  panel: "#ffffff",
  line: "#d6deea",
  blue: "#1d5fd1",
  green: "#147a4f",
  red: "#c93a3a",
  amber: "#b66a04",
  purple: "#6f48c9"
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
    .title { fill: ${palette.ink}; font: 700 34px Inter, Segoe UI, Arial, sans-serif; }
    .label { fill: ${palette.muted}; font: 600 18px Inter, Segoe UI, Arial, sans-serif; }
    .body { fill: ${palette.ink}; font: 500 24px Inter, Segoe UI, Arial, sans-serif; }
    .small { fill: ${palette.muted}; font: 500 16px Inter, Segoe UI, Arial, sans-serif; }
    .mono { fill: ${palette.ink}; font: 600 22px Consolas, Menlo, monospace; }
    .chip { fill: #edf3ff; stroke: #b9ccf6; stroke-width: 1.5; }
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
  <text class="small" x="72" y="112">Fictitious example data for public docs and demo inserts</text>

  <rect class="panel" x="72" y="156" width="540" height="430" rx="18"/>
  <text class="label" x="106" y="204">Local Task Inputs</text>
  ${inputRow(106, 256, "Project", "F1 Car Simulator", palette.blue)}
  ${inputRow(106, 334, "Area", "Gameplay", palette.green)}
  ${inputRow(106, 412, "Scope", "Pit Stop Polish", palette.purple)}
  ${inputRow(106, 490, "Task", "Smooth pit entry steering assist", palette.amber)}

  <path class="draw stroke-blue" d="M638 365 C692 365 692 250 735 250" fill="none" stroke-width="6" stroke-linecap="round"/>
  <path class="draw stroke-green" d="M638 405 C692 405 692 454 735 454" fill="none" stroke-width="6" stroke-linecap="round" style="animation-delay:.6s"/>

  <g class="fade-in" style="animation-delay:.4s">
    <rect class="panel" x="736" y="176" width="472" height="150" rx="18"/>
    <text class="label" x="770" y="222">Epic Summary</text>
    <text class="mono" x="770" y="270">[F1 Car Simulator] [Gameplay]</text>
    <text class="mono" x="770" y="304">Pit Stop Polish</text>
  </g>

  <g class="fade-in" style="animation-delay:1s">
    <rect class="panel" x="736" y="382" width="472" height="150" rx="18"/>
    <text class="label" x="770" y="428">Story/Bug Summary</text>
    <text class="mono" x="770" y="480">[Gameplay] Smooth pit entry</text>
    <text class="mono" x="770" y="514">steering assist</text>
  </g>
  `);
}

function inputRow(x, y, label, value, color) {
  return `<text class="small" x="${x}" y="${y - 20}">${esc(label)}</text>
  <rect x="${x}" y="${y}" width="445" height="42" rx="10" fill="#fff" stroke="${color}" stroke-width="2"/>
  <text class="body" x="${x + 18}" y="${y + 29}">${esc(value)}</text>`;
}

function manualVsSyncSvg() {
  return svgShell("Manual versus sync catalog mode animation", `
  <text class="title" x="72" y="78">Area Catalog Modes</text>
  <text class="small" x="72" y="112">Choose local Manual mode or validate a user-owned Notion page</text>

  <rect class="panel" x="104" y="170" width="460" height="390" rx="18"/>
  <text class="label" x="142" y="222">Manual mode</text>
  <circle cx="166" cy="286" r="38" fill="#fff4db" stroke="#dfb05a" stroke-width="3"/>
  <path d="M150 300 L180 270 L196 286 L166 316 L146 320 Z" fill="${palette.amber}"/>
  <text class="body" x="226" y="282">Create Areas in the app</text>
  <text class="small" x="226" y="316">Best for quick personal setup</text>
  <rect class="chip" x="142" y="384" width="138" height="42" rx="21"/>
  <text class="small" x="166" y="411">Gameplay</text>
  <rect class="chip" x="296" y="384" width="86" height="42" rx="21"/>
  <text class="small" x="322" y="411">QA</text>
  <rect class="chip" x="398" y="384" width="90" height="42" rx="21"/>
  <text class="small" x="421" y="411">Bug</text>

  <rect class="panel" x="716" y="170" width="460" height="390" rx="18"/>
  <text class="label" x="754" y="222">Sync from Notion page</text>
  <circle cx="778" cy="286" r="38" fill="#e9f5ff" stroke="#9ec4ee" stroke-width="3"/>
  <path d="M758 286 C758 270 770 258 786 258 C798 258 808 264 814 274" fill="none" stroke="${palette.blue}" stroke-width="7" stroke-linecap="round"/>
  <path d="M817 259 L815 278 L797 273" fill="none" stroke="${palette.blue}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <text class="body" x="838" y="282">Select owned top-level page</text>
  <text class="small" x="838" y="316">Validate JSON, then sync Areas</text>
  <g class="fade-in" style="animation-delay:.5s">
    <rect x="754" y="372" width="360" height="76" rx="14" fill="#fff" stroke="${palette.green}" stroke-width="3"/>
    <text class="small" x="782" y="402">OAuth picker</text>
    <text class="body" x="782" y="432">JTF Sync Catalog - My Copy</text>
  </g>

  <line class="stroke-muted" x1="610" y1="218" x2="610" y2="512" stroke-width="2" stroke-dasharray="10 12"/>
  <rect x="556" y="326" width="108" height="56" rx="28" fill="#eef3fb" stroke="${palette.line}" stroke-width="2"/>
  <circle cx="586" cy="354" r="22" fill="${palette.green}">
    <animate attributeName="cx" values="586;634;586" dur="6s" repeatCount="indefinite"/>
    <animate attributeName="fill" values="${palette.green};${palette.blue};${palette.green}" dur="6s" repeatCount="indefinite"/>
  </circle>
  `);
}

function proposalReviewSvg() {
  return svgShell("Proposal Review decisions animation", `
  <text class="title" x="72" y="78">Proposal Review Decisions</text>
  <text class="small" x="72" y="112">AI drafts stay local until the user accepts or edits them</text>

  <rect class="panel" x="74" y="156" width="586" height="452" rx="18"/>
  <text class="label" x="112" y="204">AI proposal for [Gameplay] Smooth pit entry steering assist</text>
  ${proposalLine(112, 250, "Historia de usuario", "Improve driver control entering pit lane.", palette.green)}
  ${proposalLine(112, 328, "Alcance", "Assist steering only below pit speed threshold.", palette.blue)}
  ${proposalLine(112, 406, "Criterios de aceptacion", "Car remains controllable without auto-driving.", palette.amber)}
  ${proposalLine(112, 484, "Checklist antes de Review", "Attach short before/after capture.", palette.purple)}

  <g class="fade-in" style="animation-delay:.3s">
    <rect class="panel" x="736" y="170" width="396" height="72" rx="16"/>
    <circle cx="774" cy="206" r="16" class="green"/>
    <path d="M765 206 L772 214 L786 196" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <text class="body" x="812" y="214">Accept section</text>
  </g>
  <g class="fade-in" style="animation-delay:.9s">
    <rect class="panel" x="736" y="278" width="396" height="72" rx="16"/>
    <circle cx="774" cy="314" r="16" class="red"/>
    <path d="M766 306 L782 322 M782 306 L766 322" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    <text class="body" x="812" y="322">Reject section</text>
  </g>
  <g class="fade-in" style="animation-delay:1.5s">
    <rect class="panel" x="736" y="386" width="396" height="72" rx="16"/>
    <circle cx="774" cy="422" r="16" class="amber"/>
    <path d="M764 430 L784 410 L792 418 L772 438 L762 440 Z" fill="#fff"/>
    <text class="body" x="812" y="430">Manual edit</text>
  </g>
  <g class="fade-in" style="animation-delay:2.1s">
    <rect class="panel" x="736" y="494" width="396" height="72" rx="16"/>
    <circle cx="774" cy="530" r="16" class="blue"/>
    <path d="M764 530 C764 522 770 516 778 516 C784 516 789 519 792 524" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    <path d="M792 516 L792 526 L782 524" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <text class="body" x="812" y="538">Request AI revision</text>
  </g>
  `);
}

function proposalLine(x, y, heading, detail, color) {
  return `<rect x="${x}" y="${y - 28}" width="500" height="58" rx="12" fill="#fff" stroke="${color}" stroke-width="2"/>
  <text class="small" x="${x + 18}" y="${y - 5}">${esc(heading)}</text>
  <text class="small" x="${x + 18}" y="${y + 20}">${esc(detail)}</text>`;
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
  await page.setContent(`<body style="margin:0;background:#f7f9fc"><div style="width:100vw">${svgAtTime(svg, seconds)}</div><style>svg{width:100%;height:auto;display:block}</style></body>`, { waitUntil: "load" });
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
