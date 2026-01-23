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
const encodePicks = async (picksData) => {
  const payload = JSON.stringify(picksData);
  const compressed = await Compression.compress(payload);
  return toBase64Url(compressed);
};

/**
 * Decode compressed Base64 string to picks object
 */
const decodePicks = async (encoded) => {
  const bytes = fromBase64Url(encoded);
  const json = await Compression.decompress(bytes);
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
const loadPicksFromHash = async () => {
  const hash = window.location.hash.replace(/^#/, "");
  console.log("- loadPicksFromHash: raw hash =", window.location.hash);
  console.log("- loadPicksFromHash: raw hash length =", window.location.hash.length);
  console.log("- loadPicksFromHash: stripped hash =", hash.substring(0, 50) + "...");
  if (!hash.startsWith("p=")) {
    console.log("- loadPicksFromHash: hash does not start with 'p=', returning empty");
    return {};
  }
  const encoded = hash.slice(2);
  console.log("- loadPicksFromHash: encoded data length =", encoded.length);
  if (!encoded) return {};
  try {
    const decoded = await decodePicks(encoded);
    console.log("- loadPicksFromHash: decoded picks keys =", Object.keys(decoded));
    console.log("- loadPicksFromHash: decoded knockout =", JSON.stringify(decoded.knockout || {}));
    console.log("- loadPicksFromHash: knockout keys count =", Object.keys(decoded.knockout || {}).length);
    return decoded;
  } catch (error) {
    console.error("Failed to decode picks:", error);
    console.error("- Error details:", error.message, error.stack);
    // DON'T clear URL hash - just return empty and let user try again
    console.log("- loadPicksFromHash: returning empty picks due to error (NOT clearing URL)");
    return {};
  }
};

/**
 * Persist picks to URL hash
 */
const metadataKeys = ["knockout", "thirdPlaceOrder", "standingsOrder"];

const persistPicks = async () => {
  const baseUrl = `${window.location.pathname}${window.location.search}`;
  const knockoutPicks = picks?.knockout || {};
  const groupPickKeys = Object.keys(picks || {}).filter((k) => !metadataKeys.includes(k));
  const hasGroupPicks = groupPickKeys.length > 0;
  const hasKnockoutPicks = Object.keys(knockoutPicks).length > 0;
  console.log("persistPicks: groupPicks =", hasGroupPicks, ", knockoutPicks =", hasKnockoutPicks);
  console.log("persistPicks: knockout object =", JSON.stringify(knockoutPicks));
  // Only persist if there are actual picks (thirdPlaceOrder and standingsOrder are derived metadata)
  const hasPicks = hasGroupPicks || hasKnockoutPicks;
  if (!hasPicks) {
    history.replaceState(null, "", baseUrl);
    updateNavLinks();
    return;
  }
  const encoded = await encodePicks(picks);
  console.log("persistPicks: saving to URL, encoded length =", encoded.length);
  history.replaceState(null, "", `${baseUrl}#p=${encoded}`);
  // Update nav links since replaceState doesn't trigger hashchange
  updateNavLinks();
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
    variant === "compact"
      ? "flex items-center justify-center w-8 h-8 rounded border border-slate-200 bg-white text-[10px] font-bold uppercase text-slate-500 transition peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-checked:text-white active:scale-95"
      : variant === "mobile"
        ? "flex w-full items-center justify-center rounded-lg border-2 border-slate-200 bg-white px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 transition peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-checked:text-white active:scale-95"
        : variant === "grid"
          ? "flex w-full items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 transition peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-checked:text-white"
          : "inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500 transition peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-checked:text-white";

  options.forEach((option) => {
    const label = document.createElement("label");
    label.className = variant === "grid" || variant === "mobile" || variant === "compact" ? "cursor-pointer block" : "cursor-pointer";

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
const API_BASE_URL = "https://aps.misquinielasonline.com";

const loadData = async () => {
  // Initialize compression (pre-load pako if native not supported)
  await Compression.initCompression();

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
  picks = normalizePicks(await loadPicksFromHash());

  return { matches, teams, stadiums, picks };
};

/**
 * Update navigation links to preserve the URL hash (picks)
 */
const updateNavLinks = () => {
  const hash = window.location.hash;
  if (!hash) return;

  // Update all navigation links and results buttons to preserve the hash
  const links = document.querySelectorAll('nav a[href$=".html"], a#view-results-btn, nav a[href*=".html#"]');
  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (href) {
      // Remove any existing hash and add the current one
      const baseHref = href.split("#")[0];
      link.setAttribute("href", baseHref + hash);
    }
  });
};

// Update nav links when hash changes
window.addEventListener("hashchange", updateNavLinks);

// Update nav links on DOM ready
document.addEventListener("DOMContentLoaded", updateNavLinks);


// --- Team Pool Utilities ---

/**
 * Get stored member token for a team
 */
const getTeamMemberToken = (teamCode) => {
  return localStorage.getItem(`team_${teamCode}_token`);
};

/**
 * Store member token for a team
 */
const setTeamMemberToken = (teamCode, token) => {
  localStorage.setItem(`team_${teamCode}_token`, token);
};

/**
 * Get stored creator token for a team
 */
const getTeamCreatorToken = (teamCode) => {
  return localStorage.getItem(`team_${teamCode}_creator`);
};

/**
 * Store creator token for a team
 */
const setTeamCreatorToken = (teamCode, token) => {
  localStorage.setItem(`team_${teamCode}_creator`, token);
};

/**
 * Get list of teams user has joined
 * Returns array of { code, name, displayName, isCreator }
 */
const getMyTeams = () => {
  try {
    return JSON.parse(localStorage.getItem('myTeams') || '[]');
  } catch {
    return [];
  }
};

/**
 * Add a team to user's team list
 */
const addToMyTeams = (teamCode, teamName, displayName, isCreator = false) => {
  const teams = getMyTeams();
  // Check if already exists
  const existing = teams.find(t => t.code === teamCode);
  if (existing) {
    existing.name = teamName;
    existing.displayName = displayName;
    existing.isCreator = existing.isCreator || isCreator;
  } else {
    teams.push({ code: teamCode, name: teamName, displayName, isCreator });
  }
  localStorage.setItem('myTeams', JSON.stringify(teams));
};

/**
 * Remove a team from user's team list
 */
const removeFromMyTeams = (teamCode) => {
  const teams = getMyTeams().filter(t => t.code !== teamCode);
  localStorage.setItem('myTeams', JSON.stringify(teams));
  // Also clean up tokens
  localStorage.removeItem(`team_${teamCode}_token`);
  localStorage.removeItem(`team_${teamCode}_creator`);
};

/**
 * Get current bracket data as encoded string for team submission
 */
const getCurrentBracketData = async () => {
  return await encodePicks(picks);
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

  // Constants
  API_BASE_URL,

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
  updateNavLinks,

  // Team utilities
  getTeamMemberToken,
  setTeamMemberToken,
  getTeamCreatorToken,
  setTeamCreatorToken,
  getMyTeams,
  addToMyTeams,
  removeFromMyTeams,
  getCurrentBracketData,
};
