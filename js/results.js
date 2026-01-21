/**
 * World Cup 2026 Pool - Results Page
 * Displays actual match results against user predictions with scoring
 */

const WCP = window.WorldCupPool;

// Round key mapping for knockout matches
const roundKeyMap = {
  knockout_stage_roundof32: "round32",
  knockout_stage_roundof16: "round16",
  knockout_stage_quarterfinal: "quarters",
  knockout_stage_semifinal: "semis",
  knockout_stage_thirdplace: "third",
  knockout_stage_final: "final",
};

const roundDisplayNames = {
  round32: "R32",
  round16: "R16",
  quarters: "QF",
  semis: "SF",
  third: "3rd",
  final: "Final",
};

// Current filter state
let currentFilter = "all";

/**
 * Get actual result from match scores
 * Returns "H" for home win, "A" for away win, "D" for draw, null if not completed
 */
const getActualResult = (match) => {
  if (match.status !== "completed") return null;
  if (match.actual_home_score === null || match.actual_away_score === null) return null;

  if (match.actual_home_score > match.actual_away_score) return "H";
  if (match.actual_home_score < match.actual_away_score) return "A";
  return "D";
};

/**
 * Get user pick for a match (handles both string and number keys)
 */
const getUserPick = (picks, matchId) => {
  // Try both number and string keys since JSON parsing may convert keys
  return picks[matchId] || picks[String(matchId)];
};

/**
 * Check if group stage prediction is correct
 */
const isGroupPredictionCorrect = (match, picks) => {
  const actualResult = getActualResult(match);
  if (actualResult === null) return null; // Not completed
  const userPick = getUserPick(picks, match.id);
  if (!userPick) return false; // No pick made
  return userPick === actualResult;
};

/**
 * Get knockout match key for picks lookup
 */
const getKnockoutMatchKey = (match, knockoutMatchesByRound) => {
  const roundKey = roundKeyMap[match.round];
  if (!roundKey) return null;

  const roundMatches = knockoutMatchesByRound[match.round] || [];
  const sortedMatches = [...roundMatches].sort((a, b) => a.match_number - b.match_number);
  const matchIndex = sortedMatches.findIndex((m) => m.id === match.id);

  if (matchIndex === -1) return null;
  return `${roundKey}-${matchIndex + 1}`;
};

/**
 * Check if knockout prediction is correct
 */
const isKnockoutPredictionCorrect = (match, picks, matchKey) => {
  if (match.status !== "completed") return null;
  if (!match.actual_winner_team_id) return null;

  const userPick = picks?.knockout?.[matchKey];
  if (!userPick) return false;

  return userPick === match.actual_winner_team_id;
};

/**
 * Calculate all scores from matches and picks
 */
const calculateScores = (matches, picks) => {
  const groupMatches = matches.filter((m) => m.round === "group_stage");
  const knockoutMatches = matches.filter((m) => m.round !== "group_stage");

  // Group knockout matches by round for key calculation
  const knockoutMatchesByRound = {};
  knockoutMatches.forEach((m) => {
    if (!knockoutMatchesByRound[m.round]) knockoutMatchesByRound[m.round] = [];
    knockoutMatchesByRound[m.round].push(m);
  });

  let groupPoints = 0;
  let groupCorrect = 0;
  let groupCompleted = 0;

  let knockoutPoints = 0;
  let knockoutCorrect = 0;
  let knockoutCompleted = 0;

  // Calculate group stage scores
  groupMatches.forEach((match) => {
    if (match.status === "completed") {
      groupCompleted++;
      const isCorrect = isGroupPredictionCorrect(match, picks);
      if (isCorrect) {
        groupPoints += 1;
        groupCorrect++;
      }
    }
  });

  // Calculate knockout scores
  knockoutMatches.forEach((match) => {
    if (match.status === "completed" && match.actual_winner_team_id) {
      knockoutCompleted++;
      const matchKey = getKnockoutMatchKey(match, knockoutMatchesByRound);
      const isCorrect = isKnockoutPredictionCorrect(match, picks, matchKey);
      if (isCorrect) {
        knockoutPoints += 2;
        knockoutCorrect++;
      }
    }
  });

  const totalPoints = groupPoints + knockoutPoints;
  const totalCompleted = groupCompleted + knockoutCompleted;
  const totalCorrect = groupCorrect + knockoutCorrect;
  const accuracy = totalCompleted > 0 ? Math.round((totalCorrect / totalCompleted) * 100) : 0;

  // Max possible points from completed matches
  const maxGroupPoints = groupCompleted;
  const maxKnockoutPoints = knockoutCompleted * 2;
  const maxTotalPoints = maxGroupPoints + maxKnockoutPoints;

  return {
    totalPoints,
    maxTotalPoints,
    groupPoints,
    groupCorrect,
    groupCompleted,
    groupTotal: groupMatches.length,
    knockoutPoints,
    knockoutCorrect,
    knockoutCompleted,
    knockoutTotal: knockoutMatches.length,
    accuracy,
    totalCompleted,
    totalCorrect,
  };
};

/**
 * Update score cards UI
 */
const updateScoreCards = (scores) => {
  document.getElementById("total-points").textContent = scores.totalPoints;
  document.getElementById("total-max").textContent = `of ${scores.maxTotalPoints} possible`;

  document.getElementById("group-points").textContent = scores.groupPoints;
  document.getElementById("group-correct").textContent = `${scores.groupCorrect}/${scores.groupCompleted} correct`;

  document.getElementById("knockout-points").textContent = scores.knockoutPoints;
  document.getElementById("knockout-correct").textContent = `${scores.knockoutCorrect}/${scores.knockoutCompleted} correct`;

  document.getElementById("accuracy").textContent = `${scores.accuracy}%`;
  document.getElementById("accuracy-detail").textContent = `${scores.totalCorrect}/${scores.totalCompleted} completed`;
};

/**
 * Get result display text
 */
const getResultDisplay = (match) => {
  if (match.status !== "completed") return "—";
  return `${match.actual_home_score}-${match.actual_away_score}`;
};

/**
 * Get pick display text
 */
const getPickDisplay = (pick) => {
  if (!pick) return "—";
  if (pick === "H") return "Home";
  if (pick === "A") return "Away";
  if (pick === "D") return "Draw";
  return pick;
};

/**
 * Get match status for filtering
 */
const getMatchStatus = (match, isCorrect) => {
  if (match.status !== "completed") return "pending";
  return isCorrect ? "correct" : "incorrect";
};

/**
 * Render group stage results
 */
const renderGroupResults = (matches, picks, teamsById) => {
  const container = document.getElementById("group-results");
  const template = document.getElementById("group-result-template");

  const groupMatches = matches.filter((m) => m.round === "group_stage");
  const groups = {};

  groupMatches.forEach((match) => {
    const letter = match.group_letter;
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(match);
  });

  container.innerHTML = "";

  Object.keys(groups)
    .sort()
    .forEach((letter) => {
      const groupMatchList = groups[letter].sort((a, b) => a.match_number - b.match_number);
      const card = template.content.cloneNode(true);

      let correctCount = 0;
      let completedCount = 0;

      const tbody = card.querySelector('[data-role="matches"]');

      groupMatchList.forEach((match) => {
        const homeTeam = teamsById.get(match.home_team_id);
        const awayTeam = teamsById.get(match.away_team_id);
        const isCorrect = isGroupPredictionCorrect(match, picks);
        const status = getMatchStatus(match, isCorrect);

        if (match.status === "completed") completedCount++;
        if (isCorrect === true) correctCount++;

        // Apply filter
        if (currentFilter !== "all" && status !== currentFilter) return;

        const tr = document.createElement("tr");

        // Row styling based on status
        if (status === "correct") {
          tr.className = "bg-emerald-50/60";
        } else if (status === "incorrect") {
          tr.className = "bg-rose-50/60";
        } else {
          tr.className = "bg-slate-50/30";
        }

        const homeAbbr = WCP.getTeamAbbr(homeTeam);
        const awayAbbr = WCP.getTeamAbbr(awayTeam);
        const resultDisplay = getResultDisplay(match);
        const pickDisplay = getPickDisplay(getUserPick(picks, match.id));
        const pointsDisplay = isCorrect === true ? "+1" : isCorrect === false ? "0" : "—";
        const pointsClass = isCorrect === true ? "text-emerald-600 font-semibold" : isCorrect === false ? "text-rose-600" : "text-slate-400";

        tr.innerHTML = `
          <td class="px-2 py-2">
            <span class="font-medium">${homeAbbr}</span>
            <span class="text-slate-400">vs</span>
            <span class="font-medium">${awayAbbr}</span>
          </td>
          <td class="px-2 py-2 text-center font-medium">${resultDisplay}</td>
          <td class="px-2 py-2 text-center">${pickDisplay}</td>
          <td class="px-2 py-2 text-center ${pointsClass}">${pointsDisplay}</td>
        `;

        tbody.appendChild(tr);
      });

      card.querySelector('[data-role="group-title"]').textContent = `Group ${letter}`;
      card.querySelector('[data-role="group-score"]').textContent = `${correctCount}/${completedCount}`;

      container.appendChild(card);
    });
};

/**
 * Render knockout stage results
 */
const renderKnockoutResults = (matches, picks, teamsById) => {
  const container = document.getElementById("knockout-results");
  const template = document.getElementById("knockout-result-template");

  const knockoutMatches = matches.filter((m) => m.round !== "group_stage");

  // Group by round
  const knockoutMatchesByRound = {};
  knockoutMatches.forEach((m) => {
    if (!knockoutMatchesByRound[m.round]) knockoutMatchesByRound[m.round] = [];
    knockoutMatchesByRound[m.round].push(m);
  });

  // Order of rounds for display
  const roundOrder = [
    "knockout_stage_roundof32",
    "knockout_stage_roundof16",
    "knockout_stage_quarterfinal",
    "knockout_stage_semifinal",
    "knockout_stage_final",
  ];

  container.innerHTML = "";

  roundOrder.forEach((round) => {
    const roundMatches = knockoutMatchesByRound[round] || [];
    if (roundMatches.length === 0) return;

    const column = document.createElement("div");
    column.className = "space-y-3";

    const roundKey = roundKeyMap[round];
    const roundName = roundDisplayNames[roundKey] || roundKey;

    // Column header
    const header = document.createElement("div");
    header.className = "text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2";
    header.textContent = roundName;
    column.appendChild(header);

    const sortedMatches = [...roundMatches].sort((a, b) => a.match_number - b.match_number);

    sortedMatches.forEach((match, index) => {
      const matchKey = `${roundKey}-${index + 1}`;
      const isCorrect = isKnockoutPredictionCorrect(match, picks, matchKey);
      const status = getMatchStatus(match, isCorrect);

      // Apply filter
      if (currentFilter !== "all" && status !== currentFilter) return;

      const card = template.content.cloneNode(true);
      const article = card.querySelector("article");

      // Card styling based on status
      if (status === "correct") {
        article.className = "rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 shadow-sm";
      } else if (status === "incorrect") {
        article.className = "rounded-xl border border-rose-200 bg-rose-50/60 p-3 shadow-sm";
      } else {
        article.className = "rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm";
      }

      const homeTeam = teamsById.get(match.home_team_id);
      const awayTeam = teamsById.get(match.away_team_id);
      const winnerTeam = match.actual_winner_team_id ? teamsById.get(match.actual_winner_team_id) : null;
      const userPickTeam = picks?.knockout?.[matchKey] ? teamsById.get(picks.knockout[matchKey]) : null;

      card.querySelector('[data-role="round"]').textContent = `Match ${match.match_number}`;

      const pointsEl = card.querySelector('[data-role="points"]');
      if (isCorrect === true) {
        pointsEl.textContent = "+2";
        pointsEl.className = "font-semibold text-emerald-600";
      } else if (isCorrect === false) {
        pointsEl.textContent = "0";
        pointsEl.className = "font-semibold text-rose-600";
      } else {
        pointsEl.textContent = "—";
        pointsEl.className = "text-slate-400";
      }

      // Home team
      const homeFlag = card.querySelector('[data-role="home-flag"]');
      const homeName = card.querySelector('[data-role="home-name"]');
      const homeScore = card.querySelector('[data-role="home-score"]');

      if (homeTeam) {
        homeFlag.src = homeTeam.flag_emoji || "";
        homeFlag.alt = homeTeam.name;
        homeName.textContent = WCP.getTeamAbbr(homeTeam);
      } else {
        homeName.textContent = "TBD";
      }
      homeScore.textContent = match.status === "completed" ? match.actual_home_score : "";

      // Away team
      const awayFlag = card.querySelector('[data-role="away-flag"]');
      const awayName = card.querySelector('[data-role="away-name"]');
      const awayScore = card.querySelector('[data-role="away-score"]');

      if (awayTeam) {
        awayFlag.src = awayTeam.flag_emoji || "";
        awayFlag.alt = awayTeam.name;
        awayName.textContent = WCP.getTeamAbbr(awayTeam);
      } else {
        awayName.textContent = "TBD";
      }
      awayScore.textContent = match.status === "completed" ? match.actual_away_score : "";

      // User pick and actual winner
      card.querySelector('[data-role="user-pick"]').textContent = userPickTeam ? WCP.getTeamAbbr(userPickTeam) : "No pick";
      card.querySelector('[data-role="actual-winner"]').textContent = winnerTeam ? WCP.getTeamAbbr(winnerTeam) : "Pending";

      column.appendChild(card);
    });

    container.appendChild(column);
  });
};

/**
 * Setup filter buttons
 */
const setupFilters = (matches, picks, teamsById) => {
  const buttons = document.querySelectorAll(".result-filter-button");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      // Update button styles
      buttons.forEach((btn) => {
        btn.className = "result-filter-button rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 transition hover:-translate-y-0.5 hover:shadow-sm";
      });
      button.className = "result-filter-button rounded-full border border-emerald-500 bg-emerald-500 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white transition hover:-translate-y-0.5 hover:shadow-sm";

      // Update filter and re-render
      currentFilter = button.dataset.filter;
      renderGroupResults(matches, picks, teamsById);
      renderKnockoutResults(matches, picks, teamsById);
    });
  });
};

/**
 * QR Code Modal Functions
 */
let qrCodeInstance = null;

const openQRModal = () => {
  const modal = document.getElementById("qr-modal");
  const container = document.getElementById("qr-container");

  // Clear previous QR code
  container.innerHTML = "";

  // Generate new QR code for current URL
  qrCodeInstance = new QRCode(container, {
    text: window.location.href,
    width: 256,
    height: 256,
    colorDark: "#0f172a", // slate-900
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M,
  });

  // Show modal with flex display
  modal.classList.remove("hidden");
  modal.classList.add("flex");
};

const closeQRModal = () => {
  const modal = document.getElementById("qr-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
};

const downloadQR = () => {
  const container = document.getElementById("qr-container");
  const canvas = container.querySelector("canvas");

  if (canvas) {
    const link = document.createElement("a");
    link.download = "worldcup-bracket-qr.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }
};

const copyUrl = async () => {
  const btn = document.getElementById("qr-copy-url-btn");
  const originalHTML = btn.innerHTML;

  try {
    await navigator.clipboard.writeText(window.location.href);
    btn.innerHTML = `
      <span class="inline-flex items-center gap-1">
        <svg class="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        Copied!
      </span>
    `;
    btn.classList.add("border-emerald-500", "text-emerald-600");

    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.classList.remove("border-emerald-500", "text-emerald-600");
    }, 2000);
  } catch (err) {
    console.error("Failed to copy URL:", err);
  }
};

const initQRModal = () => {
  const openBtn = document.getElementById("qr-code-btn");
  const closeBtn = document.getElementById("qr-close-btn");
  const modal = document.getElementById("qr-modal");
  const downloadBtn = document.getElementById("qr-download-btn");
  const copyBtn = document.getElementById("qr-copy-url-btn");

  openBtn.addEventListener("click", openQRModal);
  closeBtn.addEventListener("click", closeQRModal);
  downloadBtn.addEventListener("click", downloadQR);
  copyBtn.addEventListener("click", copyUrl);

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeQRModal();
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) {
      closeQRModal();
    }
  });
};

/**
 * Initialize the results page
 */
const init = async () => {
  const statusEl = document.getElementById("status");

  try {
    await WCP.loadData();

    const { matches, picks, teamsById } = WCP;

    // Debug: log picks to see what was loaded
    console.log("- URL hash:", window.location.hash);
    console.log("- Picks object:", picks);
    console.log("- Picks keys:", Object.keys(picks));

    // Check for picks
    const groupPicksCount = Object.keys(picks).filter(k => !["knockout", "thirdPlaceOrder", "standingsOrder"].includes(k)).length;
    const knockoutPicksCount = Object.keys(picks.knockout || {}).length;

    // Show message if no picks found
    if (groupPicksCount === 0 && knockoutPicksCount === 0) {
      statusEl.innerHTML = `
        <div class="text-center">
          <div class="text-lg font-semibold text-slate-700">No predictions found</div>
          <p class="mt-2 text-slate-500">You haven't made any match predictions yet.</p>
          <p class="mt-1 text-slate-500">Go to <a href="group-grid.html" class="text-emerald-600 underline">Grid View</a> or <a href="index.html" class="text-emerald-600 underline">Card View</a> to select Home/Draw/Away for each match.</p>
        </div>
      `;
      statusEl.className = "mx-auto max-w-6xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm";
      return;
    }

    // Calculate and display scores
    const scores = calculateScores(matches, picks);
    console.log("- Scores:", scores);
    updateScoreCards(scores);

    // Render results
    renderGroupResults(matches, picks, teamsById);
    renderKnockoutResults(matches, picks, teamsById);

    // Setup filters
    setupFilters(matches, picks, teamsById);

    // Show QR button and initialize modal (only if picks exist)
    const qrBtn = document.getElementById("qr-code-btn");
    qrBtn.classList.remove("hidden");
    initQRModal();

    // Hide loading status
    statusEl.style.display = "none";
  } catch (error) {
    console.error("Failed to load data:", error);
    statusEl.textContent = `Failed to load data: ${error.message}`;
    statusEl.className = "mx-auto max-w-6xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600";
  }
};

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", init);
