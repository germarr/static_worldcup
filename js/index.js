/**
 * World Cup 2026 Pool - Card View (index.html)
 * Page-specific logic for the card view
 */

(async function() {
  const WCP = window.WorldCupPool;

  // DOM elements
  const statusEl = document.getElementById("status");
  const groupsEl = document.getElementById("groups");
  const groupTemplate = document.getElementById("group-template");
  const cardTemplate = document.getElementById("card-template");
  const standingsTemplate = document.getElementById("standings-template");
  const knockoutTemplate = document.getElementById("knockout-template");
  const standingsEl = document.getElementById("standings");
  const knockoutEl = document.getElementById("knockout");
  const pickSummaryEl = document.getElementById("pick-summary");
  const pickProgressEl = document.getElementById("pick-progress");

  /**
   * Create a match card element
   */
  const createCard = (match) => {
    const card = cardTemplate.content.cloneNode(true);
    const statusBadge = card.querySelector('[data-role="status"]');
    const matchNumberEl = card.querySelector('[data-role="match-number"]');
    const dateEl = card.querySelector('[data-role="match-date"]');
    const homeFlagEl = card.querySelector('[data-role="home-flag"]');
    const homeNameEl = card.querySelector('[data-role="home-name"]');
    const awayFlagEl = card.querySelector('[data-role="away-flag"]');
    const awayNameEl = card.querySelector('[data-role="away-name"]');
    const stadiumEl = card.querySelector('[data-role="stadium"]');
    const locationEl = card.querySelector('[data-role="location"]');
    const pickGroupEl = card.querySelector('[data-role="pick-group"]');

    const currentPick = WCP.picks[match.id];
    statusBadge.textContent = currentPick ? "picked" : "open";
    matchNumberEl.textContent = `Match #${match.match_number}`;
    dateEl.textContent = WCP.formatDate(match.scheduled_datetime);

    const homeTeam = WCP.teamsById.get(match.home_team_id) || { name: "TBD", flag_emoji: "" };
    const awayTeam = WCP.teamsById.get(match.away_team_id) || { name: "TBD", flag_emoji: "" };

    homeFlagEl.src = homeTeam.flag_emoji || "";
    homeFlagEl.alt = `${homeTeam.name} flag`;
    homeNameEl.textContent = homeTeam.name;

    awayFlagEl.src = awayTeam.flag_emoji || "";
    awayFlagEl.alt = `${awayTeam.name} flag`;
    awayNameEl.textContent = awayTeam.name;

    const stadium = WCP.stadiumsById.get(match.stadium_id);
    stadiumEl.textContent = stadium ? stadium.name : "Stadium TBD";
    locationEl.textContent = stadium ? `${stadium.city}, ${stadium.country}` : "Location TBD";

    if (pickGroupEl && match.round === "group_stage") {
      WCP.createPickControls(match, pickGroupEl, "pill", () => {
        WCP.updatePickSummary(pickSummaryEl, pickProgressEl);
        renderStandings();
        renderGroups();
        renderKnockout();
      });
    }

    return card;
  };

  /**
   * Render group sections with match cards
   */
  const renderGroups = () => {
    const groupMatches = WCP.matches
      .filter((match) => match.round === "group_stage")
      .sort((a, b) => a.match_number - b.match_number)
      .reduce((acc, match) => {
        const key = match.group_letter || "?";
        acc[key] = acc[key] || [];
        acc[key].push(match);
        return acc;
      }, {});

    const groupLetters = Object.keys(groupMatches).sort();
    groupsEl.innerHTML = "";

    groupLetters.forEach((groupLetter) => {
      const section = groupTemplate.content.cloneNode(true);
      const heading = section.querySelector("h2");
      const grid = section.querySelector(".grid");

      heading.textContent = `Group ${groupLetter}`;

      groupMatches[groupLetter].forEach((match) => {
        grid.appendChild(createCard(match));
      });

      groupsEl.appendChild(section);
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
        tr.classList.add("opacity-60");
      });
      tr.addEventListener("dragend", () => {
        tr.classList.remove("opacity-60");
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

      const rows = WCP.getSortedRows(groups[groupLetter], groupLetter).slice(0, 4);
      const tieGroups = rows.reduce((acc, row) => {
        const key = `${row.points}-${row.gd}`;
        acc[key] = acc[key] || [];
        acc[key].push(row);
        return acc;
      }, {});

      rows.forEach((row, index) => {
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
        teamCell.className = "px-3 py-2 font-medium";
        teamCell.innerHTML = `
          <div class="flex flex-wrap items-center gap-2">
            <img class="h-4 w-6 rounded-sm border border-slate-200 object-cover" src="${row.team.flag_emoji || ""}" alt="${row.team.name} flag" />
            <span>${row.team.name}</span>
          </div>
        `;

        if (showTieOrder) {
          const orderGroup = WCP.picks.standingsOrder[groupLetter][tieKey];
          const orderIndex = orderGroup.indexOf(row.team.id);
          const select = document.createElement("select");
          select.className =
            "ml-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500";
          select.title = "Tie-break order";
          for (let optionIndex = 0; optionIndex < orderGroup.length; optionIndex += 1) {
            const option = document.createElement("option");
            option.value = optionIndex + 1;
            option.textContent = `Order ${optionIndex + 1}`;
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
          teamCell.querySelector("div")?.appendChild(select);
        }

        const playedCell = document.createElement("td");
        playedCell.className = "px-3 py-2 text-center";
        playedCell.textContent = row.played;

        const gdCell = document.createElement("td");
        gdCell.className = "px-3 py-2 text-center";
        gdCell.textContent = row.gd;

        const ptsCell = document.createElement("td");
        ptsCell.className = "px-3 py-2 text-center font-semibold text-slate-900";
        ptsCell.textContent = row.points;

        tr.appendChild(teamCell);
        tr.appendChild(playedCell);
        tr.appendChild(gdCell);
        tr.appendChild(ptsCell);
        tbody.appendChild(tr);
      });

      standingsEl.appendChild(groupCard);
    });

    WCP.persistPicks();
    renderThirdPlaceTable(groups);
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
          WCP.picks.knockout[match.key] = option.id;
          WCP.persistPicks();
          renderKnockout();
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
   * Randomize all group stage picks
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
  };

  /**
   * Initialize the card view
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
