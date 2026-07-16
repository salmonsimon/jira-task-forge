# Video Animation Kit

This kit contains reproducible visual inserts for README and video editing. It
does not include a fabricated live demo; the final app footage must be recorded
manually.

The inserts use Jira Task Forge's dark-mode palette, compact controls, panel
geometry, and review states so they read as product UI rather than standalone
infographics.

## Assets

- `animated/automatic-naming.gif`: directly usable animated export for automatic
  Jira naming.
- `animated/manual-vs-sync.gif`: directly usable animated export for Manual mode
  versus Sync from Notion page.
- `animated/proposal-review.gif`: directly usable animated export for Proposal
  Review decisions.
- `animated/manifest.json`: generated export metadata.
- `generated/automatic-naming.svg`: local task inputs becoming Epic and
  Story/Bug summaries.
- `generated/manual-vs-sync.svg`: Manual mode and Sync from Notion page toggle.
- `generated/proposal-review.svg`: Proposal Review accept, reject, manual edit,
  and AI revision decisions.
- `frames/*.png`: representative desktop and mobile README-width frames used
  for visual inspection.

All example data is fictitious.

## Animated Export Specs

The committed animated exports are GIF89a files generated from the same SVG
source timeline:

- dimensions: `640x360`;
- duration: `6s`;
- source frame rate: `10 fps`;
- source frame count: `60`;
- palette: per-frame 128-color quantization;
- target use: README inserts, issue/PR handoff previews, and timeline-friendly
  video editing placeholders.

MP4/WebM exports are not committed because this repo does not require a global
`ffmpeg` or ImageMagick install. The GIF exports are the directly usable
animated format for this kit.

## Regenerate

From the repo root:

```bash
npm run assets:video-kit
```

The command rewrites every generated SVG and PNG deterministically.
It also rewrites every GIF animated export and `animated/manifest.json`.

## Verification

Useful checks:

```bash
file docs/video-kit/animated/*.gif docs/video-kit/frames/*.png
node -e 'const fs=require("fs"); for (const p of fs.readdirSync("docs/video-kit/animated").filter(f=>f.endsWith(".gif"))) { const b=fs.readFileSync("docs/video-kit/animated/"+p); const frames=(b.toString("binary").match(/\x21\xF9\x04/g)||[]).length; console.log(p+" frames="+frames+" bytes="+b.length+" header="+b.subarray(0,6).toString()); }'
```

Expected result: every animated export reports `GIF89a`, `640 x 360`, a
non-zero frame-control count, and a sub-1 MB file size.

## Visual Approval

These assets are public-facing and require HITL visual approval before merging
or using them in release material.
