# The Novelist 5.0.0 - Release Notes

## Highlights

- Added a bilingual Italian/English interface with automatic language detection and manual override in Settings.
- Localized the main shell, dashboard, story workflow, editor, plots, scenes, characters, locations, memory, revisions, analysis, dialogs, export labels, and user-facing AI statuses.
- Updated AI prompts and fallbacks so operational instructions follow the interface language while project content remains unchanged.
- Added English smoke coverage and dictionary completeness checks for the i18n layer.

## Language Behavior

- System locale starting with `it` selects Italian automatically.
- Other system locales select English automatically.
- Users can force `Italiano`, `English`, or `Automatico` in Settings.
- Existing project content, generated wiki files, chapters, scenes, plots, cards, and selected text are not translated automatically.

## Build Notes

- Version: `5.0.0`.
- Desktop targets remain macOS and Windows.
- Builds are unsigned; macOS Gatekeeper and Windows SmartScreen can show first-run warnings.
- Recommended release checks:
  - `npm run typecheck`
  - `npm run test`
  - `npm run test:e2e`
  - `npm run test:e2e:electron`
  - `npm run pack`
  - `npm run dist:mac`
  - `npm run dist:win`
