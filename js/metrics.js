/**
 * World Cup 2026 Pool - Metrics Page
 * Fetches and displays Kalshi prediction market data
 */

const API_BASE_URL = "http://localhost:8000";

const fetchBtn = document.getElementById("fetch-rankings-btn");
const btnText = document.getElementById("btn-text");
const spinner = document.getElementById("spinner");
const statusMessage = document.getElementById("status-message");
const fetchTime = document.getElementById("fetch-time");
const rankingsContainer = document.getElementById("rankings-container");
const rankingsTable = document.getElementById("rankings-table");

/**
 * Show loading state
 */
const showLoading = () => {
  fetchBtn.disabled = true;
  btnText.textContent = "Fetching...";
  spinner.classList.remove("hidden");
  statusMessage.classList.add("hidden");
};

/**
 * Hide loading state
 */
const hideLoading = () => {
  fetchBtn.disabled = false;
  btnText.textContent = "Fetch Rankings";
  spinner.classList.add("hidden");
};

/**
 * Show status message
 */
const showStatus = (message, isError = false) => {
  statusMessage.textContent = message;
  statusMessage.classList.remove("hidden", "bg-red-50", "text-red-700", "bg-emerald-50", "text-emerald-700");
  if (isError) {
    statusMessage.classList.add("bg-red-50", "text-red-700");
  } else {
    statusMessage.classList.add("bg-emerald-50", "text-emerald-700");
  }
};

/**
 * Format timestamp for display
 */
const formatTimestamp = (isoString) => {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
};

/**
 * Get row background color based on rank
 */
const getRowClass = (rank) => {
  if (rank <= 3) return "bg-amber-50/50";
  if (rank <= 10) return "bg-emerald-50/30";
  return "";
};

/**
 * Format cents as percentage
 */
const formatCents = (cents) => {
  if (cents == null) return "—";
  return `${cents}¢`;
};

/**
 * Format volume with K/M suffix
 */
const formatVolume = (volume) => {
  if (volume == null) return "—";
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(1)}K`;
  return volume.toLocaleString();
};

/**
 * Render rankings table
 */
const renderRankings = (rankings) => {
  rankingsTable.innerHTML = "";

  rankings.forEach((team) => {
    const row = document.createElement("tr");
    row.className = getRowClass(team.rank);

    const probability = team.probability ?? 0;
    row.innerHTML = `
      <td class="px-4 py-3 text-center font-semibold ${team.rank <= 3 ? 'text-amber-600' : ''}">${team.rank}</td>
      <td class="px-4 py-3 font-medium">${team.team_name}</td>
      <td class="px-4 py-3 text-center">
        <span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold ${probability >= 10 ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600'}">
          ${probability}%
        </span>
      </td>
      <td class="px-4 py-3 text-center text-slate-600">${formatCents(team.yes_bid)}</td>
      <td class="px-4 py-3 text-center text-slate-600">${formatCents(team.yes_ask)}</td>
      <td class="px-4 py-3 text-center text-slate-500 text-xs">${formatVolume(team.volume)}</td>
    `;

    rankingsTable.appendChild(row);
  });

  rankingsContainer.classList.remove("hidden");
};

/**
 * Fetch rankings from API
 */
const fetchRankings = async () => {
  showLoading();

  try {
    const response = await fetch(`${API_BASE_URL}/api/metrics/rankings`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.rankings || data.rankings.length === 0) {
      showStatus("No rankings data available.", true);
      return;
    }

    renderRankings(data.rankings);
    showStatus(`Successfully fetched ${data.rankings.length} teams from ${data.event_ticker}`);

    if (data.as_of) {
      fetchTime.textContent = `Last updated: ${formatTimestamp(data.as_of)}`;
      fetchTime.classList.remove("hidden");
    }

  } catch (error) {
    console.error("Failed to fetch rankings:", error);
    showStatus(`Error: ${error.message}`, true);
  } finally {
    hideLoading();
  }
};

// ============================================
// Historical Chart Section
// ============================================

const fetchHistoryBtn = document.getElementById("fetch-history-btn");
const historyBtnText = document.getElementById("history-btn-text");
const historySpinner = document.getElementById("history-spinner");
const historyStatus = document.getElementById("history-status");
const chartContainer = document.getElementById("chart-container");
const chartPlaceholder = document.getElementById("chart-placeholder");
const chartCacheInfo = document.getElementById("chart-cache-info");
const teamCountSelect = document.getElementById("team-count");
const daysBackSelect = document.getElementById("days-back");

let probabilityChart = null;

// Color palette for chart lines
const CHART_COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#a855f7", // purple
  "#eab308", // yellow
  "#22c55e", // green
  "#0ea5e9", // sky
  "#d946ef", // fuchsia
  "#64748b", // slate
  "#78716c", // stone
  "#dc2626", // red-600
  "#2563eb", // blue-600
];

/**
 * Show history loading state
 */
const showHistoryLoading = () => {
  fetchHistoryBtn.disabled = true;
  historyBtnText.textContent = "Loading...";
  historySpinner.classList.remove("hidden");
  historyStatus.classList.add("hidden");
};

/**
 * Hide history loading state
 */
const hideHistoryLoading = () => {
  fetchHistoryBtn.disabled = false;
  historyBtnText.textContent = "Load Chart";
  historySpinner.classList.add("hidden");
};

/**
 * Show history status message
 */
const showHistoryStatus = (message, isError = false) => {
  historyStatus.textContent = message;
  historyStatus.classList.remove("hidden", "bg-red-50", "text-red-700", "bg-emerald-50", "text-emerald-700", "bg-amber-50", "text-amber-700");
  if (isError) {
    historyStatus.classList.add("bg-red-50", "text-red-700");
  } else {
    historyStatus.classList.add("bg-emerald-50", "text-emerald-700");
  }
};

/**
 * Transform API history data to Chart.js format
 */
const transformHistoryData = (history, teams) => {
  // Group history by team
  const teamData = {};
  teams.forEach((team) => {
    teamData[team] = [];
  });

  history.forEach((point) => {
    if (teamData[point.team_name]) {
      teamData[point.team_name].push({
        x: new Date(point.timestamp * 1000),
        y: point.probability,
      });
    }
  });

  // Create datasets for Chart.js
  const datasets = teams.map((team, index) => ({
    label: team,
    data: teamData[team].sort((a, b) => a.x - b.x),
    borderColor: CHART_COLORS[index % CHART_COLORS.length],
    backgroundColor: CHART_COLORS[index % CHART_COLORS.length] + "20",
    borderWidth: 2,
    pointRadius: 2,
    pointHoverRadius: 5,
    tension: 0.3,
    fill: false,
  }));

  return datasets;
};

/**
 * Render or update the chart
 */
const renderChart = (datasets) => {
  const ctx = document.getElementById("probability-chart").getContext("2d");

  // Destroy existing chart if present
  if (probabilityChart) {
    probabilityChart.destroy();
  }

  probabilityChart = new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            padding: 15,
            font: {
              family: "'Space Grotesk', sans-serif",
              size: 11,
            },
          },
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          titleFont: {
            family: "'Space Grotesk', sans-serif",
            size: 12,
          },
          bodyFont: {
            family: "'Space Grotesk', sans-serif",
            size: 11,
          },
          padding: 12,
          callbacks: {
            title: (items) => {
              if (items.length > 0) {
                return new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }).format(items[0].parsed.x);
              }
              return "";
            },
            label: (context) => {
              return `${context.dataset.label}: ${context.parsed.y}%`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "time",
          time: {
            unit: "day",
            displayFormats: {
              day: "MMM d",
            },
          },
          grid: {
            display: false,
          },
          ticks: {
            font: {
              family: "'Space Grotesk', sans-serif",
              size: 11,
            },
          },
        },
        y: {
          beginAtZero: true,
          max: Math.max(30, ...datasets.flatMap(d => d.data.map(p => p.y))) + 5,
          title: {
            display: true,
            text: "Win Probability (%)",
            font: {
              family: "'Space Grotesk', sans-serif",
              size: 12,
            },
          },
          grid: {
            color: "rgba(0, 0, 0, 0.05)",
          },
          ticks: {
            callback: (value) => `${value}%`,
            font: {
              family: "'Space Grotesk', sans-serif",
              size: 11,
            },
          },
        },
      },
    },
  });

  // Show chart, hide placeholder
  chartContainer.classList.remove("hidden");
  chartPlaceholder.classList.add("hidden");
};

/**
 * Fetch history from API
 */
const fetchHistory = async () => {
  showHistoryLoading();

  const topNTeams = parseInt(teamCountSelect.value, 10);
  const daysBack = parseInt(daysBackSelect.value, 10);

  try {
    const url = `${API_BASE_URL}/api/metrics/history?top_n_teams=${topNTeams}&days_back=${daysBack}`;
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.history || data.history.length === 0) {
      showHistoryStatus("No historical data available.", true);
      return;
    }

    // Transform and render chart
    const datasets = transformHistoryData(data.history, data.teams);
    renderChart(datasets);

    // Show success status
    showHistoryStatus(`Loaded ${data.teams.length} teams`);

    // Show data range info
    if (data.data_from && data.data_to) {
      chartCacheInfo.textContent = `Data range: ${formatTimestamp(data.data_from)} - ${formatTimestamp(data.data_to)}`;
    }

  } catch (error) {
    console.error("Failed to fetch history:", error);
    showHistoryStatus(`Error: ${error.message}`, true);
  } finally {
    hideHistoryLoading();
  }
};

// Event listeners
fetchBtn.addEventListener("click", fetchRankings);
fetchHistoryBtn.addEventListener("click", fetchHistory);
