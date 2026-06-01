const socket = io();

// Client state variables
let myId = null;
let currentRoom = null;
let gameState = null;
let selectedCards = []; // Tracks ids of hand cards selected to play

// DOM elements references (Strictly Gameplay Arena Nodes)
const gameScreen = document.getElementById("game-screen");

const displayRoomId = document.getElementById("display-room-id");
const displayRoundNum = document.getElementById("display-round-num");
const topScoreboard = document.getElementById("top-scoreboard");
const startGameBtn = document.getElementById("start-game-btn");
const opponentsList = document.getElementById("opponents-list");
const logBox = document.getElementById("log-box");

const deckCardCount = document.getElementById("deck-card-count");
const discardPileContainer = document.getElementById("discard-pile-container");

const myHandContainer = document.getElementById("my-hand-container");
const myBadge = document.getElementById("my-badge");
const myUsernameDisplay = document.getElementById("my-username");
const myScoreDisplay = document.getElementById("my-score-display");
const turnIndicator = document.getElementById("turn-indicator");

const playBtn = document.getElementById("play-btn");
const showBtn = document.getElementById("show-btn");

const resultModal = document.getElementById("result-modal");
const modalTitle = document.getElementById("modal-title");
const modalStatus = document.getElementById("modal-status");
const modalTableBody = document.getElementById("modal-table-body");
const nextRoundBtn = document.getElementById("next-round-btn");

// Action: Start Game Click
startGameBtn.addEventListener("click", () => {
  if (currentRoom) {
    socket.emit("startGame", currentRoom);
  }
});

// Action: Play Selected Cards Click
playBtn.addEventListener("click", () => {
  if (selectedCards.length === 0 || !currentRoom) return;
  socket.emit("playCards", {
    roomId: currentRoom,
    cardIds: selectedCards,
  });
  selectedCards = [];
});

// Action: Call Show Click
showBtn.addEventListener("click", () => {
  if (
    confirm("Are you sure you want to call SHOW? All hands will be compared.")
  ) {
    socket.emit("callShow", currentRoom);
  }
});

// Action: Advance Modal/Proceed Click
nextRoundBtn.addEventListener("click", () => {
  resultModal.classList.add("hidden");
  if (gameState && gameState.status === "game_over") {
    // Redirection back to Landing Page lobby on game over
    window.location.href = "/";
  } else {
    // Round is ended — host triggers next round via dedicated event
    socket.emit("nextRound", currentRoom);
  }
});

// Listener: Connection Establish (Parameter-Based Auto-Join)
socket.on("connect", () => {
  myId = socket.id;
  console.log("Connected to arena server. ID:", myId);

  // Ingest URL credentials to trigger automatic room joining
  const urlParams = new URLSearchParams(window.location.search);
  const username = urlParams.get("username");
  const roomId = urlParams.get("room");

  if (username && roomId) {
    socket.emit("joinRoom", { username, roomId });
  } else {
    // Fallback: safe redirect to main entry page if credentials missing
    window.location.href = "/";
  }
});

// Listener: Error Messaging
socket.on("errorMsg", (msg) => {
  alert(msg);
  // Only redirect for critical errors (game already started)
  if (msg.includes("already started")) {
    window.location.href = "/";
  }
});

// Listener: Central State Synced from Server
socket.on("gameStateUpdate", (state) => {
  gameState = state;
  currentRoom = state.id;

  // Sync Header Data
  displayRoomId.textContent = state.id;
  displayRoundNum.textContent = state.roundNumber;

  // Manage Host controls visibility
  // Room host is arbitrarily the first non-eliminated player
  const hostPlayer = state.players.find((p) => !p.eliminated);
  if (hostPlayer && hostPlayer.id === myId && state.status === "lobby") {
    startGameBtn.classList.remove("hidden");
  } else {
    startGameBtn.classList.add("hidden");
  }

  // Update top scoreboard list
  updateTopScoreboard(state.players);

  // Update center field stacks
  deckCardCount.textContent = state.deckCount;
  renderTopDiscardCard(state.topDiscardCard);

  // Parse local identity values
  const me = state.players.find((p) => p.id === myId);
  const myTurnIndex = state.players.findIndex((p) => p.id === myId);
  const isMyTurn =
    state.currentTurnIndex === myTurnIndex && state.status === "playing";

  // Opponent Layout rendering
  renderOpponents(state.players, state.currentTurnIndex, state.status);

  // Sync Log box
  updateLogs(state.logs);

  // Render Client User Tray Hand
  if (me) {
    myUsernameDisplay.textContent = me.username;
    myScoreDisplay.textContent = `(${me.totalScore} Pts)`;

    if (me.eliminated) {
      myBadge.className = "player-badge eliminated";
      turnIndicator.textContent = "You have been Eliminated.";
    } else if (isMyTurn) {
      myBadge.className = "player-badge active";
      turnIndicator.textContent = "Your Turn!";
    } else {
      myBadge.className = "player-badge";
      turnIndicator.textContent = "Opponent Turn...";
    }

    renderMyHand(me.hand, isMyTurn);
  }

  // Evaluate buttons dynamic interaction rules
  updateActionControls(isMyTurn);

  // Close result modal when a new round starts (covers non-host players
  // whose modal was never dismissed by a button click)
  if (state.status === "playing") {
    resultModal.classList.add("hidden");
    selectedCards = []; // Also reset any lingering card selections
  }

  // Handle Show results display
  if (state.status === "round_end" || state.status === "game_over") {
    renderShowResultsModal(state);
  }
});

// Helper: Header scoreboard
function updateTopScoreboard(players) {
  topScoreboard.innerHTML = "";
  players.forEach((p) => {
    const badge = document.createElement("span");
    badge.className = `badge ${p.eliminated ? "eliminated" : ""}`;
    badge.innerHTML = `${p.username}: <strong>${p.totalScore}</strong>`;
    topScoreboard.appendChild(badge);
  });
}

// Helper: Discard pile render
function renderTopDiscardCard(card) {
  discardPileContainer.innerHTML = "";
  if (!card) {
    discardPileContainer.textContent = "Empty";
    discardPileContainer.className =
      "deck-stack flex items-center justify-center bg-panel border rounded text-muted";
    return;
  }

  const cardElement = createCardDOM(card, false);
  discardPileContainer.appendChild(cardElement);
}

// Helper: Build Single Card Element
function createCardDOM(card) {
  const cardDiv = document.createElement("div");

  if (card.id === "hidden") {
    cardDiv.className = "card card-back";
    return cardDiv;
  }

  const isRed = ["♥", "♦"].includes(card.suit);
  cardDiv.className = `card ${isRed ? "suit-red" : "suit-black"}`;
  cardDiv.dataset.cardId = card.id;

  cardDiv.innerHTML = `
    <div class="card-top">
      <span>${card.rank}</span>
      <span>${card.suit}</span>
    </div>
    <div class="card-suit-big">${card.suit}</div>
    <div class="card-bottom">
      <span>${card.suit}</span>
      <span>${card.rank}</span>
    </div>
  `;

  return cardDiv;
}

// Helper: Seating and opponent hand count displays
function renderOpponents(players, currentTurnIndex, status) {
  opponentsList.innerHTML = "";
  const opponents = players.filter((p) => p.id !== myId);

  opponents.forEach((p) => {
    const pIndex = players.findIndex((player) => player.id === p.id);
    const isPlayerTurn = currentTurnIndex === pIndex && status === "playing";

    const box = document.createElement("div");
    box.className = `opponent-box ${isPlayerTurn ? "turn-active" : ""} ${p.eliminated ? "eliminated" : ""}`;

    let cardsLayout = "";
    for (let i = 0; i < p.cardCount; i++) {
      cardsLayout += `<div class="card-back" style="width: 1.2rem; height: 1.8rem; border-radius: 2px; display: inline-block; margin-right: 2px;"></div>`;
    }

    box.innerHTML = `
      <div class="text-bold text-small">${p.username}</div>
      <div class="text-small text-accent font-bold">${p.totalScore} Pts</div>
      <div class="my-1 flex justify-center">${cardsLayout || (p.eliminated ? "ELIMINATED" : "0 Cards")}</div>
    `;
    opponentsList.appendChild(box);
  });
}

// Helper: Sync log scroll window
function updateLogs(logs) {
  logBox.innerHTML = "";
  logs.forEach((log) => {
    const p = document.createElement("p");
    p.className = "m-0 mb-1";
    p.textContent = log;
    logBox.appendChild(p);
  });
  logBox.scrollTop = logBox.scrollHeight;
}

// Helper: Active user card generation and selection rules
function renderMyHand(hand, isMyTurn) {
  myHandContainer.innerHTML = "";

  hand.forEach((card) => {
    const cardEl = createCardDOM(card);

    if (isMyTurn) {
      cardEl.addEventListener("click", () => {
        const cardId = card.id;
        const index = selectedCards.indexOf(cardId);

        if (index > -1) {
          selectedCards.splice(index, 1);
          cardEl.classList.remove("selected");
        } else {
          if (selectedCards.length > 0) {
            const sampleCardId = selectedCards[0];
            const sampleRank = hand.find((c) => c.id === sampleCardId).rank;
            if (card.rank !== sampleRank) {
              selectedCards.forEach((id) => {
                const el = myHandContainer.querySelector(
                  `[data-card-id="${id}"]`
                );
                if (el) el.classList.remove("selected");
              });
              selectedCards = [];
            }
          }

          selectedCards.push(cardId);
          cardEl.classList.add("selected");
        }
        updateActionControls(isMyTurn);
      });
    }

    myHandContainer.appendChild(cardEl);
  });
}

// Helper: Action Controls disabled/enabled handling
function updateActionControls(isMyTurn) {
  if (isMyTurn) {
    playBtn.disabled = selectedCards.length === 0;
    showBtn.disabled = false;
  } else {
    playBtn.disabled = true;
    showBtn.disabled = true;
    selectedCards = [];
  }
}

// Helper: Show results calculation layout
function renderShowResultsModal(state) {
  const results = state.showResults;
  if (!results) return;

  modalTableBody.innerHTML = "";
  modalTitle.textContent =
    state.status === "game_over"
      ? "🏆 Tournament Game Over!"
      : "📢 Show Results";

  if (results.isValid) {
    modalStatus.innerHTML = `✅ <strong>${results.callerUsername}</strong> called a valid show! They had the lowest score.`;
    modalStatus.className = "text-center text-primary mb-2";
  } else {
    modalStatus.innerHTML = `❌ <strong>${results.callerUsername}</strong> called a WRONG SHOW! (+30 Pts Penalty Applied)`;
    modalStatus.className = "text-center text-danger mb-2";
  }

  // Populate dynamic rows values
  results.scores.forEach((s) => {
    // Guard: player may have disconnected between show and render
    const pOrig = state.players.find((p) => p.id === s.id);
    if (!pOrig) return;

    const row = document.createElement("tr");
    const penalty = results.penalties[s.id] || 0;
    const totalScore = pOrig.totalScore;
    const isEliminated = pOrig.eliminated;

    let handHTML = (s.hand || []).map((c) => `${c.rank}${c.suit}`).join(", ") || "—";

    row.innerHTML = `
      <td><strong>${s.username}</strong> ${s.id === results.callerId ? "<span class='text-accent'>(Caller)</span>" : ""}</td>
      <td><span class="text-small text-muted">${handHTML}</span></td>
      <td>${s.handScore}</td>
      <td class="text-accent">+${penalty}</td>
      <td><strong>${totalScore} / 100</strong> ${isEliminated ? "💀" : ""}</td>
    `;
    modalTableBody.appendChild(row);
  });

  // Adjust Next Button text depending on host/tournament state
  const hostPlayer = state.players.find((p) => !p.eliminated);
  if (state.status === "game_over") {
    nextRoundBtn.textContent = "Return to Lobby";
    nextRoundBtn.className = "btn btn-danger px-2";
    nextRoundBtn.disabled = false;
  } else {
    if (hostPlayer && hostPlayer.id === myId) {
      nextRoundBtn.textContent = "Start Next Round";
      nextRoundBtn.disabled = false;
    } else {
      nextRoundBtn.textContent = "Waiting for Host...";
      nextRoundBtn.disabled = true;
    }
  }

  resultModal.classList.remove("hidden");
}

// Collapsible Logs Toggle Logic
const logsPanel = document.getElementById("logs-panel");
const toggleLogsBtn = document.getElementById("toggle-logs-btn");
const logsToggleIcon = document.getElementById("logs-toggle-icon");
const logBoxElement = document.getElementById("log-box");

if (toggleLogsBtn && logsPanel && logsToggleIcon) {
  toggleLogsBtn.addEventListener("click", () => {
    const isCollapsed = logsPanel.classList.contains("collapsed");
    if (isCollapsed) {
      logsPanel.classList.remove("collapsed");
      logsToggleIcon.textContent = "▼";
      // Auto-scroll to bottom after opening
      setTimeout(() => {
        if (logBoxElement) {
          logBoxElement.scrollTop = logBoxElement.scrollHeight;
        }
      }, 150);
    } else {
      logsPanel.classList.add("collapsed");
      logsToggleIcon.textContent = "▲";
    }
  });
}

