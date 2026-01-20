/**
 * World Cup 2026 Pool - Print Sheet
 * Page-specific logic for the printable pool sheet
 */

(async () => {
  const WCP = window.WorldCupPool;

  // Override getPickScore for print view with more realistic scores
  const getPickScore = (pick) => {
    if (pick === "H") return { home: 2, away: 1 };
    if (pick === "A") return { home: 1, away: 2 };
    if (pick === "D") return { home: 1, away: 1 };
    return null;
  };

  // Build standings using the print-specific getPickScore
  const buildStandings = () => {
    const { matches, teams, picks } = WCP;
    const groupMatches = matches.filter((m) => m.round === "group_stage");
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

  // Get sorted rows for a group
  const getSortedRows = (group, groupLetter) => {
    const { picks } = WCP;
    return Object.values(group).sort((a, b) => {
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
  };

  // Render group matches for print
  const renderGroupMatches = (groups) => {
    const { matches, teamsById, picks, getTeamAbbr } = WCP;
    const container = document.getElementById("groups-container");
    const groupLetters = Object.keys(groups).sort();

    groupLetters.forEach((letter) => {
      const groupMatches = matches.filter((m) => m.group_letter === letter);

      const section = document.createElement("div");
      section.className = "group-section";

      const title = document.createElement("div");
      title.className = "group-title";
      title.textContent = `Group ${letter}`;
      section.appendChild(title);

      const table = document.createElement("table");
      table.className = "group-matches-table";

      table.innerHTML = `
        <thead>
          <tr>
            <th>Teams</th>
            <th>Date</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          ${groupMatches
            .map((match) => {
              const homeTeam = teamsById.get(match.home_team_id);
              const awayTeam = teamsById.get(match.away_team_id);
              const pick = picks[match.id] || "";
              const pickClass = pick ? `pick-${pick}` : "";
              const score = getPickScore(pick);
              const pickText = score ? `${score.home}-${score.away}` : "-";
              const date = new Date(match.scheduled_datetime).toLocaleDateString("en-US", {
                month: "2-digit",
                day: "2-digit",
              });

              return `
                <tr>
                  <td>
                    <div class="team-name">
                      <img src="${homeTeam.flag_emoji}" class="flag" alt="${homeTeam.country_code}">
                      ${getTeamAbbr(homeTeam)}
                    </div>
                    vs
                    <div class="team-name">
                      <img src="${awayTeam.flag_emoji}" class="flag" alt="${awayTeam.country_code}">
                      ${getTeamAbbr(awayTeam)}
                    </div>
                  </td>
                  <td>${date}</td>
                  <td class="pick-cell ${pickClass}">${pickText}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      `;

      section.appendChild(table);
      container.appendChild(section);
    });
  };

  // Render standings for print
  const renderStandings = (groups) => {
    const { getTeamAbbr } = WCP;
    const container = document.getElementById("standings-container");
    const groupLetters = Object.keys(groups).sort();

    groupLetters.forEach((letter) => {
      const rows = getSortedRows(groups[letter], letter);

      const box = document.createElement("div");
      box.className = "standing-box";

      const title = document.createElement("div");
      title.className = "standing-title";
      title.textContent = `Group ${letter}`;
      box.appendChild(title);

      const table = document.createElement("table");
      table.className = "standing-table";

      table.innerHTML = `
        <thead>
          <tr>
            <th>Team</th>
            <th>P</th>
            <th>W-D-L</th>
            <th>GF</th>
            <th>GA</th>
            <th>GD</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row, idx) => {
              const rowClass = idx < 2 ? "qualified" : idx === 2 ? "third" : "";
              return `
                <tr class="${rowClass}">
                  <td>
                    <div class="team-name">
                      <img src="${row.team.flag_emoji}" class="flag" alt="${row.team.country_code}">
                      ${getTeamAbbr(row.team)}
                    </div>
                  </td>
                  <td>${row.played}</td>
                  <td>${row.won}-${row.drawn}-${row.lost}</td>
                  <td>${row.gf}</td>
                  <td>${row.ga}</td>
                  <td>${row.gd > 0 ? "+" : ""}${row.gd}</td>
                  <td>${row.points}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      `;

      box.appendChild(table);
      container.appendChild(box);
    });
  };

  // Build knockout bracket for print
  const buildKnockoutBracket = (groups) => {
    const { picks } = WCP;
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

  // Render knockout bracket for print
  const renderKnockoutBracket = (bracket) => {
    const { getTeamAbbr } = WCP;
    const container = document.getElementById("bracket-container");

    const rounds = [
      { title: "Round of 32", matches: bracket.roundOf32 },
      { title: "Round of 16", matches: bracket.roundOf16 },
      { title: "Quarters", matches: bracket.quarterfinals },
      { title: "Semis", matches: bracket.semifinals },
      { title: "Final", matches: bracket.final },
    ];

    rounds.forEach((round) => {
      const roundDiv = document.createElement("div");
      roundDiv.className = "bracket-round";

      const title = document.createElement("div");
      title.className = "round-title";
      title.textContent = round.title;
      roundDiv.appendChild(title);

      round.matches.forEach((match) => {
        const matchDiv = document.createElement("div");
        matchDiv.className = "bracket-match";

        const homeTeam = match.home?.team;
        const awayTeam = match.away?.team;
        const winner = match.winner?.team;

        const homeClass = winner && homeTeam && winner.id === homeTeam.id ? "winner" : "loser";
        const awayClass = winner && awayTeam && winner.id === awayTeam.id ? "winner" : "loser";

        matchDiv.innerHTML = `
          <div class="bracket-team ${homeClass}">
            ${homeTeam ? `<img src="${homeTeam.flag_emoji}" class="flag" alt="${homeTeam.country_code}"> ${getTeamAbbr(homeTeam)}` : "TBD"}
          </div>
          <div class="bracket-team ${awayClass}">
            ${awayTeam ? `<img src="${awayTeam.flag_emoji}" class="flag" alt="${awayTeam.country_code}"> ${getTeamAbbr(awayTeam)}` : "TBD"}
          </div>
        `;

        roundDiv.appendChild(matchDiv);
      });

      container.appendChild(roundDiv);
    });

    // Add third place
    if (bracket.thirdPlace && bracket.thirdPlace.length > 0) {
      const thirdDiv = document.createElement("div");
      thirdDiv.className = "bracket-round";

      const title = document.createElement("div");
      title.className = "round-title";
      title.textContent = "Third Place";
      thirdDiv.appendChild(title);

      const match = bracket.thirdPlace[0];
      const matchDiv = document.createElement("div");
      matchDiv.className = "bracket-match";

      const homeTeam = match.home?.team;
      const awayTeam = match.away?.team;
      const winner = match.winner?.team;

      const homeClass = winner && homeTeam && winner.id === homeTeam.id ? "winner" : "loser";
      const awayClass = winner && awayTeam && winner.id === awayTeam.id ? "winner" : "loser";

      matchDiv.innerHTML = `
        <div class="bracket-team ${homeClass}">
          ${homeTeam ? `<img src="${homeTeam.flag_emoji}" class="flag" alt="${homeTeam.country_code}"> ${getTeamAbbr(homeTeam)}` : "TBD"}
        </div>
        <div class="bracket-team ${awayClass}">
          ${awayTeam ? `<img src="${awayTeam.flag_emoji}" class="flag" alt="${awayTeam.country_code}"> ${getTeamAbbr(awayTeam)}` : "TBD"}
        </div>
      `;

      thirdDiv.appendChild(matchDiv);
      container.appendChild(thirdDiv);
    }
  };

  // Render final results for print
  const renderResults = (bracket) => {
    const { getTeamAbbr } = WCP;
    const resultsBox = document.getElementById("results-box");
    const champion = bracket.final[0]?.winner?.team;
    const thirdPlaceWinner = bracket.thirdPlace[0]?.winner?.team;

    if (champion || thirdPlaceWinner) {
      resultsBox.innerHTML = `
        <div class="champion">
          ${
            champion
              ? `
            <img src="${champion.flag_emoji}" class="flag" alt="${champion.country_code}" style="width: 24px; height: 18px; margin-right: 6px;">
            CHAMPION: ${champion.name}
          `
              : "Champion: TBD"
          }
        </div>
        <div class="third-place">
          ${
            thirdPlaceWinner
              ? `
            <img src="${thirdPlaceWinner.flag_emoji}" class="flag" alt="${thirdPlaceWinner.country_code}" style="width: 16px; height: 12px; margin-right: 4px;">
            Third Place: ${thirdPlaceWinner.name}
          `
              : "Third Place: TBD"
          }
        </div>
      `;
    } else {
      resultsBox.style.display = "none";
    }
  };

  // Initialize
  const init = async () => {
    await WCP.loadData();

    // Set print date
    document.getElementById("print-date").textContent = `Printed: ${new Date().toLocaleString()}`;

    // Build and render all sections
    const groups = buildStandings();
    renderGroupMatches(groups);
    renderStandings(groups);

    const bracket = buildKnockoutBracket(groups);
    renderKnockoutBracket(bracket);
    renderResults(bracket);
  };

  init();
})();
