const socket = io();

let selectedRoomId = null;
let dashboardData = null;
let roomCache = {};

// ======================================
// LOGIN ELEMENTS
// ======================================

const loginScreen = document.getElementById("admin-login-screen");

const dashboard = document.getElementById("admin-dashboard");

const loginForm = document.getElementById("admin-login-form");

const usernameInput = document.getElementById("admin-username");

const passwordInput = document.getElementById("admin-password");

const loginError = document.getElementById("admin-login-error");

// ======================================
// METRICS
// ======================================

const serverStatus = document.getElementById("server-status");

const totalRooms = document.getElementById("total-rooms");

const totalPlayers = document.getElementById("total-players");

const metricRooms = document.getElementById("metric-rooms");

const metricPlayers = document.getElementById("metric-players");

const metricPlaying = document.getElementById("metric-playing");

const metricLobby = document.getElementById("metric-lobby");

// ======================================
// TABLES
// ======================================

const roomsTableBody = document.getElementById("rooms-table-body");

const playersTableBody = document.getElementById("players-table-body");

const leaderboardBody = document.getElementById("leaderboard-body");

const selectedRoomInfo = document.getElementById("selected-room-info");

// ======================================
// LOGIN
// ======================================

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();

  socket.emit("adminLogin", {
    username: usernameInput.value.trim(),
    password: passwordInput.value.trim(),
  });
});

socket.on("adminLoginSuccess", () => {
  loginScreen.classList.add("hidden");

  dashboard.classList.remove("hidden");

  socket.emit("adminDashboardRequest");
});

socket.on("adminLoginFailed", (data) => {
  loginError.textContent = data.message || "Authentication Failed";
});

// ======================================
// DASHBOARD DATA
// ======================================

socket.on("adminDashboardUpdate", (payload) => {
  dashboardData = payload;

  renderMetrics(payload);

  renderRooms(payload.rooms);
});

// ======================================
// ROOM DETAILS
// ======================================

socket.on("adminRoomStateUpdate", (roomState) => {
  roomCache[roomState.roomId] = roomState;

  if (selectedRoomId === roomState.roomId) {
    renderRoomDetails(roomState);

    renderPlayers(roomState);

    renderLeaderboard(roomState);
  }
});

// ======================================
// METRICS
// ======================================

function renderMetrics(data) {
  serverStatus.textContent = data.serverStatus;

  totalRooms.textContent = data.totalRooms;

  totalPlayers.textContent = data.totalPlayers;

  metricRooms.textContent = data.totalRooms;

  metricPlayers.textContent = data.totalPlayers;

  metricPlaying.textContent = data.rooms.filter(
    (r) => r.status === "playing",
  ).length;

  metricLobby.textContent = data.rooms.filter(
    (r) => r.status === "lobby",
  ).length;
}

// ======================================
// ROOMS TABLE
// ======================================

function renderRooms(rooms) {
  roomsTableBody.innerHTML = "";

  rooms.forEach((room) => {
    const row = document.createElement("tr");

    row.style.cursor = "pointer";

    row.innerHTML = `
      <td>
        <strong>${room.roomId}</strong>
      </td>

      <td>
        ${buildStatusBadge(room.status)}
      </td>

      <td>
        ${room.roundNumber}
      </td>

      <td>
        ${room.currentTurnPlayer}
      </td>

      <td>
        ${room.connectedPlayers}
      </td>

      <td>
        ${room.deckCount}
      </td>

      <td>
        ${room.lastPlayRank || "-"}
      </td>
    `;

    row.addEventListener("click", () => {
      selectedRoomId = room.roomId;

      socket.emit("adminRoomStateRequest", room.roomId);

      highlightSelectedRoom(room.roomId);
    });

    row.dataset.roomId = room.roomId;

    roomsTableBody.appendChild(row);
  });
}

// ======================================
// ROOM DETAILS
// ======================================

function renderRoomDetails(room) {
  const discardCards = room.discardPile
    .map((card) => `${card.rank}${card.suit}`)
    .join(" , ");

  selectedRoomInfo.innerHTML = `
  
    <div class="grid"
         style="
         display:grid;
         grid-template-columns:
         repeat(auto-fit,minmax(220px,1fr));
         gap:1rem">

      <div>

        <h3 class="text-gold">
          Room Information
        </h3>

        <p>
          Room ID:
          <strong>
            ${room.roomId}
          </strong>
        </p>

        <p>
          Status:
          <strong>
            ${room.status}
          </strong>
        </p>

        <p>
          Round:
          <strong>
            ${room.roundNumber}
          </strong>
        </p>

        <p>
          Turn:
          <strong>
            ${room.currentTurnPlayer}
          </strong>
        </p>

        <p>
          Deck:
          <strong>
            ${room.deckCount}
          </strong>
        </p>

        <p>
          Last Rank:
          <strong>
            ${room.lastPlayRank || "-"}
          </strong>
        </p>

      </div>

      <div>

        <h3 class="text-gold">
          Discard Pile
        </h3>

        <div
          style="
          max-height:220px;
          overflow:auto">
          ${discardCards}
        </div>

      </div>

      <div>

        <h3 class="text-gold">
          Room Logs
        </h3>

        <div
          style="
          max-height:220px;
          overflow:auto">

          ${room.logs
            .slice()
            .reverse()
            .map((log) => `<div>${log}</div>`)
            .join("")}

        </div>

      </div>

    </div>
  `;
}

// ======================================
// PLAYERS TABLE
// ======================================

function renderPlayers(room) {
  playersTableBody.innerHTML = "";

  room.players.forEach((player) => {
    const handCards = player.hand
      .map((card) => `${card.rank}${card.suit}`)
      .join(" ");

    const row = document.createElement("tr");

    row.innerHTML = `
      
        <td>
          ${player.username}
        </td>

        <td>
          ${player.socketId}
        </td>

        <td>
          ${player.handScore}
        </td>

        <td>
          ${player.totalScore}
        </td>

        <td>
          ${player.isCurrentTurn ? "🎯" : "-"}
        </td>

        <td>
          ${player.eliminated ? "💀 Eliminated" : "✅ Active"}
        </td>

        <td>
          ${handCards}
        </td>
      `;

    playersTableBody.appendChild(row);
  });
}

// ======================================
// LEADERBOARD
// ======================================

function renderLeaderboard(room) {
  leaderboardBody.innerHTML = "";

  const sortedPlayers = [...room.players].sort(
    (a, b) => a.totalScore - b.totalScore,
  );

  sortedPlayers.forEach((player, index) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      
        <td>
          ${index + 1}
        </td>

        <td>
          ${player.username}
        </td>

        <td>
          ${player.handScore}
        </td>

        <td>
          ${player.totalScore}
        </td>

        <td>
          ${player.eliminated ? "YES" : "NO"}
        </td>
      `;

    leaderboardBody.appendChild(row);
  });
}

// ======================================
// STATUS BADGES
// ======================================

function buildStatusBadge(status) {
  switch (status) {
    case "playing":
      return `
        <span
        class="badge"
        style="
        background:#10b981;
        color:white">
          Playing
        </span>
      `;

    case "lobby":
      return `
        <span
        class="badge"
        style="
        background:#3b82f6;
        color:white">
          Lobby
        </span>
      `;

    case "round_end":
      return `
        <span
        class="badge"
        style="
        background:#f59e0b;
        color:white">
          Round End
        </span>
      `;

    case "game_over":
      return `
        <span
        class="badge"
        style="
        background:#ef4444;
        color:white">
          Game Over
        </span>
      `;

    default:
      return status;
  }
}

// ======================================
// HIGHLIGHT ROOM
// ======================================

function highlightSelectedRoom(roomId) {
  document.querySelectorAll("#rooms-table-body tr").forEach((row) => {
    row.style.background = "";

    if (row.dataset.roomId === roomId) {
      row.style.background = "rgba(212,175,55,0.15)";
    }
  });
}

// ======================================
// CONNECTION STATE
// ======================================

socket.on("connect", () => {
  console.log("Admin Connected:", socket.id);
});

socket.on("disconnect", () => {
  console.log("Admin Disconnected");
});
