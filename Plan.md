# Print-Friendly World Cup 2026 Pool Page - Implementation Plan

## Analysis Summary

### Current Architecture

**Files:**
- `index.html` (94K) - Card-based group matches with knockout bracket
- `group-grid.html` (105K) - Table-based group matches with knockout bracket (has basic print styles)
- `core_files/` - JSON data (teams, matches, stadiums)

**Key Features:**
1. **Group Stage Matches** - Displayed as cards (index.html) or table rows (group-grid.html)
2. **Group Standings** - 12 groups (A-L) with 4 teams each, showing top 2 and best third
3. **Third-Place Rankings** - All 12 third-place teams ranked, with top 8 advancing
4. **Knockout Bracket** - 5-column layout: Round of 32, Round of 16, Quarterfinals, Semifinals, Final/Third Place
5. **State Management** - Uses URL hash with base64 encoded picks (`#p=...`)

**Technology Stack:**
- Static HTML with embedded JSON data
- Tailwind CSS via CDN
- Vanilla JavaScript for rendering
- No build step required

**Existing Print Support:**
- `group-grid.html` has basic `@media print` styles
- Removes backgrounds, buttons (`.no-print` class)
- Reduces table font size to 10px

## Solution: Dedicated Print Page

Create **`print-pool.html`** - a dedicated print-optimized page that consolidates all pool information in a compact, printer-friendly format.

### Benefits

1. **Clean separation** - Print layout doesn't interfere with interactive pages
2. **Maximum optimization** - Can aggressively compress layout without compromising UX
3. **Maintainability** - Single source of truth (shares data/functions with existing pages)
4. **Flexibility** - Can load picks from URL hash to print any pool state

## Design Approach

### Layout Strategy: Multi-Column Compact View

**Page 1: Group Stage & Standings**
- **Header section** (minimal, 1 inch)
  - Title: "World Cup 2026 Pool" + optional pool name
  - Print date/time

- **Group Matches Grid** (2-3 columns)
  - Ultra-compact table format per group
  - Columns: Match#, Teams (flags + abbr.), Date, Pick
  - Font size: 7-8px
  - Remove stadium details (or micro-text)

- **Group Standings** (4 columns x 3 rows = 12 groups)
  - Each group: Team (abbr), Pts, GD
  - Highlight top 2 (bold) and third (italic or *)
  - Font size: 7px

**Page 2: Knockout Bracket & Results**
- **Third-Place Rankings** (compact table)
  - Top 8 highlighted
  - Minimal columns: Rank, Team, Pts, GD

- **Knockout Bracket** (horizontal flow)
  - 5 columns fitting width of page
  - Minimal spacing between rounds
  - Team names abbreviated (3-4 chars)
  - Show picks with checkmarks or highlights

- **Final Results Box**
  - Champion + Third Place winner in bold

### CSS Print Optimizations

```css
@media print {
  /* Page setup */
  @page {
    size: letter portrait; /* or A4 */
    margin: 0.5in 0.4in;
  }

  /* Global resets */
  * {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  body {
    background: white !important;
    font-size: 8px;
    line-height: 1.2;
  }

  /* Page breaks */
  .page-break {
    page-break-after: always;
  }

  .no-break {
    page-break-inside: avoid;
  }

  /* Hide interactive elements */
  .no-print { display: none !important; }

  /* Compact spacing */
  h1 { font-size: 16px; margin: 0 0 8px; }
  h2 { font-size: 12px; margin: 8px 0 4px; }
  h3 { font-size: 10px; margin: 4px 0 2px; }

  table {
    font-size: 7px;
    border-collapse: collapse;
  }

  th, td {
    padding: 1px 3px;
    border: 1px solid #ddd;
  }
}
```

### Data Flow & State Management

1. **Load picks from URL hash** (same format as existing pages)
   - Parse `window.location.hash` (`#p=base64data`)
   - Decode picks for groups, knockout, third-place order

2. **Render all sections statically** (no interactive elements)
   - Use existing data structures (matches, teams, stadiums)
   - Leverage existing functions: `buildStandings()`, `buildKnockoutBracket()`

3. **Navigation from main pages**
   - Add "Print Pool" button on `group-grid.html`
   - Button redirects to `print-pool.html` + passes current hash
   - Example: `print-pool.html#p=<encoded_picks>`

## Implementation Strategy

### Step 1: Create HTML Structure
- Copy boilerplate from `group-grid.html` (head, data scripts, base styles)
- Create semantic sections with print-first layout
- Use CSS Grid for multi-column layouts
- Embed same JSON data (`matches`, `teams`, `stadiums`)

### Step 2: Develop Compact Components

**Compact Group Matches Table:**
```html
<table class="group-matches-compact">
  <thead>
    <tr><th>M#</th><th>Teams</th><th>Date</th><th>Pick</th></tr>
  </thead>
  <tbody>
    <!-- Ultra-compact rows with flags + abbreviations -->
  </tbody>
</table>
```

**Compact Standings Grid:**
```html
<div class="standings-grid"> <!-- 4 cols x 3 rows -->
  <div class="group-standing">
    <div class="group-title">Group A</div>
    <div class="teams">
      <div class="team top2">MEX 9pts +5</div>
      <div class="team top2">KOR 6pts +2</div>
      <div class="team third">RSA 3pts -1</div>
    </div>
  </div>
</div>
```

**Compact Bracket:**
```html
<div class="bracket-compact">
  <div class="bracket-round">
    <h4>R32</h4>
    <div class="match">MEX ✓ vs KOR</div>
    <!-- 16 matches -->
  </div>
  <!-- Repeat for R16, QF, SF, Final -->
</div>
```

### Step 3: Implement Rendering Logic

Reuse and adapt existing functions:
- `loadPicksFromHash()` - Load state
- `buildStandings()` - Calculate standings
- `buildKnockoutBracket()` - Build bracket structure
- Create new: `renderCompactGroups()`, `renderCompactStandings()`, `renderCompactBracket()`

### Step 4: Optimize Print Styles

- Test with browser print preview
- Adjust font sizes to maximize content per page
- Ensure page breaks happen logically
- Use borders/shading sparingly (printer-friendly)
- Add flags as background-images (small, optimized)

### Step 5: Add Print Button to Existing Pages

Update `group-grid.html` print button:
```javascript
document.getElementById('print-pool').addEventListener('click', () => {
  const currentHash = window.location.hash;
  window.open(`print-pool.html${currentHash}`, '_blank');
});
```

## Critical Files for Implementation

- `group-grid.html` - Primary pattern to follow for structure, contains print button and existing print styles
- `index.html` - Reference for rendering logic (buildStandings, buildKnockoutBracket functions)
- `core_files/matches.json` - Core match data structure (104 matches)
- `core_files/fifa_teams.json` - Team data with flags and country codes
- `core_files/stadiums.json` - Stadium reference data

## Testing Plan

1. Test in Chrome/Firefox/Safari print preview
2. Verify all data renders correctly with different pick states
3. Test with empty picks (blank pool)
4. Test with complete picks (full pool)
5. Verify page breaks don't split critical content
6. Print physical copies to test real-world usability
7. Test with different paper sizes (Letter, A4)

## Edge Cases to Handle

1. **No picks selected** - Show all matches as "TBD"
2. **Partial picks** - Show selected + TBD for rest
3. **Invalid hash** - Fall back to blank pool
4. **Missing data** - Graceful degradation with placeholder text
5. **Very long team names** - Truncate or abbreviate
6. **Tie scenarios** - Show all tied teams with indicator
