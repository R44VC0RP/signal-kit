# Aeonik

Aeonik is a commercial font licensed by [CoFo Type Foundry](https://cofotype.com/aeonik). The repo references Aeonik via `@font-face` in `src/app/globals.css`. By default the `@font-face` blocks only contain `local()` sources so the site does not 404 on any URLs.

To self-host the webfont, do this:

1. Drop these files into this directory:
   - `AeonikPro-Regular.woff2` (weight 400)
   - `AeonikPro-RegularItalic.woff2` (weight 400, italic)
   - `AeonikPro-Medium.woff2` (weight 500)
   - `AeonikPro-MediumItalic.woff2` (weight 500, italic)
   - `AeonikPro-Bold.woff2` (weight 700)
   - `AeonikPro-BoldItalic.woff2` (weight 700, italic)

2. In `src/app/globals.css`, add the matching `url("/fonts/aeonik/<file>.woff2") format("woff2")` source to each `@font-face` block, after the existing `local()` declarations.

If the files are missing, the site falls back to a near-equivalent system stack so layout stays correct.
