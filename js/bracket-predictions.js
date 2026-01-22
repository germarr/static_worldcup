/**
 * World Cup 2026 - Bracket Predictions
 * Calculates head-to-head win probabilities from Kalshi prediction market data
 */

const API_BASE_URL = "https://aps.misquinielasonline.com";

// DOM Elements
const statusText = document.getElementById("status-text");
const loadingSpinner = document.getElementById("loading-spinner");
const dataFreshness = document.getElementById("data-freshness");
const errorMessage = document.getElementById("error-message");
const groupsContainer = document.getElementById("groups-container");
const groupTemplate = document.getElementById("group-template");
const cardTemplate = document.getElementById("prediction-card-template");
const predictedStandingsContainer = document.getElementById("predicted-standings");
const predictedStandingsTemplate = document.getElementById("predicted-standings-template");
const predictedThirdsTable = document.getElementById("predicted-thirds-table");
const predictedKnockoutContainer = document.getElementById("predicted-knockout");
const predictedKnockoutTemplate = document.getElementById("predicted-knockout-template");
const predictedChampionEl = document.getElementById("predicted-champion");
const predictedThirdPlaceEl = document.getElementById("predicted-third-place");

/**
 * Calculate match probability from World Cup win probabilities
 * @param {number} teamAWcProb - Team A's WC win probability (percentage)
 * @param {number} teamBWcProb - Team B's WC win probability (percentage)
 * @param {number} k - Logistic steepness parameter (default 0.7)
 * @returns {Object} Match probabilities and calculation details
 */
function calculateMatchProbability(teamAWcProb, teamBWcProb, k = 0.7) {
  // Handle edge cases where one or both teams have 0 probability
  if (teamAWcProb <= 0 && teamBWcProb <= 0) {
    // Both teams have no data - return even split
    return {
      pAWin: 0.33,
      pDraw: 0.34,
      pBWin: 0.33,
      logRatio: 0,
      rawPA: 0.5,
      competitiveness: 1,
    };
  }

  if (teamAWcProb <= 0) {
    // Team A has no data - heavily favor Team B
    return {
      pAWin: 0.15,
      pDraw: 0.20,
      pBWin: 0.65,
      logRatio: -Infinity,
      rawPA: 0,
      competitiveness: 0,
    };
  }

  if (teamBWcProb <= 0) {
    // Team B has no data - heavily favor Team A
    return {
      pAWin: 0.65,
      pDraw: 0.20,
      pBWin: 0.15,
      logRatio: Infinity,
      rawPA: 1,
      competitiveness: 0,
    };
  }

  const logRatio = Math.log(teamAWcProb / teamBWcProb);
  const rawPA = 1 / (1 + Math.exp(-k * logRatio));
  const competitiveness = 1 - Math.abs(rawPA - 0.5) * 2;
  const pDraw = 0.26 * competitiveness;
  const pAWin = rawPA * (1 - pDraw);
  const pBWin = (1 - rawPA) * (1 - pDraw);

  return { pAWin, pDraw, pBWin, logRatio, rawPA, competitiveness };
}

/**
 * Get team probability with fallback for missing data
 * @param {Object} team - Team object
 * @param {Map} rankingsByName - Rankings indexed by team name
 * @returns {number} Team's WC win probability (percentage)
 */
function getTeamProbability(team, rankingsByName) {
  const ranking = rankingsByName.get(team?.name);
  return ranking?.probability > 0 ? ranking.probability : 0.1;
}

/**
 * Calculate expected points for a team across all group matches
 * @param {number} teamId - Team ID
 * @param {Array} matches - All matches
 * @param {Map} teamsById - Teams indexed by ID
 * @param {Map} rankingsByName - Rankings indexed by team name
 * @returns {Object} Expected points and match details
 */
function calculateExpectedPoints(teamId, matches, teamsById, rankingsByName) {
  const team = teamsById.get(teamId);
  if (!team) return { expectedPoints: 0, matches: [] };

  const teamMatches = matches.filter(
    m => m.round === "group_stage" && (m.home_team_id === teamId || m.away_team_id === teamId)
  );

  let totalExpectedPoints = 0;
  const matchDetails = [];

  teamMatches.forEach(match => {
    const isHome = match.home_team_id === teamId;
    const opponentId = isHome ? match.away_team_id : match.home_team_id;
    const opponent = teamsById.get(opponentId);

    const teamProb = getTeamProbability(team, rankingsByName);
    const opponentProb = getTeamProbability(opponent, rankingsByName);

    const probs = calculateMatchProbability(
      isHome ? teamProb : opponentProb,
      isHome ? opponentProb : teamProb
    );

    // Calculate expected points for this team
    const winProb = isHome ? probs.pAWin : probs.pBWin;
    const drawProb = probs.pDraw;

    const expectedPoints = 3 * winProb + 1 * drawProb;
    totalExpectedPoints += expectedPoints;

    matchDetails.push({
      match,
      opponent,
      isHome,
      winProb,
      drawProb,
      expectedPoints,
    });
  });

  return { expectedPoints: totalExpectedPoints, matches: matchDetails };
}

/**
 * Build predicted standings for all 12 groups
 * @param {Array} matches - All matches
 * @param {Map} teamsById - Teams indexed by ID
 * @param {Map} rankingsByName - Rankings indexed by team name
 * @returns {Object} Groups with sorted team standings
 */
function buildPredictedStandings(matches, teamsById, rankingsByName) {
  const groups = {};

  // Initialize groups with teams
  teamsById.forEach((team, teamId) => {
    if (!team.group_letter) return;
    if (!groups[team.group_letter]) {
      groups[team.group_letter] = [];
    }

    const { expectedPoints } = calculateExpectedPoints(teamId, matches, teamsById, rankingsByName);
    const hasKalshiData = rankingsByName.get(team.name)?.probability > 0;

    groups[team.group_letter].push({
      team,
      expectedPoints,
      hasKalshiData,
    });
  });

  // Sort each group by expected points, then alphabetically for ties
  Object.keys(groups).forEach(groupLetter => {
    groups[groupLetter].sort((a, b) => {
      if (Math.abs(b.expectedPoints - a.expectedPoints) > 0.01) {
        return b.expectedPoints - a.expectedPoints;
      }
      return a.team.name.localeCompare(b.team.name);
    });
  });

  return groups;
}

/**
 * Rank all 12 third-place teams and mark top 8
 * @param {Object} groups - Groups with sorted standings
 * @returns {Array} Ranked third-place teams
 */
function rankThirdPlaceTeams(groups) {
  const thirdPlaceTeams = [];

  Object.keys(groups).sort().forEach(groupLetter => {
    const groupTeams = groups[groupLetter];
    if (groupTeams.length >= 3) {
      const thirdPlace = groupTeams[2];
      thirdPlaceTeams.push({
        ...thirdPlace,
        group: groupLetter,
      });
    }
  });

  // Sort by expected points, then alphabetically
  thirdPlaceTeams.sort((a, b) => {
    if (Math.abs(b.expectedPoints - a.expectedPoints) > 0.01) {
      return b.expectedPoints - a.expectedPoints;
    }
    return a.team.name.localeCompare(b.team.name);
  });

  // Mark top 8 as advancing
  thirdPlaceTeams.forEach((team, index) => {
    team.advances = index < 8;
    team.rank = index + 1;
  });

  return thirdPlaceTeams;
}

/**
 * Calculate knockout match probability (no draws)
 * @param {number} teamAWcProb - Team A's WC win probability
 * @param {number} teamBWcProb - Team B's WC win probability
 * @returns {Object} Knockout probabilities
 */
function calculateKnockoutProbability(teamAWcProb, teamBWcProb) {
  // Handle edge case where both teams have 0 probability
  if (teamAWcProb <= 0 && teamBWcProb <= 0) {
    return { pAWin: 0.5, pBWin: 0.5 };
  }

  const total = teamAWcProb + teamBWcProb;
  return {
    pAWin: teamAWcProb / total,
    pBWin: teamBWcProb / total,
  };
}

/**
 * Build predicted knockout bracket
 * @param {Object} groups - Groups with sorted standings
 * @param {Array} rankedThirds - Ranked third-place teams
 * @param {Map} rankingsByName - Rankings indexed by team name
 * @returns {Object} Complete bracket with predictions
 */
function buildPredictedKnockoutBracket(groups, rankedThirds, rankingsByName) {
  const groupLetters = Object.keys(groups).sort();

  // Get qualified teams
  const firstPlaceTeams = groupLetters.map(letter => ({
    seed: `${letter}1`,
    ...groups[letter][0],
  }));

  const secondPlaceTeams = groupLetters.map(letter => ({
    seed: `${letter}2`,
    ...groups[letter][1],
  }));

  const thirdPlaceTeams = rankedThirds.filter(t => t.advances).map(t => ({
    seed: `${t.group}3`,
    ...t,
  }));

  // Build Round of 32 matchups (first vs thirds, seconds vs seconds pattern)
  // This is a simplified bracket - real FIFA uses specific matchups
  const r32Teams = [...firstPlaceTeams, ...secondPlaceTeams, ...thirdPlaceTeams];

  const buildRound = (teams, roundName) => {
    const matches = [];
    const winners = [];

    for (let i = 0; i < teams.length; i += 2) {
      const teamA = teams[i] || null;
      const teamB = teams[i + 1] || null;

      if (!teamA || !teamB) {
        const winner = teamA || teamB;
        matches.push({
          label: `${roundName} #${matches.length + 1}`,
          teamA,
          teamB,
          pAWin: teamA ? 1 : 0,
          pBWin: teamB ? 1 : 0,
          winner,
        });
        winners.push(winner);
        continue;
      }

      const probA = getTeamProbability(teamA.team, rankingsByName);
      const probB = getTeamProbability(teamB.team, rankingsByName);
      const { pAWin, pBWin } = calculateKnockoutProbability(probA, probB);

      const winner = pAWin >= pBWin ? teamA : teamB;

      matches.push({
        label: `${roundName} #${matches.length + 1}`,
        teamA,
        teamB,
        pAWin,
        pBWin,
        winner,
      });

      winners.push(winner);
    }

    return { matches, winners };
  };

  const roundOf32 = buildRound(r32Teams, "R32");
  const roundOf16 = buildRound(roundOf32.winners, "R16");
  const quarterfinals = buildRound(roundOf16.winners, "QF");
  const semifinals = buildRound(quarterfinals.winners, "SF");
  const finalMatch = buildRound(semifinals.winners, "Final");

  // Build third place match from semifinal losers
  const semifinalLosers = semifinals.matches.map(match => {
    if (!match.teamA || !match.teamB || !match.winner) return null;
    return match.winner === match.teamA ? match.teamB : match.teamA;
  }).filter(Boolean);
  const thirdPlaceMatch = buildRound(semifinalLosers, "3rd Place");

  return {
    roundOf32: roundOf32.matches,
    roundOf16: roundOf16.matches,
    quarterfinals: quarterfinals.matches,
    semifinals: semifinals.matches,
    thirdPlace: thirdPlaceMatch.matches,
    final: finalMatch.matches,
    champion: finalMatch.matches[0]?.winner || null,
    thirdPlaceWinner: thirdPlaceMatch.matches[0]?.winner || null,
  };
}

/**
 * Fetch JSON from API
 * @param {string} endpoint - API endpoint path
 * @returns {Promise<Object>} Parsed JSON response
 */
async function fetchJson(endpoint) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Format date for display
 * @param {string} isoString - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(isoString) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/**
 * Format timestamp for data freshness
 * @param {string} isoString - ISO date string
 * @returns {string} Formatted timestamp
 */
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

/**
 * Get short team name (for narrow displays)
 * @param {string} name - Full team name
 * @returns {string} Abbreviated name
 */
function getShortName(name) {
  if (!name) return "TBD";
  // Handle common cases
  const shortNames = {
    "South Korea": "KOR",
    "South Africa": "RSA",
    "Costa Rica": "CRC",
    "Saudi Arabia": "KSA",
    "United States": "USA",
    "New Zealand": "NZL",
  };
  if (shortNames[name]) return shortNames[name];
  // Return first 3 letters uppercase for others
  return name.substring(0, 3).toUpperCase();
}

/**
 * Format percentage for display
 * @param {number} value - Decimal probability (0-1)
 * @returns {string} Formatted percentage
 */
function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format number for calculation display
 * @param {number} value - Number to format
 * @returns {string} Formatted number
 */
function formatCalcValue(value) {
  if (!isFinite(value)) return value > 0 ? "+Inf" : "-Inf";
  return value.toFixed(3);
}

/**
 * Create a prediction card from the template
 * @param {Object} match - Match data
 * @param {Object} homeTeam - Home team data
 * @param {Object} awayTeam - Away team data
 * @param {Object} stadium - Stadium data
 * @param {number} homeWcProb - Home team WC win probability
 * @param {number} awayWcProb - Away team WC win probability
 * @returns {HTMLElement} Card element
 */
function createPredictionCard(match, homeTeam, awayTeam, stadium, homeWcProb, awayWcProb) {
  const card = cardTemplate.content.cloneNode(true);

  // Calculate match probabilities
  const probs = calculateMatchProbability(homeWcProb, awayWcProb);

  // Header
  card.querySelector('[data-role="match-number"]').textContent = `Match ${match.match_number}`;
  card.querySelector('[data-role="match-date"]').textContent = formatDate(match.scheduled_datetime);

  // Teams
  card.querySelector('[data-role="home-flag"]').src = homeTeam?.flag_emoji || "";
  card.querySelector('[data-role="home-flag"]').alt = homeTeam?.name || "TBD";
  card.querySelector('[data-role="home-name"]').textContent = homeTeam?.name || "TBD";

  card.querySelector('[data-role="away-flag"]').src = awayTeam?.flag_emoji || "";
  card.querySelector('[data-role="away-flag"]').alt = awayTeam?.name || "TBD";
  card.querySelector('[data-role="away-name"]').textContent = awayTeam?.name || "TBD";

  // WC Probabilities
  const homeWcDisplay = homeWcProb != null ? `${homeWcProb}%` : "N/A";
  const awayWcDisplay = awayWcProb != null ? `${awayWcProb}%` : "N/A";
  card.querySelector('[data-role="home-wc-prob"]').textContent = homeWcDisplay;
  card.querySelector('[data-role="away-wc-prob"]').textContent = awayWcDisplay;

  // Match outcome bars
  const homeWinBar = card.querySelector('[data-role="home-win-bar"]');
  const drawBar = card.querySelector('[data-role="draw-bar"]');
  const awayWinBar = card.querySelector('[data-role="away-win-bar"]');

  homeWinBar.style.width = `${probs.pAWin * 100}%`;
  homeWinBar.textContent = formatPercent(probs.pAWin);

  drawBar.style.width = `${probs.pDraw * 100}%`;
  drawBar.textContent = formatPercent(probs.pDraw);

  awayWinBar.style.width = `${probs.pBWin * 100}%`;
  awayWinBar.textContent = formatPercent(probs.pBWin);

  // Short names for labels
  card.querySelector('[data-role="home-short"]').textContent = getShortName(homeTeam?.name);
  card.querySelector('[data-role="away-short"]').textContent = getShortName(awayTeam?.name);

  // Calculation breakdown
  card.querySelector('[data-role="log-ratio"]').textContent = formatCalcValue(probs.logRatio);
  card.querySelector('[data-role="raw-pa"]').textContent = formatCalcValue(probs.rawPA);
  card.querySelector('[data-role="competitiveness"]').textContent = formatCalcValue(probs.competitiveness);
  card.querySelector('[data-role="p-draw"]').textContent = formatPercent(probs.pDraw);
  card.querySelector('[data-role="p-home-win"]').textContent = formatPercent(probs.pAWin);
  card.querySelector('[data-role="p-away-win"]').textContent = formatPercent(probs.pBWin);

  // Venue
  if (stadium) {
    card.querySelector('[data-role="stadium"]').textContent = stadium.name;
    card.querySelector('[data-role="location"]').textContent = `${stadium.city}, ${stadium.country}`;
  } else {
    card.querySelector('[data-role="stadium"]').textContent = "TBD";
    card.querySelector('[data-role="location"]').textContent = "";
  }

  return card;
}

/**
 * Render all groups with their match cards
 * @param {Array} matches - All matches
 * @param {Map} teamsById - Teams indexed by ID
 * @param {Map} stadiumsById - Stadiums indexed by ID
 * @param {Map} rankingsByName - Rankings indexed by team name
 */
function renderGroups(matches, teamsById, stadiumsById, rankingsByName) {
  // Filter to group stage matches only
  const groupMatches = matches.filter(m => m.round === "group_stage");

  // Group matches by group_letter
  const matchesByGroup = new Map();
  groupMatches.forEach(match => {
    const group = match.group_letter;
    if (!matchesByGroup.has(group)) {
      matchesByGroup.set(group, []);
    }
    matchesByGroup.get(group).push(match);
  });

  // Sort groups alphabetically
  const sortedGroups = [...matchesByGroup.keys()].sort();

  // Clear container
  groupsContainer.innerHTML = "";

  // Render each group
  sortedGroups.forEach(groupLetter => {
    const groupMatches = matchesByGroup.get(groupLetter);
    // Sort matches by match number
    groupMatches.sort((a, b) => a.match_number - b.match_number);

    // Clone group template
    const groupSection = groupTemplate.content.cloneNode(true);
    groupSection.querySelector("h2").textContent = `Group ${groupLetter}`;
    groupSection.querySelector("span").textContent = `${groupMatches.length} matches`;

    const cardsContainer = groupSection.querySelector('[data-role="cards-container"]');

    // Create cards for each match
    groupMatches.forEach(match => {
      const homeTeam = teamsById.get(match.home_team_id);
      const awayTeam = teamsById.get(match.away_team_id);
      const stadium = stadiumsById.get(match.stadium_id);

      // Get WC probabilities from rankings
      const homeRanking = rankingsByName.get(homeTeam?.name);
      const awayRanking = rankingsByName.get(awayTeam?.name);

      const homeWcProb = homeRanking?.probability ?? null;
      const awayWcProb = awayRanking?.probability ?? null;

      const card = createPredictionCard(match, homeTeam, awayTeam, stadium, homeWcProb, awayWcProb);
      cardsContainer.appendChild(card);
    });

    groupsContainer.appendChild(groupSection);
  });
}

/**
 * Render predicted group standings
 * @param {Object} groups - Groups with sorted standings
 */
function renderPredictedStandings(groups) {
  predictedStandingsContainer.innerHTML = "";
  const groupLetters = Object.keys(groups).sort();

  groupLetters.forEach(groupLetter => {
    const card = predictedStandingsTemplate.content.cloneNode(true);
    card.querySelector('[data-role="group-title"]').textContent = `Group ${groupLetter}`;

    const tbody = card.querySelector('[data-role="standings-body"]');
    const teamRows = groups[groupLetter];

    teamRows.forEach((row, index) => {
      const tr = document.createElement("tr");

      // Position highlighting
      if (index < 2) {
        tr.className = "bg-emerald-50/60";
      } else if (index === 2) {
        tr.className = "bg-amber-50/60";
      }

      // Team cell
      const teamCell = document.createElement("td");
      teamCell.className = "px-3 py-2 font-medium";
      const hasDataMarker = row.hasKalshiData ? "" : '<span class="text-amber-500" title="No Kalshi data - using 0.1% baseline">*</span>';
      teamCell.innerHTML = `
        <div class="flex items-center gap-2">
          <img class="h-4 w-6 rounded-sm border border-slate-200 object-cover" src="${row.team.flag_emoji || ""}" alt="${row.team.name} flag" />
          <span>${row.team.name}</span>
          ${hasDataMarker}
        </div>
      `;

      // Expected points cell
      const ptsCell = document.createElement("td");
      ptsCell.className = "px-3 py-2 text-center font-semibold text-slate-900";
      ptsCell.textContent = row.expectedPoints.toFixed(2);

      tr.appendChild(teamCell);
      tr.appendChild(ptsCell);
      tbody.appendChild(tr);
    });

    predictedStandingsContainer.appendChild(card);
  });
}

/**
 * Render third-place rankings table
 * @param {Array} rankedThirds - Ranked third-place teams
 */
function renderPredictedThirds(rankedThirds) {
  predictedThirdsTable.innerHTML = "";

  rankedThirds.forEach(row => {
    const tr = document.createElement("tr");

    // Highlight top 8
    if (row.advances) {
      tr.className = "bg-emerald-50/60";
    }

    // Rank cell
    const rankCell = document.createElement("td");
    rankCell.className = "px-3 py-2 text-center font-semibold";
    rankCell.textContent = row.rank;

    // Team cell
    const teamCell = document.createElement("td");
    teamCell.className = "px-3 py-2 font-medium";
    const hasDataMarker = row.hasKalshiData ? "" : '<span class="text-amber-500" title="No Kalshi data">*</span>';
    teamCell.innerHTML = `
      <div class="flex items-center gap-2">
        <img class="h-4 w-6 rounded-sm border border-slate-200 object-cover" src="${row.team.flag_emoji || ""}" alt="${row.team.name} flag" />
        <span>${row.team.name}</span>
        ${hasDataMarker}
      </div>
    `;

    // Group cell
    const groupCell = document.createElement("td");
    groupCell.className = "px-3 py-2 text-center";
    groupCell.textContent = row.group;

    // Expected points cell
    const ptsCell = document.createElement("td");
    ptsCell.className = "px-3 py-2 text-center font-semibold";
    ptsCell.textContent = row.expectedPoints.toFixed(2);

    // Status cell
    const statusCell = document.createElement("td");
    statusCell.className = "px-3 py-2 text-center";
    if (row.advances) {
      statusCell.innerHTML = '<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-700">Advances</span>';
    } else {
      statusCell.innerHTML = '<span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Eliminated</span>';
    }

    tr.appendChild(rankCell);
    tr.appendChild(teamCell);
    tr.appendChild(groupCell);
    tr.appendChild(ptsCell);
    tr.appendChild(statusCell);
    predictedThirdsTable.appendChild(tr);
  });
}

/**
 * Render predicted knockout bracket
 * @param {Object} bracket - Complete bracket with predictions
 * @param {Map} rankingsByName - Rankings indexed by team name
 */
function renderPredictedKnockout(bracket, rankingsByName) {
  predictedKnockoutContainer.innerHTML = "";

  const rounds = [
    { key: "roundOf32", title: "Round of 32", matches: bracket.roundOf32 },
    { key: "roundOf16", title: "Round of 16", matches: bracket.roundOf16 },
    { key: "quarterfinals", title: "Quarterfinals", matches: bracket.quarterfinals },
    { key: "semifinals", title: "Semifinals", matches: bracket.semifinals },
  ];

  // Helper to render a match card
  const renderMatchCard = (match) => {
    const card = predictedKnockoutTemplate.content.cloneNode(true);

    card.querySelector('[data-role="match-label"]').textContent = match.label;

    const homeRow = card.querySelector('[data-role="home-row"]');
    const awayRow = card.querySelector('[data-role="away-row"]');

    // Team A
    const teamA = match.teamA?.team;
    card.querySelector('[data-role="home-flag"]').src = teamA?.flag_emoji || "";
    card.querySelector('[data-role="home-flag"]').alt = teamA?.name || "TBD";
    card.querySelector('[data-role="home-name"]').textContent = teamA?.name || "TBD";
    card.querySelector('[data-role="home-prob"]').textContent = match.teamA ? formatPercent(match.pAWin) : "";

    // Team B
    const teamB = match.teamB?.team;
    card.querySelector('[data-role="away-flag"]').src = teamB?.flag_emoji || "";
    card.querySelector('[data-role="away-flag"]').alt = teamB?.name || "TBD";
    card.querySelector('[data-role="away-name"]').textContent = teamB?.name || "TBD";
    card.querySelector('[data-role="away-prob"]').textContent = match.teamB ? formatPercent(match.pBWin) : "";

    // Highlight winner
    if (match.winner && match.teamA && match.teamB) {
      if (match.winner === match.teamA) {
        homeRow.classList.add("bg-emerald-50", "border", "border-emerald-200");
      } else {
        awayRow.classList.add("bg-emerald-50", "border", "border-emerald-200");
      }
    }

    return card;
  };

  // Render R32 through Semifinals
  rounds.forEach(round => {
    const column = document.createElement("div");
    column.className = "space-y-3";

    // Header
    const header = document.createElement("div");
    header.className = "rounded-full bg-slate-100 px-3 py-1 text-center text-[11px] uppercase tracking-widest text-slate-500";
    header.textContent = round.title;
    column.appendChild(header);

    // Matches
    round.matches.forEach(match => {
      column.appendChild(renderMatchCard(match));
    });

    predictedKnockoutContainer.appendChild(column);
  });

  // Finals column (Third Place + Final)
  const finalsColumn = document.createElement("div");
  finalsColumn.className = "space-y-3";

  // Finals header
  const finalsHeader = document.createElement("div");
  finalsHeader.className = "rounded-full bg-slate-900 px-3 py-1 text-center text-[11px] uppercase tracking-widest text-white";
  finalsHeader.textContent = "Finals";
  finalsColumn.appendChild(finalsHeader);

  // Third Place match
  if (bracket.thirdPlace && bracket.thirdPlace.length > 0) {
    bracket.thirdPlace.forEach(match => {
      finalsColumn.appendChild(renderMatchCard(match));
    });
  }

  // Final match
  if (bracket.final && bracket.final.length > 0) {
    bracket.final.forEach(match => {
      finalsColumn.appendChild(renderMatchCard(match));
    });
  }

  predictedKnockoutContainer.appendChild(finalsColumn);
}

/**
 * Render predicted champion
 * @param {Object} champion - Champion team data
 * @param {Map} rankingsByName - Rankings indexed by team name
 */
function renderPredictedChampion(champion, rankingsByName) {
  if (!champion?.team) {
    predictedChampionEl.innerHTML = '<span class="text-sm text-emerald-600">Unable to determine champion</span>';
    return;
  }

  const team = champion.team;
  const prob = getTeamProbability(team, rankingsByName);

  predictedChampionEl.innerHTML = `
    <img class="h-12 w-18 rounded-md border-2 border-emerald-300 object-cover shadow-md" src="${team.flag_emoji || ""}" alt="${team.name} flag" />
    <div class="text-center">
      <div class="text-2xl font-bold text-emerald-900">${team.name}</div>
      <div class="text-sm text-emerald-700">World Cup Win Probability: ${prob}%</div>
    </div>
  `;
}

/**
 * Render predicted third place winner
 * @param {Object} thirdPlaceWinner - Third place team data
 * @param {Map} rankingsByName - Rankings indexed by team name
 */
function renderPredictedThirdPlace(thirdPlaceWinner, rankingsByName) {
  if (!thirdPlaceWinner?.team) {
    predictedThirdPlaceEl.innerHTML = '<span class="text-sm text-amber-600">Unable to determine third place</span>';
    return;
  }

  const team = thirdPlaceWinner.team;
  const prob = getTeamProbability(team, rankingsByName);

  predictedThirdPlaceEl.innerHTML = `
    <img class="h-10 w-15 rounded-md border-2 border-amber-300 object-cover shadow-md" src="${team.flag_emoji || ""}" alt="${team.name} flag" />
    <div class="text-center">
      <div class="text-xl font-bold text-amber-900">${team.name}</div>
      <div class="text-xs text-amber-700">WC Probability: ${prob}%</div>
    </div>
  `;
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  loadingSpinner.classList.add("hidden");
  statusText.textContent = "Failed to load predictions";
  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
}

/**
 * Initialize the page
 */
async function init() {
  try {
    // Fetch all data in parallel
    const [matchesData, teamsData, stadiumsData, rankingsData] = await Promise.all([
      fetchJson("/api/matches"),
      fetchJson("/api/teams"),
      fetchJson("/api/stadiums"),
      fetchJson("/api/metrics/rankings"),
    ]);

    // Create lookup maps
    const teamsById = new Map(teamsData.map(t => [t.id, t]));
    const stadiumsById = new Map(stadiumsData.map(s => [s.id, s]));
    const rankingsByName = new Map(rankingsData.rankings.map(r => [r.team_name, r]));

    // Count group stage matches
    const groupStageCount = matchesData.filter(m => m.round === "group_stage").length;
    const teamsWithRankings = rankingsData.rankings.length;

    // Render groups
    renderGroups(matchesData, teamsById, stadiumsById, rankingsByName);

    // Build and render predicted standings
    const predictedGroups = buildPredictedStandings(matchesData, teamsById, rankingsByName);
    renderPredictedStandings(predictedGroups);

    // Rank third-place teams and render
    const rankedThirds = rankThirdPlaceTeams(predictedGroups);
    renderPredictedThirds(rankedThirds);

    // Build and render knockout bracket
    const predictedBracket = buildPredictedKnockoutBracket(predictedGroups, rankedThirds, rankingsByName);
    renderPredictedKnockout(predictedBracket, rankingsByName);

    // Render predicted champion and third place
    renderPredictedChampion(predictedBracket.champion, rankingsByName);
    renderPredictedThirdPlace(predictedBracket.thirdPlaceWinner, rankingsByName);

    // Update status
    loadingSpinner.classList.add("hidden");
    statusText.textContent = `Loaded ${groupStageCount} group stage matches with ${teamsWithRankings} team rankings. Full tournament predictions generated.`;

    // Show data freshness
    if (rankingsData.as_of) {
      dataFreshness.textContent = `Rankings data as of: ${formatTimestamp(rankingsData.as_of)}`;
      dataFreshness.classList.remove("hidden");
    }

  } catch (error) {
    console.error("Failed to initialize bracket predictions:", error);
    showError(`Error: ${error.message}. Make sure the FastAPI server is running.`);
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", init);
