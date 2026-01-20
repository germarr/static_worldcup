# Static World Cup 2026

A static, Tailwind CDN-powered page that visualizes FIFA World Cup 2026 group matches, standings, third-place rankings, and a knockout bracket.

## Features

- Group-stage match cards with scores, dates, and stadiums
- Group standings (top two highlighted, third highlighted)
- Third-place ranking table with top 8 highlighted
- Knockout bracket from Round of 32 through Final
- Randomize results button to simulate new group outcomes

## Files

- `index.html` - Main static page (all data embedded)
- `core_files/` - Source JSON files for teams, matches, and stadiums

## Usage

Open `index.html` in a browser. No build step required.

## Notes

- The data is embedded in the HTML for fully static loading (no `fetch` calls).
- Randomization only affects group-stage matches.
