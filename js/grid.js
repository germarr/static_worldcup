/**
 * World Cup 2026 Pool - Grid View (group-grid.html)
 * Page-specific logic for the grid view
 */

(async function() {
  const WCP = window.WorldCupPool;

  // DOM elements
  const statusEl = document.getElementById("status");
  const groupsEl = document.getElementById("groups");
  const standingsTemplate = document.getElementById("standings-template");
  const knockoutTemplate = document.getElementById("knockout-template");
  const standingsEl = document.getElementById("standings");
  const knockoutEl = document.getElementById("knockout");
  const pickSummaryEl = document.getElementById("pick-summary");
  const pickProgressEl = document.getElementById("pick-progress");
  const winnerDetailsEl = document.getElementById("winner-details");
  const thirdPlaceDetailsEl = document.getElementById("third-place-details");
  const printButton = document.getElementById("print-pool");
  const randomizeKnockoutButton = document.getElementById("randomize-knockout");
  const filterButtons = Array.from(document.querySelectorAll(".filter-button"));
  const groupFilterButtons = Array.from(document.querySelectorAll(".group-filter-button"));

  let currentSort = "match";
  let currentGroupFilter = "all";

  /**
   * Get sort value for a match
   */
  const getSortValue = (match) => {
    const stadium = WCP.stadiumsById.get(match.stadium_id);
    const homeTeam = WCP.teamsById.get(match.home_team_id);
    const awayTeam = WCP.teamsById.get(match.away_team_id);
    if (currentSort === "group") return match.group_letter || "";
    if (currentSort === "stadium") return stadium?.name || "";
    if (currentSort === "home-country") return homeTeam?.name || "";
    if (currentSort === "away-country") return awayTeam?.name || "";
    return match.match_number || 0;
  };

  /**
   * Compare matches for sorting
   */
  const compareMatches = (a, b) => {
    if (currentSort === "match") return (a.match_number || 0) - (b.match_number || 0);
    const aValue = getSortValue(a);
    const bValue = getSortValue(b);
    if (typeof aValue === "number" && typeof bValue === "number") {
      return aValue - bValue;
    }
    const textCompare = String(aValue).localeCompare(String(bValue));
    if (textCompare !== 0) return textCompare;
    return (a.match_number || 0) - (b.match_number || 0);
  };

  /**
   * Create a match row for the grid table
   */
  const createMatchRow = (match) => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50/80";

    const currentPick = WCP.picks[match.id];
    const statusText = currentPick ? "Picked" : "Open";
    const statusClass = currentPick
      ? "border-emerald-200 bg-emerald-100 text-emerald-700"
      : "border-amber-200 bg-amber-100 text-amber-700";

    const homeTeam = WCP.teamsById.get(match.home_team_id) || { name: "TBD", flag_emoji: "" };
    const awayTeam = WCP.teamsById.get(match.away_team_id) || { name: "TBD", flag_emoji: "" };
    const stadium = WCP.stadiumsById.get(match.stadium_id);

    const groupCell = document.createElement("td");
    groupCell.className = "px-3 py-2 text-center font-semibold text-slate-600";
    groupCell.textContent = match.group_letter || "-";

    const matchCell = document.createElement("td");
    matchCell.className = "px-3 py-2 text-center font-semibold text-slate-600";
    matchCell.textContent = `#${match.match_number}`;

    const statusCell = document.createElement("td");
    statusCell.className = "px-3 py-2";
    statusCell.innerHTML = `<span class="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-widest ${statusClass}">${statusText}</span>`;

    const dateCell = document.createElement("td");
    dateCell.className = "px-3 py-2 text-slate-500";
    dateCell.textContent = WCP.formatDate(match.scheduled_datetime);

    const homeCell = document.createElement("td");
    homeCell.className = "px-3 py-2 font-medium";
    homeCell.innerHTML = `
      <div class="flex items-center gap-2">
        <img class="h-4 w-6 rounded-sm border border-slate-200 object-cover" src="${homeTeam.flag_emoji || ""}" alt="${homeTeam.name} flag" />
        <span>${homeTeam.name}</span>
      </div>
    `;

    const awayCell = document.createElement("td");
    awayCell.className = "px-3 py-2 font-medium";
    awayCell.innerHTML = `
      <div class="flex items-center gap-2">
        <img class="h-4 w-6 rounded-sm border border-slate-200 object-cover" src="${awayTeam.flag_emoji || ""}" alt="${awayTeam.name} flag" />
        <span>${awayTeam.name}</span>
      </div>
    `;

    const stadiumCell = document.createElement("td");
    stadiumCell.className = "px-3 py-2";
    stadiumCell.textContent = stadium ? stadium.name : "Stadium TBD";

    const locationCell = document.createElement("td");
    locationCell.className = "px-3 py-2 text-slate-500";
    locationCell.textContent = stadium ? `${stadium.city}, ${stadium.country}` : "Location TBD";

    const pickCell = document.createElement("td");
    pickCell.className = "px-3 py-2";
    const pickGroupEl = document.createElement("div");
    pickGroupEl.className = "grid grid-cols-3 gap-1";
    WCP.createPickControls(match, pickGroupEl, "grid", () => {
      WCP.updatePickSummary(pickSummaryEl, pickProgressEl);
      renderStandings();
      renderGroups();
      renderKnockout();
      updateQRButtonVisibility();
      updateTeamButtonVisibility();
    });
    pickCell.appendChild(pickGroupEl);

    tr.appendChild(groupCell);
    tr.appendChild(matchCell);
    tr.appendChild(statusCell);
    tr.appendChild(dateCell);
    tr.appendChild(homeCell);
    tr.appendChild(awayCell);
    tr.appendChild(stadiumCell);
    tr.appendChild(locationCell);
    tr.appendChild(pickCell);

    return tr;
  };

  /**
   * Create a compact mobile match row
   */
  const mobileMatchRowTemplate = document.getElementById("mobile-match-row-template");

  const createMobileMatchRow = (match) => {
    const row = mobileMatchRowTemplate.content.cloneNode(true);

    const currentPick = WCP.picks[match.id];
    const homeTeam = WCP.teamsById.get(match.home_team_id) || { name: "TBD", flag_emoji: "" };
    const awayTeam = WCP.teamsById.get(match.away_team_id) || { name: "TBD", flag_emoji: "" };

    row.querySelector('[data-role="home-flag"]').src = homeTeam.flag_emoji || "";
    row.querySelector('[data-role="home-flag"]').alt = `${homeTeam.name} flag`;
    row.querySelector('[data-role="home-name"]').textContent = homeTeam.name;

    row.querySelector('[data-role="away-flag"]').src = awayTeam.flag_emoji || "";
    row.querySelector('[data-role="away-flag"]').alt = `${awayTeam.name} flag`;
    row.querySelector('[data-role="away-name"]').textContent = awayTeam.name;

    const pickGroupEl = row.querySelector('[data-role="pick-group"]');
    WCP.createPickControls(match, pickGroupEl, "compact", () => {
      WCP.updatePickSummary(pickSummaryEl, pickProgressEl);
      renderStandings();
      renderGroups();
      renderKnockout();
      updateQRButtonVisibility();
      updateTeamButtonVisibility();
    });

    // Update status dot
    const statusDot = row.querySelector('[data-role="pick-status"]');
    statusDot.className = currentPick
      ? "h-2 w-2 rounded-full bg-emerald-400 flex-shrink-0 ml-1"
      : "h-2 w-2 rounded-full bg-slate-200 flex-shrink-0 ml-1";

    return row;
  };

  /**
   * Render groups as a grid table
   */
  const groupsMobileEl = document.getElementById("groups-mobile");

  const renderGroups = () => {
    groupsEl.innerHTML = "";
    groupsMobileEl.innerHTML = "";

    const filteredMatches = WCP.matches
      .filter((match) => match.round === "group_stage")
      .filter((match) => currentGroupFilter === "all" || match.group_letter === currentGroupFilter)
      .sort((a, b) => compareMatches(a, b));

    // Track separators for mobile view
    let currentDateKey = null;
    let currentGroupKey = null;

    // If filtering by specific group, show group header at top
    if (currentGroupFilter !== "all") {
      const groupHeader = document.createElement("div");
      groupHeader.className = "bg-slate-900 px-3 py-2 text-xs font-bold text-white";
      groupHeader.textContent = `Group ${currentGroupFilter}`;
      groupsMobileEl.appendChild(groupHeader);
    }

    filteredMatches.forEach((match) => {
      // Desktop table row
      groupsEl.appendChild(createMatchRow(match));

      // Mobile: Add separators based on sort/filter mode
      if (currentGroupFilter === "all") {
        if (currentSort === "match") {
          // Date separators when sorting by date
          const matchDate = new Date(match.scheduled_datetime);
          const dateKey = matchDate.toDateString();

          if (dateKey !== currentDateKey) {
            currentDateKey = dateKey;
            const separator = document.createElement("div");
            separator.className = "bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-500 border-b border-slate-200";
            separator.textContent = new Intl.DateTimeFormat("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            }).format(matchDate);
            groupsMobileEl.appendChild(separator);
          }
        } else if (currentSort === "group") {
          // Group separators when sorting by group
          if (match.group_letter !== currentGroupKey) {
            currentGroupKey = match.group_letter;
            const separator = document.createElement("div");
            separator.className = "bg-slate-900 px-3 py-2 text-xs font-bold text-white";
            separator.textContent = `Group ${match.group_letter}`;
            groupsMobileEl.appendChild(separator);
          }
        } else if (currentSort === "stadium") {
          // Stadium separators when sorting by stadium
          const stadium = WCP.stadiumsById.get(match.stadium_id);
          const stadiumKey = stadium?.id || "tbd";

          if (stadiumKey !== currentGroupKey) {
            currentGroupKey = stadiumKey;
            const separator = document.createElement("div");
            separator.className = "bg-slate-800 px-3 py-2 text-xs font-bold text-white";
            separator.innerHTML = stadium
              ? `<div>${stadium.name}</div><div class="text-[10px] font-normal text-slate-400">${stadium.city}, ${stadium.country}</div>`
              : "Stadium TBD";
            groupsMobileEl.appendChild(separator);
          }
        }
      }

      // Mobile compact row
      groupsMobileEl.appendChild(createMobileMatchRow(match));
    });
  };

  /**
   * Render third-place table
   */
  const renderThirdPlaceTable = (groups) => {
    WCP.cachedThirdPlaceGroups = groups;
    const thirdPlaceRows = Object.entries(groups).map(([groupLetter, group]) => {
      const rows = WCP.getSortedRows(group, groupLetter);
      return { groupLetter, ...rows[2] };
    });

    thirdPlaceRows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.team.name.localeCompare(b.team.name);
    });

    const tableBody = document.getElementById("third-place-table");
    tableBody.innerHTML = "";

    const rowsById = new Map(thirdPlaceRows.map((row) => [row.team.id, row]));
    const defaultOrder = thirdPlaceRows.map((row) => row.team.id);
    const storedOrder = WCP.picks.thirdPlaceOrder || [];
    const normalizedOrder = storedOrder
      .filter((id) => rowsById.has(id))
      .concat(defaultOrder.filter((id) => !storedOrder.includes(id)));

    const isSameOrder =
      normalizedOrder.length === storedOrder.length &&
      normalizedOrder.every((id, index) => id === storedOrder[index]);

    if (!isSameOrder) {
      WCP.picks.thirdPlaceOrder = normalizedOrder;
      WCP.persistPicks();
    }

    const applyMove = (order, fromId, toId) => {
      const fromIndex = order.indexOf(fromId);
      const toIndex = order.indexOf(toId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return order;
      const updated = [...order];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    };

    if (!tableBody.dataset.dragReady) {
      tableBody.dataset.dragReady = "true";
      tableBody.addEventListener("dragover", (event) => {
        event.preventDefault();
        tableBody.classList.add("drag-active");
        const targetRow = event.target.closest("tr[data-team-id]");
        tableBody.querySelectorAll("tr.drag-over").forEach((row) => {
          row.classList.remove("drag-over");
        });
        if (targetRow && !targetRow.classList.contains("dragging")) {
          targetRow.classList.add("drag-over");
        }
      });
      tableBody.addEventListener("drop", (event) => {
        event.preventDefault();
        const targetRow = event.target.closest("tr[data-team-id]");
        const sourceId = WCP.thirdPlaceDragSourceId || Number(event.dataTransfer.getData("text/plain"));
        if (!targetRow || !sourceId) return;
        const targetId = Number(targetRow.dataset.teamId);
        WCP.picks.thirdPlaceOrder = applyMove(WCP.picks.thirdPlaceOrder, sourceId, targetId);
        WCP.thirdPlaceDragSourceId = null;
        WCP.persistPicks();
        renderThirdPlaceTable(WCP.cachedThirdPlaceGroups);
        tableBody.classList.remove("drag-active");
      });
    }

    normalizedOrder.forEach((teamId, index) => {
      const row = rowsById.get(teamId);
      if (!row) return;
      const tr = document.createElement("tr");
      tr.dataset.teamId = row.team.id;
      tr.draggable = true;
      tr.title = "Drag to reorder";
      tr.className = "cursor-grab";
      if (index < 8) {
        tr.classList.add("bg-emerald-50/50");
      }
      tr.addEventListener("dragstart", (event) => {
        WCP.thirdPlaceDragSourceId = row.team.id;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(row.team.id));
        tr.classList.add("dragging");
      });
      tr.addEventListener("dragend", () => {
        tr.classList.remove("dragging");
        tableBody.classList.remove("drag-active");
        tableBody.querySelectorAll("tr.drag-over").forEach((rowEl) => {
          rowEl.classList.remove("drag-over");
        });
      });
      tr.innerHTML = `
        <td class="px-3 py-2 text-center font-semibold text-slate-500">${index + 1}</td>
        <td class="px-3 py-2 font-medium">
          <div class="flex items-center gap-2">
            <img class="h-4 w-6 rounded-sm border border-slate-200 object-cover" src="${row.team.flag_emoji || ""}" alt="${row.team.name} flag" />
            <span>${row.team.name}</span>
          </div>
        </td>
        <td class="px-3 py-2 text-center font-semibold text-slate-600">${row.groupLetter}</td>
        <td class="px-3 py-2 text-center">${row.played}</td>
        <td class="px-3 py-2 text-center">${row.gd}</td>
        <td class="px-3 py-2 text-center font-semibold text-slate-900">${row.points}</td>
      `;
      tableBody.appendChild(tr);
    });
  };

  /**
   * Render standings tables
   */
  const renderStandings = () => {
    const groups = WCP.buildStandings();
    const groupLetters = Object.keys(groups).sort();
    standingsEl.innerHTML = "";

    groupLetters.forEach((groupLetter) => {
      const groupCard = standingsTemplate.content.cloneNode(true);
      groupCard.querySelector("h3").textContent = `Group ${groupLetter}`;
      const tbody = groupCard.querySelector("tbody");
      const mobileContainer = groupCard.querySelector('[data-role="standings-mobile"]');

      const rows = WCP.getSortedRows(groups[groupLetter], groupLetter).slice(0, 4);
      const tieGroups = rows.reduce((acc, row) => {
        const key = `${row.points}-${row.gd}`;
        acc[key] = acc[key] || [];
        acc[key].push(row);
        return acc;
      }, {});

      rows.forEach((row, index) => {
        // Desktop table row
        const tr = document.createElement("tr");
        if (index < 2) {
          tr.className = "bg-emerald-50/60";
        } else if (index === 2) {
          tr.className = "bg-amber-50/60";
        }
        const tieKey = `${row.points}-${row.gd}`;
        const tieRows = tieGroups[tieKey] || [];
        const showTieOrder = tieRows.length > 1;
        const tieDefaults = [...tieRows]
          .sort((a, b) => {
            if (b.gf !== a.gf) return b.gf - a.gf;
            return a.team.name.localeCompare(b.team.name);
          })
          .map((item) => item.team.id);
        const storedOrder = WCP.picks?.standingsOrder?.[groupLetter]?.[tieKey] || [];
        const normalizedOrder = storedOrder
          .filter((id) => tieDefaults.includes(id))
          .concat(tieDefaults.filter((id) => !storedOrder.includes(id)));
        if (showTieOrder && normalizedOrder.length > 0) {
          WCP.picks.standingsOrder[groupLetter] = WCP.picks.standingsOrder[groupLetter] || {};
          WCP.picks.standingsOrder[groupLetter][tieKey] = normalizedOrder;
        }

        const teamCell = document.createElement("td");
        teamCell.className = "px-2 py-1.5 font-medium";
        const teamCode = row.team.country_code === "TBD" ? row.team.name : row.team.country_code;
        teamCell.innerHTML = `
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-1.5">
              <img class="h-4 w-6 rounded-sm border border-slate-200 object-cover" src="${row.team.flag_emoji || ""}" alt="${row.team.name} flag" />
              <span title="${row.team.name}">${teamCode}</span>
            </div>
          </div>
        `;

        if (showTieOrder) {
          const orderGroup = WCP.picks.standingsOrder[groupLetter][tieKey];
          const orderIndex = orderGroup.indexOf(row.team.id);
          const select = document.createElement("select");
          select.className =
            "rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-medium text-slate-500";
          select.title = "Tie-break order";
          for (let optionIndex = 0; optionIndex < orderGroup.length; optionIndex += 1) {
            const option = document.createElement("option");
            option.value = optionIndex + 1;
            option.textContent = `#${optionIndex + 1}`;
            if (optionIndex === orderIndex) option.selected = true;
            select.appendChild(option);
          }
          select.addEventListener("change", () => {
            const newPosition = Number(select.value) - 1;
            const currentIndex = orderGroup.indexOf(row.team.id);
            if (currentIndex === newPosition) return;
            const updated = [...orderGroup];
            updated.splice(currentIndex, 1);
            updated.splice(newPosition, 0, row.team.id);
            WCP.picks.standingsOrder[groupLetter][tieKey] = updated;
            WCP.persistPicks();
            renderStandings();
            renderKnockout();
          });
          teamCell.querySelector(".flex-col")?.appendChild(select);
        }

        const playedCell = document.createElement("td");
        playedCell.className = "px-1.5 py-1.5 text-center";
        playedCell.textContent = row.played;

        const wdlCell = document.createElement("td");
        wdlCell.className = "px-2 py-1.5 text-center whitespace-nowrap";
        wdlCell.textContent = `${row.won}-${row.drawn}-${row.lost}`;

        const gfCell = document.createElement("td");
        gfCell.className = "px-1.5 py-1.5 text-center";
        gfCell.textContent = row.gf;

        const gaCell = document.createElement("td");
        gaCell.className = "px-1.5 py-1.5 text-center";
        gaCell.textContent = row.ga;

        const gdCell = document.createElement("td");
        gdCell.className = "px-1.5 py-1.5 text-center";
        gdCell.textContent = row.gd;

        const ptsCell = document.createElement("td");
        ptsCell.className = "px-1.5 py-1.5 text-center font-semibold text-slate-900";
        ptsCell.textContent = row.points;

        tr.appendChild(teamCell);
        tr.appendChild(playedCell);
        tr.appendChild(wdlCell);
        tr.appendChild(gfCell);
        tr.appendChild(gaCell);
        tr.appendChild(gdCell);
        tr.appendChild(ptsCell);
        tbody.appendChild(tr);

        // Mobile row
        const mobileRow = document.createElement("div");
        let mobileBgClass = "bg-white border-slate-100";
        if (index < 2) {
          mobileBgClass = "bg-emerald-50/60 border-l-2 border-l-emerald-400 border-slate-100";
        } else if (index === 2) {
          mobileBgClass = "bg-amber-50/60 border-l-2 border-l-amber-400 border-slate-100";
        }
        mobileRow.className = `flex items-center justify-between px-2 py-1.5 rounded border ${mobileBgClass}`;
        mobileRow.innerHTML = `
          <div class="flex items-center gap-1.5 flex-1 min-w-0">
            <img class="h-3 w-5 rounded-sm border border-slate-200 object-cover flex-shrink-0" src="${row.team.flag_emoji || ""}" alt="${row.team.name} flag" />
            <span class="text-xs font-medium text-slate-700 truncate">${row.team.name}</span>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0 ml-1 text-[10px]">
            <div class="text-center">
              <div class="text-slate-400 leading-none">GD</div>
              <div class="text-slate-600 font-medium">${row.gd > 0 ? "+" : ""}${row.gd}</div>
            </div>
            <div class="text-center min-w-[1.25rem]">
              <div class="text-slate-400 leading-none">Pts</div>
              <div class="font-bold text-slate-900">${row.points}</div>
            </div>
          </div>
        `;
        mobileContainer.appendChild(mobileRow);
      });

      standingsEl.appendChild(groupCard);
    });

    WCP.persistPicks();
    renderThirdPlaceTable(groups);
  };

  /**
   * Render winner cards
   */
  const renderWinnerCards = (bracket) => {
    if (!winnerDetailsEl || !thirdPlaceDetailsEl) return;
    const winnerTeam = bracket?.final?.[0]?.winner?.team || null;
    const thirdTeam = bracket?.thirdPlace?.[0]?.winner?.team || null;

    if (winnerTeam) {
      winnerDetailsEl.innerHTML = `
        <div class="flex items-center gap-3">
          <img class="h-8 w-12 rounded-sm border border-emerald-200 object-cover" src="${winnerTeam.flag_emoji || ""}" alt="${winnerTeam.name} flag" />
          <div>
            <div class="text-sm font-semibold text-slate-900">${winnerTeam.name}</div>
            <div class="text-xs uppercase tracking-widest text-emerald-600">Champion</div>
          </div>
        </div>
      `;
    } else {
      winnerDetailsEl.innerHTML = '<span class="text-sm text-slate-500">Pick the final winner to reveal the champion.</span>';
    }

    if (thirdTeam) {
      thirdPlaceDetailsEl.innerHTML = `
        <div class="flex items-center gap-3">
          <img class="h-6 w-9 rounded-sm border border-amber-200 object-cover" src="${thirdTeam.flag_emoji || ""}" alt="${thirdTeam.name} flag" />
          <div>
            <div class="text-sm font-semibold text-slate-900">${thirdTeam.name}</div>
            <div class="text-[11px] uppercase tracking-widest text-amber-600">Third Place</div>
          </div>
        </div>
      `;
    } else {
      thirdPlaceDetailsEl.innerHTML = "Pick the third-place winner to reveal the team.";
    }
  };

  /**
   * Create knockout pick controls
   */
  const createKnockoutPickControls = (match, pickGroupEl) => {
    if (!pickGroupEl) return;
    pickGroupEl.innerHTML = "";
    const options = [
      { side: "home", label: match.home?.team?.name, id: match.home?.team?.id },
      { side: "away", label: match.away?.team?.name, id: match.away?.team?.id },
    ];

    options.forEach((option) => {
      const label = document.createElement("label");
      label.className = option.id ? "cursor-pointer" : "opacity-40";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = `pick-${match.key}`;
      input.value = option.id || "";
      input.disabled = !option.id;
      input.className = "peer sr-only";
      if (option.id && WCP.picks?.knockout?.[match.key] === option.id) {
        input.checked = true;
      }

      input.addEventListener("change", () => {
        if (input.checked && option.id) {
          // Ensure knockout object exists
          if (!WCP.picks.knockout) {
            WCP.picks.knockout = {};
          }
          WCP.picks.knockout[match.key] = option.id;
          console.log("Knockout pick saved:", match.key, "=", option.id);
          console.log("Current knockout picks:", JSON.stringify(WCP.picks.knockout));
          WCP.persistPicks();
          renderKnockout();
          updateQRButtonVisibility();
      updateTeamButtonVisibility();
        }
      });

      const pill = document.createElement("span");
      pill.className =
        "inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500 transition peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-checked:text-white";
      pill.textContent = option.label || "TBD";

      label.appendChild(input);
      label.appendChild(pill);
      pickGroupEl.appendChild(label);
    });
  };

  /**
   * Render knockout bracket
   */
  const renderKnockout = () => {
    const groups = WCP.buildStandings();
    const bracket = WCP.buildKnockoutBracket(groups);
    renderWinnerCards(bracket);

    const knockoutMatchesByRound = WCP.matches
      .filter((match) => match.round && match.round.startsWith("knockout_stage"))
      .sort((a, b) => a.match_number - b.match_number)
      .reduce((acc, match) => {
        acc[match.round] = acc[match.round] || [];
        acc[match.round].push(match);
        return acc;
      }, {});
    const roundLookup = {
      round32: "knockout_stage_roundof32",
      round16: "knockout_stage_roundof16",
      quarters: "knockout_stage_quarterfinal",
      semis: "knockout_stage_semifinal",
      third: "knockout_stage_thirdplace",
      final: "knockout_stage_final",
    };

    const columns = [
      { title: "Round of 32", matches: bracket.roundOf32, roundKey: "round32" },
      { title: "Round of 16", matches: bracket.roundOf16, roundKey: "round16" },
      { title: "Quarterfinals", matches: bracket.quarterfinals, roundKey: "quarters" },
      { title: "Semifinals", matches: bracket.semifinals, roundKey: "semis" },
    ];

    knockoutEl.innerHTML = "";

    columns.forEach((columnData) => {
      const column = document.createElement("div");
      column.className = "space-y-3";
      const header = document.createElement("div");
      header.className = "rounded-full bg-slate-100 px-3 py-1 text-[11px] uppercase tracking-widest text-slate-500";
      header.textContent = columnData.title;
      column.appendChild(header);

      columnData.matches.forEach((match, index) => {
        const card = knockoutTemplate.content.cloneNode(true);
        card.querySelector('[data-role="round"]').textContent = columnData.title;
        card.querySelector('[data-role="match-number"]').textContent = `#${index + 1}`;

        const homeTeam = match.home ? match.home.team : { name: "TBD", flag_emoji: "" };
        const awayTeam = match.away ? match.away.team : { name: "TBD", flag_emoji: "" };
        card.querySelector('[data-role="home-flag"]').src = homeTeam.flag_emoji || "";
        card.querySelector('[data-role="home-flag"]').alt = `${homeTeam.name} flag`;
        card.querySelector('[data-role="home-name"]').textContent = homeTeam.name;
        card.querySelector('[data-role="away-flag"]').src = awayTeam.flag_emoji || "";
        card.querySelector('[data-role="away-flag"]').alt = `${awayTeam.name} flag`;
        card.querySelector('[data-role="away-name"]').textContent = awayTeam.name;

        const matchMeta = knockoutMatchesByRound[roundLookup[columnData.roundKey]]?.[index] || null;
        const dateEl = card.querySelector('[data-role="match-date"]');
        const stadiumEl = card.querySelector('[data-role="stadium"]');
        if (matchMeta) {
          const stadium = WCP.stadiumsById.get(matchMeta.stadium_id);
          dateEl.textContent = WCP.formatDate(matchMeta.scheduled_datetime);
          stadiumEl.textContent = stadium ? stadium.name : "Stadium TBD";
        } else {
          dateEl.textContent = "Date TBD";
          stadiumEl.textContent = "Stadium TBD";
        }
        createKnockoutPickControls(match, card.querySelector('[data-role="pick-group"]'));

        column.appendChild(card);
      });

      knockoutEl.appendChild(column);
    });

    // Finals column
    const finalColumn = document.createElement("div");
    finalColumn.className = "space-y-3";
    const finalHeader = document.createElement("div");
    finalHeader.className = "rounded-full bg-slate-900 px-3 py-1 text-[11px] uppercase tracking-widest text-white";
    finalHeader.textContent = "Finals";
    finalColumn.appendChild(finalHeader);

    [
      { title: "Third Place", matches: bracket.thirdPlace, roundKey: "third" },
      { title: "Final", matches: bracket.final, roundKey: "final" },
    ].forEach((columnData) => {
      columnData.matches.forEach((match, index) => {
        const card = knockoutTemplate.content.cloneNode(true);
        card.querySelector('[data-role="round"]').textContent = columnData.title;
        card.querySelector('[data-role="match-number"]').textContent = `#${index + 1}`;

        const homeTeam = match.home ? match.home.team : { name: "TBD", flag_emoji: "" };
        const awayTeam = match.away ? match.away.team : { name: "TBD", flag_emoji: "" };
        card.querySelector('[data-role="home-flag"]').src = homeTeam.flag_emoji || "";
        card.querySelector('[data-role="home-flag"]').alt = `${homeTeam.name} flag`;
        card.querySelector('[data-role="home-name"]').textContent = homeTeam.name;
        card.querySelector('[data-role="away-flag"]').src = awayTeam.flag_emoji || "";
        card.querySelector('[data-role="away-flag"]').alt = `${awayTeam.name} flag`;
        card.querySelector('[data-role="away-name"]').textContent = awayTeam.name;

        const matchMeta = knockoutMatchesByRound[roundLookup[columnData.roundKey]]?.[index] || null;
        const dateEl = card.querySelector('[data-role="match-date"]');
        const stadiumEl = card.querySelector('[data-role="stadium"]');
        if (matchMeta) {
          const stadium = WCP.stadiumsById.get(matchMeta.stadium_id);
          dateEl.textContent = WCP.formatDate(matchMeta.scheduled_datetime);
          stadiumEl.textContent = stadium ? stadium.name : "Stadium TBD";
        } else {
          dateEl.textContent = "Date TBD";
          stadiumEl.textContent = "Stadium TBD";
        }
        createKnockoutPickControls(match, card.querySelector('[data-role="pick-group"]'));

        finalColumn.appendChild(card);
      });
    });

    knockoutEl.appendChild(finalColumn);
  };

  /**
   * Randomize knockout picks
   */
  const randomizeKnockoutPicks = () => {
    WCP.picks.knockout = WCP.picks.knockout || {};
    const groups = WCP.buildStandings();
    const pickRound = (roundMatches) => {
      roundMatches.forEach((match) => {
        if (!match?.home || !match?.away) return;
        const options = [match.home.team.id, match.away.team.id];
        const pick = options[Math.floor(Math.random() * options.length)];
        WCP.picks.knockout[match.key] = pick;
      });
    };

    let bracket = WCP.buildKnockoutBracket(groups);
    pickRound(bracket.roundOf32);
    bracket = WCP.buildKnockoutBracket(groups);
    pickRound(bracket.roundOf16);
    bracket = WCP.buildKnockoutBracket(groups);
    pickRound(bracket.quarterfinals);
    bracket = WCP.buildKnockoutBracket(groups);
    pickRound(bracket.semifinals);
    bracket = WCP.buildKnockoutBracket(groups);
    pickRound(bracket.thirdPlace);
    pickRound(bracket.final);

    WCP.persistPicks();
    renderKnockout();
    updateQRButtonVisibility();
      updateTeamButtonVisibility();
  };

  /**
   * Randomize group stage picks
   */
  const randomizeGroupPicks = () => {
    const options = ["H", "D", "A"];
    WCP.matches
      .filter((match) => match.round === "group_stage")
      .forEach((match) => {
        WCP.picks[match.id] = options[Math.floor(Math.random() * options.length)];
      });

    WCP.persistPicks();
    renderStandings();
    renderGroups();
    renderKnockout();
    WCP.updatePickSummary(pickSummaryEl, pickProgressEl);
    updateQRButtonVisibility();
      updateTeamButtonVisibility();
  };

  /**
   * Randomize entire tournament (group stage + knockout)
   */
  const randomizeTournament = () => {
    randomizeGroupPicks();
    randomizeKnockoutPicks();
  };

  /**
   * Clear all picks (group stage + knockout)
   */
  const clearAllPicks = () => {
    // Clear group stage picks
    WCP.matches
      .filter((match) => match.round === "group_stage")
      .forEach((match) => {
        delete WCP.picks[match.id];
      });

    // Clear knockout picks
    WCP.picks.knockout = {};

    // Clear URL hash
    window.location.hash = "";

    WCP.persistPicks();
    renderStandings();
    renderGroups();
    renderKnockout();
    WCP.updatePickSummary(pickSummaryEl, pickProgressEl);
    updateQRButtonVisibility();
      updateTeamButtonVisibility();
  };

  /**
   * Update filter button styles
   */
  const updateFilterButtons = () => {
    filterButtons.forEach((button) => {
      const isActive = button.dataset.sort === currentSort;
      button.classList.toggle("ring-2", isActive);
      button.classList.toggle("ring-emerald-400", isActive);
    });
  };

  /**
   * Update group filter button styles
   */
  const updateGroupFilterButtons = () => {
    groupFilterButtons.forEach((button) => {
      const isActive = button.dataset.group === currentGroupFilter;
      if (isActive) {
        button.classList.remove("border-slate-200", "bg-white", "text-slate-600");
        button.classList.add("border-emerald-500", "bg-emerald-500", "text-white");
      } else {
        button.classList.remove("border-emerald-500", "bg-emerald-500", "text-white");
        button.classList.add("border-slate-200", "bg-white", "text-slate-600");
      }
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
   * Update QR button visibility based on picks
   */
  const updateQRButtonVisibility = () => {
    const qrBtn = document.getElementById("qr-code-btn");
    if (!qrBtn) return;

    // Count picks (excluding metadata keys)
    const groupPicksCount = Object.keys(WCP.picks).filter(
      (k) => !["knockout", "thirdPlaceOrder", "standingsOrder"].includes(k)
    ).length;
    const knockoutPicksCount = Object.keys(WCP.picks.knockout || {}).length;

    if (groupPicksCount > 0 || knockoutPicksCount > 0) {
      qrBtn.classList.remove("hidden");
    } else {
      qrBtn.classList.add("hidden");
    }
  };

  /**
   * Team Modal Functions
   */
  let teamQrInstance = null;

  const openTeamModal = () => {
    const modal = document.getElementById("team-modal");
    const createForm = document.getElementById("team-create-form");
    const successSection = document.getElementById("team-success");

    // Reset to create form state
    createForm.classList.remove("hidden");
    successSection.classList.add("hidden");
    document.getElementById("team-name-input").value = "";
    document.getElementById("team-creator-name-input").value = "";

    modal.classList.remove("hidden");
    modal.classList.add("flex");
  };

  const closeTeamModal = () => {
    const modal = document.getElementById("team-modal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  };

  const showTeamSuccess = (teamCode, teamName) => {
    const createForm = document.getElementById("team-create-form");
    const successSection = document.getElementById("team-success");
    const codeDisplay = document.getElementById("team-code-result");
    const qrContainer = document.getElementById("team-success-qr");
    const viewBtn = document.getElementById("team-view-btn");

    // Hide form, show success
    createForm.classList.add("hidden");
    successSection.classList.remove("hidden");

    // Set code and link
    codeDisplay.value = teamCode;
    viewBtn.href = `team.html?c=${teamCode}`;

    // Generate QR code
    qrContainer.innerHTML = "";
    const shareUrl = `${window.location.origin}/team.html?c=${teamCode}`;
    teamQrInstance = new QRCode(qrContainer, {
      text: shareUrl,
      width: 200,
      height: 200,
      colorDark: "#0f172a",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
  };

  const createTeam = async () => {
    const teamName = document.getElementById("team-name-input").value.trim();
    const creatorName = document.getElementById("team-creator-name-input").value.trim();
    const createBtn = document.getElementById("team-create-btn");

    // Validation
    if (!teamName) {
      alert("Please enter a team name");
      return;
    }
    if (teamName.length > 50) {
      alert("Team name must be 50 characters or less");
      return;
    }
    if (!creatorName) {
      alert("Please enter your display name");
      return;
    }
    if (creatorName.length > 30) {
      alert("Display name must be 30 characters or less");
      return;
    }

    // Get bracket data
    const bracketData = await WCP.getCurrentBracketData();
    if (!bracketData || bracketData.length < 10) {
      alert("Please make some bracket picks before creating a team");
      return;
    }

    // Disable button and show loading
    const originalText = createBtn.textContent;
    createBtn.disabled = true;
    createBtn.textContent = "Creating...";

    try {
      const response = await fetch(`${WCP.API_BASE_URL}/api/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: teamName,
          creator_name: creatorName,
          bracket_data: bracketData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create team");
      }

      const result = await response.json();

      // Save tokens and team info
      WCP.setTeamCreatorToken(result.code, result.creator_token);
      WCP.setTeamMemberToken(result.code, result.member_token);
      WCP.addToMyTeams(result.code, result.name, creatorName, true);

      // Show success state
      showTeamSuccess(result.code, result.name);
    } catch (error) {
      console.error("Failed to create team:", error);
      alert(error.message || "Failed to create team. Please try again.");
    } finally {
      createBtn.disabled = false;
      createBtn.textContent = originalText;
    }
  };

  const initTeamModal = () => {
    const openBtn = document.getElementById("team-btn");
    const closeBtn = document.getElementById("team-close-btn");
    const modal = document.getElementById("team-modal");
    const createBtn = document.getElementById("team-create-btn");
    const copyCodeBtn = document.getElementById("team-copy-code-btn");
    const downloadQrBtn = document.getElementById("team-download-qr-btn");

    if (!openBtn) return; // Team feature not available on this page

    openBtn.addEventListener("click", openTeamModal);
    closeBtn.addEventListener("click", closeTeamModal);
    createBtn.addEventListener("click", createTeam);

    // Copy code button
    copyCodeBtn?.addEventListener("click", () => {
      const code = document.getElementById("team-code-result").value;
      navigator.clipboard.writeText(code);
      // Show brief feedback
      const originalHTML = copyCodeBtn.innerHTML;
      copyCodeBtn.innerHTML = '<svg class="h-5 w-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
      setTimeout(() => { copyCodeBtn.innerHTML = originalHTML; }, 1500);
    });

    // Download QR button
    downloadQrBtn?.addEventListener("click", () => {
      const qrContainer = document.getElementById("team-success-qr");
      const canvas = qrContainer.querySelector("canvas");
      if (canvas) {
        const link = document.createElement("a");
        const code = document.getElementById("team-code-result").value;
        link.download = `team-${code}-qr.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      }
    });

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeTeamModal();
    });

    // Close on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.classList.contains("hidden")) {
        closeTeamModal();
      }
    });
  };

  /**
   * Update Team button visibility based on picks
   */
  const updateTeamButtonVisibility = () => {
    const teamBtn = document.getElementById("team-btn");
    if (!teamBtn) return;

    // Count picks (excluding metadata keys)
    const groupPicksCount = Object.keys(WCP.picks).filter(
      (k) => !["knockout", "thirdPlaceOrder", "standingsOrder"].includes(k)
    ).length;
    const knockoutPicksCount = Object.keys(WCP.picks.knockout || {}).length;

    if (groupPicksCount > 0 || knockoutPicksCount > 0) {
      teamBtn.classList.remove("hidden");
    } else {
      teamBtn.classList.add("hidden");
    }
  };

  /**
   * Initialize the grid view
   */
  const init = async () => {
    try {
      await WCP.loadData();

      renderStandings();
      renderGroups();
      renderKnockout();
      WCP.updatePickSummary(pickSummaryEl, pickProgressEl);
      statusEl.remove();

      const randomizeButton = document.getElementById("randomize-results");
      randomizeButton?.addEventListener("click", randomizeGroupPicks);
      const randomizeTournamentButton = document.getElementById("randomize-tournament");
      randomizeTournamentButton?.addEventListener("click", randomizeTournament);
      const clearPicksButton = document.getElementById("clear-picks");
      clearPicksButton?.addEventListener("click", clearAllPicks);
      randomizeKnockoutButton?.addEventListener("click", randomizeKnockoutPicks);
      printButton?.addEventListener("click", () => {
        const currentHash = window.location.hash;
        window.open(`print-pool.html${currentHash}`, '_blank');
      });

      filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const nextSort = button.dataset.sort || "match";
          if (currentSort === nextSort) return;
          currentSort = nextSort;
          updateFilterButtons();
          renderGroups();
        });
      });
      updateFilterButtons();

      groupFilterButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const nextGroup = button.dataset.group || "all";
          if (currentGroupFilter === nextGroup) return;
          currentGroupFilter = nextGroup;
          updateGroupFilterButtons();
          renderGroups();
        });
      });
      updateGroupFilterButtons();

      // Initialize QR modal and show button if picks exist
      initQRModal();
      updateQRButtonVisibility();

      // Initialize Team modal and show button if picks exist
      initTeamModal();
      updateTeamButtonVisibility();

      // Hide filter pane when user scrolls to group standings
      const groupFiltersEl = document.getElementById("group-filters");
      const standingsSection = document.getElementById("standings-section");
      if (groupFiltersEl && standingsSection) {
        const updateFilterVisibility = () => {
          const standingsTop = standingsSection.getBoundingClientRect().top;
          const threshold = 100; // Hide when standings section is near top of viewport
          if (standingsTop < threshold) {
            groupFiltersEl.classList.add("opacity-0", "pointer-events-none");
          } else {
            groupFiltersEl.classList.remove("opacity-0", "pointer-events-none");
          }
        };
        window.addEventListener("scroll", updateFilterVisibility, { passive: true });
        updateFilterVisibility();
      }
    } catch (error) {
      console.error("Failed to initialize:", error);
      statusEl.textContent = "Failed to load data.";
      statusEl.classList.add("text-rose-600", "border-rose-200", "bg-rose-50");
    }
  };

  // Start initialization when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
