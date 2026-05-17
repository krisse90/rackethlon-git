/* Rackethlon — simplified app logic */
(function () {
  "use strict";

  const STORAGE_KEY = "rackethlon_state_v1";
  const SESSION_KEY = "rackethlon_session_v1";
  const SPORTS = ["Tennis", "Squash", "Table Tennis", "Badminton"];

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function defaultState() {
    return {
      tournament: {
        name: "Spring Open 2026",
        format: "Round Robin",
        maxPoints: 21,
        sportSettings: {
          Tennis: { course: "Court 1", time: "10:00", duration: 60 },
          Squash: { course: "Court 2", time: "11:00", duration: 50 },
          "Table Tennis": { course: "Table 1", time: "12:00", duration: 40 },
          Badminton: { course: "Court 3", time: "13:00", duration: 55 },
        },
      },
      players: [
        { id: uid(), name: "Alex Carter" },
        { id: uid(), name: "Mia Chen" },
        { id: uid(), name: "Jordan Diaz" },
        { id: uid(), name: "Sam Patel" },
      ],
      matches: [],
      sipuli: { playerId: null, comment: "" },
    };
  }

  function normalizeState(state) {
    const defaults = defaultState();
    state.tournament = state.tournament || defaults.tournament;
    state.tournament.sportSettings = state.tournament.sportSettings || defaults.tournament.sportSettings;
    SPORTS.forEach((sport) => {
      const defaultSport = defaults.tournament.sportSettings[sport];
      if (!state.tournament.sportSettings[sport]) {
        state.tournament.sportSettings[sport] = defaultSport;
      } else {
        state.tournament.sportSettings[sport].course = state.tournament.sportSettings[sport].course || defaultSport.course;
        state.tournament.sportSettings[sport].time = state.tournament.sportSettings[sport].time || defaultSport.time;
        state.tournament.sportSettings[sport].duration = state.tournament.sportSettings[sport].duration || defaultSport.duration;
      }
    });
    state.players = Array.isArray(state.players) ? state.players : defaults.players;
    state.matches = Array.isArray(state.matches) ? state.matches : [];
    state.sipuli = state.sipuli || defaults.sipuli;
    return state;
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const state = normalizeState(defaultState());
      seedMatches(state);
      saveState(state);
      return state;
    }
    try {
      const parsed = normalizeState(JSON.parse(raw));
      saveState(parsed);
      return parsed;
    } catch (e) {
      const state = normalizeState(defaultState());
      saveState(state);
      return state;
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(playerId) {
    if (playerId) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ playerId }));
    else sessionStorage.removeItem(SESSION_KEY);
  }

  function playerById(state, id) {
    return state.players.find((player) => player.id === id);
  }

  function formatRange(start, duration) {
    const [hour, minute] = (start || "00:00").split(":").map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return "00:00-00:00";
    const end = new Date();
    end.setHours(hour);
    end.setMinutes(minute + Number(duration || 0));
    const endHour = String(end.getHours()).padStart(2, "0");
    const endMinute = String(end.getMinutes()).padStart(2, "0");
    return `${start}-${endHour}:${endMinute}`;
  }

  function seedMatches(state) {
    const players = state.players;
    if (players.length < 2) return;
    for (let i = 0; i < players.length; i += 1) {
      for (let j = i + 1; j < players.length; j += 1) {
        SPORTS.forEach((sport) => {
          const settings = state.tournament.sportSettings[sport] || { course: `${sport} court`, time: "10:00", duration: 60 };
          state.matches.push({
            id: uid(),
            p1: players[i].id,
            p2: players[j].id,
            s1: null,
            s2: null,
            status: "scheduled",
            submittedBy: null,
            createdAt: Date.now(),
            sport,
            course: settings.course,
            time: settings.time,
            duration: settings.duration,
          });
        });
      }
    }
  }

  function computeRankings(state) {
    const totals = {};
    state.players.forEach((player) => {
      totals[player.id] = { id: player.id, name: player.name, played: 0, wins: 0, losses: 0, draws: 0, pf: 0, pa: 0, points: 0 };
    });
    state.matches.forEach((match) => {
      if (match.status !== "confirmed" || match.s1 == null || match.s2 == null) return;
      const p1 = totals[match.p1];
      const p2 = totals[match.p2];
      if (!p1 || !p2) return;
      p1.played += 1;
      p2.played += 1;
      p1.pf += match.s1;
      p1.pa += match.s2;
      p2.pf += match.s2;
      p2.pa += match.s1;
      if (match.s1 > match.s2) {
        p1.wins += 1;
        p1.points += 3;
        p2.losses += 1;
      } else if (match.s2 > match.s1) {
        p2.wins += 1;
        p2.points += 3;
        p1.losses += 1;
      } else {
        p1.draws += 1;
        p2.draws += 1;
        p1.points += 1;
        p2.points += 1;
      }
    });
    return Object.values(totals).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const diffA = a.pf - a.pa;
      const diffB = b.pf - b.pa;
      if (diffB !== diffA) return diffB - diffA;
      return b.wins - a.wins;
    });
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function showToast(message, type) {
    const wrap = document.querySelector(".toast-wrap") || document.body.appendChild(Object.assign(document.createElement("div"), { className: "toast-wrap" }));
    const notice = document.createElement("div");
    notice.className = "toast " + (type || "");
    notice.textContent = message;
    wrap.appendChild(notice);
    setTimeout(() => { notice.style.opacity = "0"; }, 2600);
    setTimeout(() => notice.remove(), 3000);
  }

  function initNavbar() {
    const current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    document.querySelectorAll(".nav-links a").forEach((link) => {
      const href = (link.getAttribute("href") || "").toLowerCase();
      if (href === current || (current === "" && href === "index.html")) link.classList.add("active");
    });
    const navToggle = document.querySelector(".nav-toggle");
    const navLinks = document.querySelector(".nav-links");
    if (navToggle && navLinks) navToggle.addEventListener("click", () => navLinks.classList.toggle("open"));
    renderSessionBadge();
  }

  function renderSessionBadge() {
    const badge = document.querySelector(".nav-user");
    if (!badge) return;
    const session = getSession();
    const state = loadState();
    const player = session ? playerById(state, session.playerId) : null;
    if (player) {
      badge.innerHTML = `<span class="dot"></span> ${escapeHtml(player.name)}`;
    } else {
      badge.innerHTML = '<span class="dot dot-guest"></span> Guest';
    }
  }

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      if (typeof window.renderPage === "function") window.renderPage();
      renderSessionBadge();
    }
  });

  function renderMatchCard(state, match, actionsEnabled) {
    const player1 = playerById(state, match.p1);
    const player2 = playerById(state, match.p2);
    if (!player1 || !player2) return "";
    const session = getSession();
    const isPlayer = session && (session.playerId === match.p1 || session.playerId === match.p2);
    const isOpponent = session && match.status === "pending" && match.submittedBy && match.submittedBy !== session.playerId && isPlayer;
    const isSubmitter = session && match.status === "pending" && match.submittedBy === session.playerId;
    const score1 = match.s1 == null ? "–" : match.s1;
    const score2 = match.s2 == null ? "–" : match.s2;
    const timeRange = formatRange(match.time, match.duration);
    const sportIcon = { Tennis: "🎾", Squash: "🎱", "Table Tennis": "🏓", Badminton: "🏸" }[match.sport] || "🎾";

    let actions = "";
    if (actionsEnabled) {
      const list = [];
      if (isPlayer && (match.status === "scheduled" || match.status === "disputed")) {
        list.push(`<button class="btn btn-sm btn-primary" data-act="enter" data-id="${match.id}">Enter score</button>`);
      }
      if (isOpponent) {
        list.push(`<button class="btn btn-sm btn-success" data-act="confirm" data-id="${match.id}">Confirm</button>`);
        list.push(`<button class="btn btn-sm btn-danger" data-act="reject" data-id="${match.id}">Reject</button>`);
      }
      if (isSubmitter) list.push(`<span class="helper">Waiting for opponent…</span>`);
      if (!session) list.push(`<a class="btn btn-sm btn-ghost" href="login.html">Sign in to participate</a>`);
      actions = list.join("");
    }

    return `
      <article class="match">
        <div class="match-side">
          <span class="player">${escapeHtml(player1.name)}</span>
          <span class="score">${score1}</span>
        </div>
        <div class="match-vs">VS</div>
        <div class="match-side right">
          <span class="player">${escapeHtml(player2.name)}</span>
          <span class="score">${score2}</span>
        </div>
        <div class="match-foot">
          <div class="match-badges">
            <span class="badge sport-badge">${sportIcon} ${escapeHtml(match.sport)}</span>
            <span class="badge">${escapeHtml(match.course)}</span>
            <span class="badge">${timeRange}</span>
            <span class="badge">${match.duration} min</span>
            <span class="badge ${match.status}">${match.status}</span>
          </div>
          ${actions ? `<div class="match-actions">${actions}</div>` : ""}
        </div>
      </article>`;
  }

  function bindMatchActions(container) {
    container.querySelectorAll("button[data-act]").forEach((button) => {
      button.addEventListener("click", () => {
        const state = loadState();
        const match = state.matches.find((m) => m.id === button.dataset.id);
        if (!match) return;
        const session = getSession();
        if (!session) { showToast("Please sign in first", "error"); return; }

        if (button.dataset.act === "enter") {
          const maxPoints = state.tournament.maxPoints || 21;
          const isLeft = session.playerId === match.p1;
          const yourScore = parseInt(prompt(`Enter your score (${isLeft ? "left" : "right"}):`, isLeft ? match.s1 || "0" : match.s2 || "0"), 10);
          if (Number.isNaN(yourScore) || yourScore < 0 || yourScore > maxPoints) { showToast(`Score must be 0-${maxPoints}`, "error"); return; }
          const opponentScore = parseInt(prompt(`Enter opponent score (winner must reach ${maxPoints}):`, isLeft ? match.s2 || "0" : match.s1 || "0"), 10);
          if (Number.isNaN(opponentScore) || opponentScore < 0 || opponentScore > maxPoints) { showToast(`Score must be 0-${maxPoints}`, "error"); return; }
          const left = isLeft ? yourScore : opponentScore;
          const right = isLeft ? opponentScore : yourScore;
          const leftWins = left === maxPoints && right < maxPoints;
          const rightWins = right === maxPoints && left < maxPoints;
          if (!leftWins && !rightWins) { showToast(`One side must score ${maxPoints} and the other less`, "error"); return; }
          match.s1 = left;
          match.s2 = right;
          match.status = "pending";
          match.submittedBy = session.playerId;
          saveState(state);
          showToast(`Score submitted ${left}:${right}`, "success");
        } else if (button.dataset.act === "confirm") {
          match.status = "confirmed";
          saveState(state);
          showToast("Score confirmed", "success");
        } else if (button.dataset.act === "reject") {
          match.status = "disputed";
          match.s1 = null;
          match.s2 = null;
          match.submittedBy = null;
          saveState(state);
          showToast("Score rejected", "error");
        }
        if (typeof window.renderPage === "function") window.renderPage();
      });
    });
  }

  function initIndex() {
    const state = loadState();
    const stats = document.getElementById("stats");
    if (stats) {
      const played = state.matches.filter((m) => m.status === "confirmed").length;
      stats.innerHTML = `
        <div class="hero-stat"><div class="num">${state.players.length}</div><div class="label">Players</div></div>
        <div class="hero-stat"><div class="num">${state.matches.length}</div><div class="label">Matches</div></div>
        <div class="hero-stat"><div class="num">${played}</div><div class="label">Played</div></div>`;
    }
    const upcoming = document.getElementById("upcoming");
    if (upcoming) {
      const list = state.matches.filter((m) => m.status !== "confirmed").slice(0, 4);
      upcoming.innerHTML = list.length ? list.map((m) => renderMatchCard(state, m, false)).join("") : '<div class="empty"><div class="em">🎾</div>No upcoming matches.</div>';
    }
    const name = document.getElementById("tournament-name");
    if (name) name.textContent = state.tournament.name;
  }

  function initTournament() {
    const state = loadState();
    const form = document.getElementById("tournament-form");
    const playersList = document.getElementById("players-list");
    const playerForm = document.getElementById("add-player-form");
    const generateButton = document.getElementById("generate-matches");
    const clearButton = document.getElementById("clear-matches");

    if (form) {
      form.elements["t-name"].value = state.tournament.name;
      form.elements["t-format"].value = state.tournament.format;
      form.elements["t-max-points"].value = state.tournament.maxPoints;
      SPORTS.forEach((sport) => {
        const defaultSport = defaultState().tournament.sportSettings[sport];
        const settings = state.tournament.sportSettings[sport] || defaultSport;
        const key = sport.toLowerCase().replace(/ /g, "-");
        form.elements[`t-${key}-course`].value = settings.course;
        form.elements[`t-${key}-time`].value = settings.time;
        form.elements[`t-${key}-duration`].value = settings.duration;
      });
    }

    function renderPlayers() {
      const state2 = loadState();
      if (!playersList) return;
      if (!state2.players.length) {
        playersList.innerHTML = '<p class="helper">No players yet — add some below.</p>';
        return;
      }
      playersList.innerHTML = state2.players.map((player) => `
        <span class="player-chip">${escapeHtml(player.name)} <button data-id="${player.id}" aria-label="Remove">×</button></span>
      `).join("");
      playersList.querySelectorAll("button[data-id]").forEach((button) => {
        button.addEventListener("click", () => {
          const state3 = loadState();
          state3.players = state3.players.filter((p) => p.id !== button.dataset.id);
          state3.matches = state3.matches.filter((m) => m.p1 !== button.dataset.id && m.p2 !== button.dataset.id);
          saveState(state3);
          renderPlayers();
          showToast("Player removed", "success");
        });
      });
    }

    if (playersList) renderPlayers();

    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const current = loadState();
        const maxPoints = parseInt(form.elements["t-max-points"].value, 10) || 1;
        const sportSettings = {};
        SPORTS.forEach((sport) => {
          const key = sport.toLowerCase().replace(/ /g, "-");
          sportSettings[sport] = {
            course: form.elements[`t-${key}-course`].value.trim() || `${sport} court`,
            time: form.elements[`t-${key}-time`].value || "10:00",
            duration: Number(form.elements[`t-${key}-duration`].value) || 60,
          };
        });
        current.tournament.name = form.elements["t-name"].value.trim() || "Untitled Tournament";
        current.tournament.format = form.elements["t-format"].value;
        current.tournament.maxPoints = Math.max(1, maxPoints);
        current.tournament.sportSettings = sportSettings;
        current.matches.forEach((match) => {
          const settings = sportSettings[match.sport];
          match.course = settings.course;
          match.time = settings.time;
          match.duration = settings.duration;
        });
        saveState(current);
        showToast("Tournament saved", "success");
      });
    }

    if (playerForm) {
      playerForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = playerForm.elements["p-name"].value.trim();
        if (!name) return;
        const current = loadState();
        if (current.players.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
          showToast("Player already exists", "error");
          return;
        }
        current.players.push({ id: uid(), name });
        saveState(current);
        playerForm.elements["p-name"].value = "";
        renderPlayers();
        showToast("Player added", "success");
      });
    }

    if (generateButton) {
      generateButton.addEventListener("click", () => {
        const state2 = loadState();
        if (state2.players.length < 2) { showToast("Need at least 2 players", "error"); return; }
        state2.matches = [];
        seedMatches(state2);
        saveState(state2);
        showToast(`${state2.matches.length} matches generated`, "success");
      });
    }

    if (clearButton) {
      clearButton.addEventListener("click", () => {
        const state2 = loadState();
        state2.matches = [];
        saveState(state2);
        showToast("Matches cleared", "success");
      });
    }
  }

  function initLogin() {
    const form = document.getElementById("login-form");
    const suggestions = document.getElementById("suggestions");
    const current = document.getElementById("current-player");
    const logout = document.getElementById("logout-btn");

    function refresh() {
      const state = loadState();
      const session = getSession();
      const player = session ? playerById(state, session.playerId) : null;
      if (player) {
        current.innerHTML = `Signed in as <strong>${escapeHtml(player.name)}</strong>`;
        logout.style.display = "inline-flex";
      } else {
        current.textContent = "No active session.";
        logout.style.display = "none";
      }
      if (suggestions) {
        suggestions.innerHTML = state.players.map((player) => `
          <button type="button" class="chip" data-name="${escapeHtml(player.name)}">${escapeHtml(player.name)}</button>
        `).join("");
        suggestions.querySelectorAll("button").forEach((button) => {
          button.addEventListener("click", () => {
            form.elements["l-name"].value = button.dataset.name;
          });
        });
      }
    }

    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = form.elements["l-name"].value.trim();
        if (!name) return;
        const state = loadState();
        let player = state.players.find((item) => item.name.toLowerCase() === name.toLowerCase());
        if (!player) {
          player = { id: uid(), name };
          state.players.push(player);
          saveState(state);
        }
        setSession(player.id);
        renderSessionBadge();
        refresh();
        showToast(`Welcome, ${player.name}!`, "success");
      });
    }

    if (logout) {
      logout.addEventListener("click", () => {
        setSession(null);
        renderSessionBadge();
        refresh();
        showToast("Signed out", "success");
      });
    }

    refresh();
  }

  function initMatches() {
    const matchesContainer = document.getElementById("matches");
    const filters = document.querySelectorAll(".chip[data-filter]");
    const sportFilters = document.querySelectorAll(".chip.sport-filter");
    let statusFilter = "all";
    let sportFilter = "all";

    function render() {
      const state = loadState();
      let matches = state.matches.slice();
      if (statusFilter !== "all") matches = matches.filter((m) => m.status === statusFilter);
      if (sportFilter !== "all") matches = matches.filter((m) => m.sport === sportFilter);
      matchesContainer.innerHTML = matches.length ? matches.map((match) => renderMatchCard(state, match, true)).join("") : '<div class="empty"><div class="em">📋</div>No matches in this view.</div>';
      bindMatchActions(matchesContainer);
    }

    filters.forEach((button) => {
      button.addEventListener("click", () => {
        filters.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        statusFilter = button.dataset.filter;
        render();
      });
    });

    sportFilters.forEach((button) => {
      button.addEventListener("click", () => {
        sportFilters.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        sportFilter = button.dataset.sport;
        render();
      });
    });

    window.renderPage = render;
    render();
  }

  function initRankings() {
    const container = document.getElementById("rankings-table");
    function render() {
      const state = loadState();
      const ranking = computeRankings(state);
      if (!ranking.length) {
        container.innerHTML = '<div class="empty"><div class="em">🏆</div>No players yet.</div>';
        return;
      }
      const sipuli = state.sipuli || { playerId: null, comment: "" };
      container.innerHTML = `
        <div class="table-wrap"><table class="table">
          <thead><tr><th>#</th><th>Player</th><th>P</th><th>W</th><th>D</th><th>L</th><th>PF</th><th>PA</th><th>Pts</th><th>Sipulipalkinto</th><th>Comment</th></tr></thead>
          <tbody>${ranking.map((player, index) => {
            const selected = sipuli.playerId === player.id;
            return `
              <tr>
                <td><span class="rank-pos ${index===0?"top1":index===1?"top2":index===2?"top3":""}">${index+1}</span></td>
                <td>${escapeHtml(player.name)}</td>
                <td>${player.played}</td><td>${player.wins}</td><td>${player.draws}</td><td>${player.losses}</td>
                <td>${player.pf}</td><td>${player.pa}</td><td><strong>${player.points}</strong></td>
                <td><label class="sipuli-label"><input type="radio" name="sipuli" data-id="${player.id}" ${selected ? "checked" : ""} /> Nominate</label></td>
                <td><input class="sipuli-comment" type="text" data-id="${player.id}" value="${selected ? escapeHtml(sipuli.comment) : ""}" ${selected ? "" : "disabled"} placeholder="Why this player?" /></td>
              </tr>`;
          }).join("")}</tbody>
        </table></div>`;
      container.querySelectorAll("input[name='sipuli']").forEach((radio) => {
        radio.addEventListener("change", () => {
          const state2 = loadState();
          state2.sipuli.playerId = radio.dataset.id;
          state2.sipuli.comment = "";
          saveState(state2);
          render();
          const selectedInput = container.querySelector(`.sipuli-comment[data-id="${radio.dataset.id}"]`);
          if (selectedInput) selectedInput.focus();
        });
      });
      container.querySelectorAll(".sipuli-comment").forEach((input) => {
        input.addEventListener("input", () => {
          const state2 = loadState();
          if (state2.sipuli.playerId === input.dataset.id) {
            state2.sipuli.comment = input.value;
            saveState(state2);
          }
        });
      });
    }
    render();
  }

  function initPage() {
    initNavbar();
    const page = document.body.dataset.page;
    if (page === "index") initIndex();
    if (page === "tournament") initTournament();
    if (page === "matches") initMatches();
    if (page === "rankings") initRankings();
    if (page === "login") initLogin();
  }

  document.addEventListener("DOMContentLoaded", initPage);
})();
