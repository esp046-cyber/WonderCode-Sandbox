# Architecture

Static vanilla-JS PWA, no build step.

- `app.js`: tabs, rendering, import/export, templates list
- `js/editor.js`: mobile drawers and overflow menu
- `js/validator.js`: lint rules per language
- `js/tag-converter.js`: tag extraction and InTouch/System Platform conversion
- `js/templates.js`: AGAC templates
- `js/db.js`: localStorage wrapper
- `service-worker.js`: cache-first assets, offline fallback; bump `V` on release
