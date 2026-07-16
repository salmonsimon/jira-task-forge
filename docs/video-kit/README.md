# Video Animation Kit

This kit contains reproducible visual inserts for README and video editing. It
does not include a fabricated live demo; the final app footage must be recorded
manually.

## Assets

- `generated/automatic-naming.svg`: local task inputs becoming Epic and
  Story/Bug summaries.
- `generated/manual-vs-sync.svg`: Manual mode and Sync from Notion page toggle.
- `generated/proposal-review.svg`: Proposal Review accept, reject, manual edit,
  and AI revision decisions.
- `frames/*.png`: representative desktop and mobile README-width frames used
  for visual inspection.

All example data is fictitious.

## Regenerate

From the repo root:

```bash
npm run assets:video-kit
```

The command rewrites every generated SVG and PNG deterministically.

## Visual Approval

These assets are public-facing and require HITL visual approval before merging
or using them in release material.
