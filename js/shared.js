/**
 * World Cup 2026 Pool - Shared Utilities
 * Common functions used across all pages
 */

// Global state - will be populated after data loads
let matches = [];
let teams = [];
let stadiums = [];
let picks = {};

// Cached lookup maps
let teamsById = new Map();
let stadiumsById = new Map();

// Third place drag state
let thirdPlaceDragSourceId = null;
let cachedThirdPlaceGroups = null;

/**
 * Fetch JSON data from URL
 */
const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
};

/**
 * Format ISO date string for display
 */
const formatDate = (isoString) => {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

/**
 * Convert bytes to URL-safe Base64
 */
const toBase64Url = (bytes) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/**
 * Convert URL-safe Base64 to bytes
 */
const fromBase64Url = (value) => {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * Encode picks object to compressed Base64 string
 */
const encodePicks = (picksData) => {
  const payload = JSON.stringify(picksData);
  const compressed = window.pako.deflate(payload);
  return toBase64Url(compressed);
};

/**
 * Decode compressed Base64 string to picks object
 */
const decodePicks = (encoded) => {
  const bytes = fromBase64Url(encoded);
  const json = window.pako.inflate(bytes, { to: "string" });
  return JSON.parse(json);
};

/**
 * Get simulated score based on pick value
 */
const getPickScore = (pick) => {
  if (pick === "H") return { home: 1, away: 0 };
  if (pick === "A") return { home: 0, away: 1 };
  if (pick === "D") return { home: 0, away: 0 };
  return null;
};

/**
 * Normalize picks object to ensure all required properties exist
 */
const normalizePicks = (picksData) => {
  if (!picksData || typeof picksData !== "object" || Array.isArray(picksData)) {
    return { knockout: {}, thirdPlaceOrder: [], standingsOrder: {} };
  }
  if (!picksData.knockout || typeof picksData.knockout !== "object") {
    picksData.knockout = {};
  }
  if (!Array.isArray(picksData.thirdPlaceOrder)) {
    picksData.thirdPlaceOrder = [];
  }
  if (!picksData.standingsOrder || typeof picksData.standingsOrder !== "object") {
    picksData.standingsOrder = {};
  }
  return picksData;
};

/**
 * Load picks from URL hash
 */
const loadPicksFromHash = () => {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash.startsWith("p=")) return {};
  const encoded = hash.slice(2);
  if (!encoded) return {};
  try {
    return decodePicks(encoded);
  } catch (error) {
    console.error("Failed to decode picks:", error);
    return {};
  }
};

/**
 * Persist picks to URL hash
 */
const persistPicks = () => {
  const baseUrl = `${window.location.pathname}${window.location.search}`;
  const knockoutPicks = picks?.knockout || {};
  const thirdPlaceOrder = picks?.thirdPlaceOrder || [];
  const standingsOrder = picks?.standingsOrder || {};
  const { knockout, ...groupPicks } = picks;
  const hasGroupPicks = Object.keys(groupPicks || {}).length > 0;
  const hasKnockoutPicks = Object.keys(knockoutPicks).length > 0;
  const hasThirdPlaceOrder = thirdPlaceOrder.length > 0;
  const hasStandingsOrder = Object.keys(standingsOrder).length > 0;
  const hasPicks = hasGroupPicks || hasKnockoutPicks || hasThirdPlaceOrder || hasStandingsOrder;
  if (!hasPicks) {
    history.replaceState(null, "", baseUrl);
    return;
  }
  const encoded = encodePicks(picks);
  history.replaceState(null, "", `${baseUrl}#p=${encoded}`);
};

/**
 * Update pick summary UI elements
 */
const updatePickSummary = (pickSummaryEl, pickProgressEl) => {
  if (!pickSummaryEl || !pickProgressEl) return;
  const groupMatches = matches.filter((match) => match.round === "group_stage");
  const total = groupMatches.length;
  const picked = groupMatches.filter((match) => picks[match.id]).length;
  const missing = Math.max(total - picked, 0);
  const percent = total === 0 ? 0 : Math.round((picked / total) * 100);

  pickSummaryEl.textContent = `Missing picks: ${missing} of ${total}`;
  pickProgressEl.style.width = `${percent}%`;
};

/**
 * Build standings from matches and picks
 */
const buildStandings = () => {
  const groupMatches = matches.filter((match) => match.round === "group_stage");
  const groups = {};

  teams.forEach((team) => {
    if (!team.group_letter) return;
    groups[team.group_letter] = groups[team.group_letter] || {};
    groups[team.group_letter][team.id] = {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
    };
  });

  groupMatches.forEach((match) => {
    const group = match.group_letter;
    if (!group || !groups[group]) return;
    const home = groups[group][match.home_team_id];
    const away = groups[group][match.away_team_id];
    if (!home || !away) return;
    const pick = picks[match.id];
    const score = getPickScore(pick);
    if (!score) return;

    home.played += 1;
    away.played += 1;
    home.gf += score.home;
    home.ga += score.away;
    away.gf += score.away;
    away.ga += score.home;

    if (score.home > score.away) {
      home.points += 3;
      home.won += 1;
      away.lost += 1;
    } else if (score.home < score.away) {
      away.points += 3;
      away.won += 1;
      home.lost += 1;
    } else {
      home.points += 1;
      away.points += 1;
      home.drawn += 1;
      away.drawn += 1;
    }
  });

  Object.values(groups).forEach((group) => {
    Object.values(group).forEach((row) => {
      row.gd = row.gf - row.ga;
    });
  });

  return groups;
};

/**
 * Get sorted rows for a group with tiebreaker logic
 */
const getSortedRows = (group, groupLetter) =>
  Object.values(group).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    const tieKey = `${a.points}-${a.gd}`;
    const order = picks?.standingsOrder?.[groupLetter]?.[tieKey] || [];
    const orderMap = new Map(order.map((id, index) => [id, index]));
    const aOrder = orderMap.get(a.team.id);
    const bOrder = orderMap.get(b.team.id);
    if (typeof aOrder === "number" && typeof bOrder === "number") {
      return aOrder - bOrder;
    }
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.team.name.localeCompare(b.team.name);
  });

/**
 * Build knockout bracket from groups and picks
 */
const buildKnockoutBracket = (groups) => {
  const groupLetters = Object.keys(groups).sort();
  const groupRows = groupLetters.map((letter) => ({
    letter,
    rows: getSortedRows(groups[letter], letter),
  }));

  const topThirds = groupRows
    .map((group) => ({ group: group.letter, ...group.rows[2] }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.team.name.localeCompare(b.team.name);
    })
    .slice(0, 8);

  // Apply stored third place order
  const storedOrder = picks.thirdPlaceOrder || [];
  const rowsById = new Map(topThirds.map((row) => [row.team.id, row]));
  const defaultOrder = topThirds.map((row) => row.team.id);
  const normalizedOrder = storedOrder
    .filter((id) => rowsById.has(id))
    .concat(defaultOrder.filter((id) => !storedOrder.includes(id)))
    .slice(0, 8);

  const orderedTopThirds = normalizedOrder.map((id) => rowsById.get(id)).filter(Boolean);

  const firstSeeds = groupRows.map((group) => ({ seed: `${group.letter}1`, ...group.rows[0] }));
  const secondSeeds = groupRows.map((group) => ({ seed: `${group.letter}2`, ...group.rows[1] }));
  const thirdSeeds = orderedTopThirds.map((row) => ({ seed: `${row.group}3`, ...row }));
  const qualified = [...firstSeeds, ...secondSeeds, ...thirdSeeds];

  const pickWinner = (home, away, matchKey) => {
    if (!home && !away) return null;
    if (home && !away) return home;
    if (away && !home) return away;
    const pickId = picks?.knockout?.[matchKey];
    if (pickId === home.team.id) return home;
    if (pickId === away.team.id) return away;
    return null;
  };

  const buildRound = (roundTeams, roundKey) => {
    const roundMatches = [];
    const winners = [];
    for (let i = 0; i < roundTeams.length; i += 2) {
      const home = roundTeams[i] || null;
      const away = roundTeams[i + 1] || null;
      const matchKey = `${roundKey}-${i / 2 + 1}`;
      const winner = pickWinner(home, away, matchKey);
      roundMatches.push({ home, away, winner, key: matchKey });
      winners.push(winner);
    }
    return { matches: roundMatches, winners };
  };

  const roundOf32 = buildRound(qualified, "round32");
  const roundOf16 = buildRound(roundOf32.winners, "round16");
  const quarterfinals = buildRound(roundOf16.winners, "quarters");
  const semifinals = buildRound(quarterfinals.winners, "semis");
  const finalMatch = buildRound(semifinals.winners, "final");
  const thirdPlaceTeams = semifinals.matches.map((match) => {
    if (!match.home || !match.away || !match.winner) return null;
    return match.home === match.winner ? match.away : match.home;
  });
  const thirdPlace = buildRound(thirdPlaceTeams, "third");

  return {
    roundOf32: roundOf32.matches,
    roundOf16: roundOf16.matches,
    quarterfinals: quarterfinals.matches,
    semifinals: semifinals.matches,
    final: finalMatch.matches,
    thirdPlace: thirdPlace.matches,
  };
};

/**
 * Create pick controls for a match (group stage)
 */
const createPickControls = (match, pickGroupEl, variant = "pill", onChangeCallback) => {
  const options = [
    { value: "H", label: "Home" },
    { value: "D", label: "Draw" },
    { value: "A", label: "Away" },
  ];

  const pillClass =
    variant === "grid"
      ? "flex w-full items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 transition peer-checked:border-slate-900 peer-checked:bg-slate-900 peer-checked:text-white"
      : "inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500 transition peer-checked:border-slate-900 peer-checked:bg-slate-900 peer-checked:text-white";

  options.forEach((option) => {
    const label = document.createElement("label");
    label.className = variant === "grid" ? "cursor-pointer block" : "cursor-pointer";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = `pick-${match.id}`;
    input.value = option.value;
    input.className = "peer sr-only";
    if (picks[match.id] === option.value) {
      input.checked = true;
    }

    input.addEventListener("change", () => {
      if (input.checked) {
        picks[match.id] = option.value;
        persistPicks();
        if (onChangeCallback) onChangeCallback();
      }
    });

    const pill = document.createElement("span");
    pill.className = pillClass;
    pill.textContent = option.label;

    label.appendChild(input);
    label.appendChild(pill);
    pickGroupEl.appendChild(label);
  });
};

/**
 * Get team abbreviation for display
 */
const getTeamAbbr = (team) => {
  if (!team) return "TBD";
  return team.country_code === "TBD" ? team.name : team.country_code;
};

/**
 * Load all data and initialize global state
 */
const API_BASE_URL = "http://localhost:8000";

const loadData = async () => {
  const [matchesData, teamsData, stadiumsData] = await Promise.all([
    fetchJson(`${API_BASE_URL}/api/matches`),
    fetchJson(`${API_BASE_URL}/api/teams`),
    fetchJson(`${API_BASE_URL}/api/stadiums`),
  ]);

  matches = matchesData;
  teams = teamsData;
  stadiums = stadiumsData;

  // Build lookup maps
  teamsById = new Map(teams.map((t) => [t.id, t]));
  stadiumsById = new Map(stadiums.map((s) => [s.id, s]));

  // Load picks from URL hash
  picks = normalizePicks(loadPicksFromHash());

  return { matches, teams, stadiums, picks };
};

// Export for use in page-specific scripts (using global scope)
window.WorldCupPool = {
  // Data
  get matches() { return matches; },
  get teams() { return teams; },
  get stadiums() { return stadiums; },
  get picks() { return picks; },
  get teamsById() { return teamsById; },
  get stadiumsById() { return stadiumsById; },
  get thirdPlaceDragSourceId() { return thirdPlaceDragSourceId; },
  set thirdPlaceDragSourceId(val) { thirdPlaceDragSourceId = val; },
  get cachedThirdPlaceGroups() { return cachedThirdPlaceGroups; },
  set cachedThirdPlaceGroups(val) { cachedThirdPlaceGroups = val; },

  // Functions
  loadData,
  fetchJson,
  formatDate,
  toBase64Url,
  fromBase64Url,
  encodePicks,
  decodePicks,
  getPickScore,
  normalizePicks,
  loadPicksFromHash,
  persistPicks,
  updatePickSummary,
  buildStandings,
  getSortedRows,
  buildKnockoutBracket,
  createPickControls,
  getTeamAbbr,
};
