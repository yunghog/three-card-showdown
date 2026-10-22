const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(express.static(path.join(__dirname, "public")));
// ===============================
// ADMIN CONFIGURATION
// ===============================

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "threecardadmin";

const adminSockets = new Set();

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Game State Storage
const rooms = {};

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

// Helper: Create a standard 52-card deck
function createDeck() {
  let deck = [];
  for (let suit of SUITS) {
    for (let rank of RANKS) {
      let score = 0;
      if (rank === "A") score = 1;
      else if (["J", "Q", "K"].includes(rank)) score = 10;
      else score = parseInt(rank, 10);

      deck.push({
        id: `${rank}-${suit}`,
        suit,
        rank,
        score,
      });
    }
  }
  return deck;
}

// Helper: Shuffle deck (Fisher-Yates)
function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Helper: Calculate total score of a hand of cards
function calculateHandScore(hand) {
  return hand.reduce((sum, card) => sum + card.score, 0);
}

// ===============================
// ADMIN HELPERS
// ===============================

function getCurrentTurnPlayer(room) {
  return room.players[room.currentTurnIndex]
    ? room.players[room.currentTurnIndex].username
    : "N/A";
}

function buildAdminDashboardData() {
  const roomList = Object.values(rooms);

  return {
    serverStatus: "ONLINE",

    totalRooms: roomList.length,

    totalPlayers: roomList.reduce(
      (total, room) => total + room.players.length,
      0,
    ),

    rooms: roomList.map((room) => ({
      roomId: room.id,

      status: room.status,

      roundNumber: room.roundNumber,

      currentTurnPlayer: getCurrentTurnPlayer(room),

      connectedPlayers: room.players.length,

      eliminatedPlayers: room.players.filter((p) => p.eliminated).length,

      deckCount: room.deck.length,

      lastPlayRank: room.lastPlayRank || "-",
    })),
  };
}

function buildAdminRoomState(room) {
  return {
    roomId: room.id,

    status: room.status,

    roundNumber: room.roundNumber,

    currentTurnPlayer: getCurrentTurnPlayer(room),

    currentTurnIndex: room.currentTurnIndex,

    deckCount: room.deck.length,

    lastPlayRank: room.lastPlayRank,

    topDiscardCard: room.discardPile[room.discardPile.length - 1] || null,

    discardPile: room.discardPile,

    logs: room.logs,

    players: room.players.map((player) => ({
      socketId: player.id,

      username: player.username,

      totalScore: player.totalScore,

      handScore: calculateHandScore(player.hand),

      activeInRound: player.activeInRound,

      eliminated: player.eliminated,

      isCurrentTurn: room.players[room.currentTurnIndex]?.id === player.id,

      hand: player.hand,
    })),
  };
}

function broadcastAdminDashboard() {
  const payload = buildAdminDashboardData();

  adminSockets.forEach((socketId) => {
    io.to(socketId).emit("adminDashboardUpdate", payload);
  });
}

function broadcastAdminRoomUpdates() {
  adminSockets.forEach((socketId) => {
    const dashboardPayload = buildAdminDashboardData();

    io.to(socketId).emit("adminDashboardUpdate", dashboardPayload);

    Object.values(rooms).forEach((room) => {
      io.to(socketId).emit("adminRoomStateUpdate", buildAdminRoomState(room));
    });
  });
}

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  // =====================================
  // ADMIN LOGIN
  // =====================================

  socket.on("adminLogin", ({ username, password }) => {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      adminSockets.add(socket.id);

      socket.emit("adminLoginSuccess", {
        success: true,
      });

      socket.emit("adminDashboardUpdate", buildAdminDashboardData());

      Object.values(rooms).forEach((room) => {
        socket.emit("adminRoomStateUpdate", buildAdminRoomState(room));
      });

      console.log(`Admin authenticated: ${socket.id}`);
    } else {
      socket.emit("adminLoginFailed", {
        success: false,
        message: "Invalid credentials",
      });
    }
  });

  // =====================================
  // ADMIN DASHBOARD REQUEST
  // =====================================

  socket.on("adminDashboardRequest", () => {
    if (!adminSockets.has(socket.id)) return;

    socket.emit("adminDashboardUpdate", buildAdminDashboardData());
  });

  // =====================================
  // ROOM DETAILS REQUEST
  // =====================================

  socket.on("adminRoomStateRequest", (roomId) => {
    if (!adminSockets.has(socket.id)) return;

    const room = rooms[roomId];

    if (!room) return;

    socket.emit("adminRoomStateUpdate", buildAdminRoomState(room));
  });
  // Create or Join Room
  socket.on("joinRoom", ({ username, roomId }) => {
    if (!username || !roomId) return;

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        id: roomId,
        players: [],
        status: "lobby", // lobby, playing, round_end, game_over
        deck: [],
        discardPile: [],
        lastPlayRank: null, // Rank of the card(s) discarded by the previous player
        currentTurnIndex: 0,
        logs: [],
        roundNumber: 1,
      };
    }

    const room = rooms[roomId];

    // Prevent joining if game is already over
    if (room.status === "game_over") {
      socket.emit("errorMsg", "Game has already ended in this room.");
      return;
    }

    const isRunning = room.status !== "lobby";

    // Add player to room
    const player = {
      id: socket.id,
      username: username,
      hand: [],
      totalScore: isRunning ? 15 * room.roundNumber : 0,
      eliminated: false,
      activeInRound: false,
    };
    room.players.push(player);

    logToRoom(room, `${username} joined the room.`);
    updateRoomState(roomId);
    broadcastAdminRoomUpdates();
  });

  // Start Game (first round only, from lobby)
  socket.on("startGame", (roomId) => {
    const room = rooms[roomId];
    if (!room || room.status !== "lobby") return;
    if (room.players.length < 2) {
      socket.emit("errorMsg", "Need at least 2 players to start.");
      return;
    }

    room.status = "playing";
    room.roundNumber = 1;
    room.roundStarterIndex = 0;

    // Reset all scores for new tournament
    room.players.forEach((p) => {
      p.totalScore = 0;
      p.eliminated = false;
    });

    startNewRound(room);
    broadcastAdminRoomUpdates();
  });

  // Next Round (from round_end, host triggers next round of same tournament)
  socket.on("nextRound", (roomId) => {
    const room = rooms[roomId];
    if (!room || room.status !== "round_end") return;

    // Only the first non-eliminated player (host) can advance
    const host = room.players.find((p) => !p.eliminated);
    if (!host || host.id !== socket.id) {
      socket.emit("errorMsg", "Only the host can start the next round.");
      return;
    }

    startNewRound(room);
    broadcastAdminRoomUpdates();
  });

  // Play Cards Turn Action
  socket.on("playCards", ({ roomId, cardIds }) => {
    const room = rooms[roomId];
    if (!room || room.status !== "playing") return;

    const player = room.players[room.currentTurnIndex];
    if (player.id !== socket.id) {
      socket.emit("errorMsg", "It is not your turn!");
      return;
    }

    // Validate if player actually owns these cards
    const cardsToPlay = player.hand.filter((c) => cardIds.includes(c.id));
    if (cardsToPlay.length !== cardIds.length || cardIds.length === 0) {
      socket.emit("errorMsg", "Invalid card selection.");
      return;
    }

    // Validate that all cards being played are of the identical rank (multiple-drop rule)
    const firstRank = cardsToPlay[0].rank;
    const allSameRank = cardsToPlay.every((c) => c.rank === firstRank);
    if (!allSameRank) {
      socket.emit("errorMsg", "All selected cards must be of the same rank.");
      return;
    }

    // Execute Play Action
    // Remove played cards from hand
    player.hand = player.hand.filter((c) => !cardIds.includes(c.id));

    // Get current state of top discard card before pushing new play
    const topDiscardCardBefore = room.discardPile[room.discardPile.length - 1];

    // Evaluate matching criteria
    const matchesTopDiscard =
      topDiscardCardBefore && firstRank === topDiscardCardBefore.rank;
    const matchesPreviousPlay =
      room.lastPlayRank && firstRank === room.lastPlayRank;
    const isMatch = matchesTopDiscard || matchesPreviousPlay;

    // Push played cards to discard pile
    room.discardPile.push(...cardsToPlay);
    io.to(roomId).emit("cardDiscarded", {
      player: player.username,
      cardCount: cardsToPlay.length,
      rank: firstRank,
    });

    let drewCard = null;
    if (isMatch) {
      // Draw 0 cards (Matching Rule Advantage)
      logToRoom(
        room,
        `${player.username} discarded ${cardsToPlay.map((c) => c.rank + c.suit).join(", ")}. MATCH! Skipped drawing. Hand size: ${player.hand.length}`,
      );
    } else {
      // Draw exactly 1 card
      if (room.deck.length === 0) {
        reshuffleDiscardPile(room);
      }
      if (room.deck.length > 0) {
        drewCard = room.deck.pop();
        player.hand.push(drewCard);
      }
      logToRoom(
        room,
        `${player.username} discarded ${cardsToPlay.map((c) => c.rank + c.suit).join(", ")}. No match, drew 1 card.`,
      );
    }

    // Update the last rank discarded for the next turn check
    room.lastPlayRank = firstRank;

    // Turn is complete. Advance turn to next active player.
    advanceTurn(room);
    updateRoomState(roomId);
    broadcastAdminRoomUpdates();
  });

  // Call SHOW Action
  socket.on("callShow", (roomId) => {
    const room = rooms[roomId];
    if (!room || room.status !== "playing") return;

    const caller = room.players[room.currentTurnIndex];
    if (caller.id !== socket.id) {
      socket.emit("errorMsg", "You can only call SHOW on your turn.");
      return;
    }

    evaluateShow(room, caller);
    broadcastAdminRoomUpdates();
  });
  // Emoji Reaction Broadcast
  socket.on("emojiReaction", ({ roomId, emoji }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    // Broadcast to every player in the room (including sender)
    room.players.forEach((p) => {
      io.to(p.id).emit("emojiReaction", {
        emoji,
        senderName: player.username,
        senderId: socket.id,
      });
    });
  });

  socket.on("createRoom", ({ username }, callback) => {
    const roomId = generateRoomId();

    rooms[roomId] = {
      id: roomId,
      players: [],
      status: "lobby",
      deck: [],
      discardPile: [],
      lastPlayRank: null,
      currentTurnIndex: 0,
      logs: [],
      roundNumber: 1,
    };

    callback({
      roomId,
    });
  });
  // Disconnect Handling
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    if (adminSockets.has(socket.id)) {
      adminSockets.delete(socket.id);

      console.log(`Admin disconnected: ${socket.id}`);
    }
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex((p) => p.id === socket.id);
      if (playerIndex !== -1) {
        const username = room.players[playerIndex].username;
        room.players.splice(playerIndex, 1);
        logToRoom(room, `${username} disconnected.`);

        if (room.players.length === 0) {
          delete rooms[roomId];
        } else {
          if (room.status === "playing") {
            // End round or adjust turns safely
            if (room.currentTurnIndex >= room.players.length) {
              room.currentTurnIndex = 0;
            }
            // Check if game can continue
            const activePlayers = room.players.filter((p) => !p.eliminated);
            if (activePlayers.length < 2) {
              room.status = "game_over";
              logToRoom(room, "Not enough players remaining. Game Over.");
            }
          }
          updateRoomState(roomId);
          broadcastAdminRoomUpdates();
        }
        break;
      }
    }
  });
});
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
// Start a fresh round of cards
function startNewRound(room) {
  room.deck = shuffle(createDeck());
  room.discardPile = [];
  room.lastPlayRank = null;
  room.status = "playing";
  room.showResults = null; // Clear previous round results

  // Identify non-eliminated players
  const activePlayers = room.players.filter((p) => !p.eliminated);

  if (activePlayers.length < 2) {
    room.status = "game_over";
    logToRoom(room, "Game over! Not enough players left.");
    updateRoomState(room.id);
    broadcastAdminRoomUpdates();
    return;
  }

  // Deal 3 cards to active players, clear inactive hands
  room.players.forEach((p) => {
    if (!p.eliminated) {
      p.hand = [room.deck.pop(), room.deck.pop(), room.deck.pop()];
      p.activeInRound = true;
    } else {
      p.hand = [];
      p.activeInRound = false;
    }
  });

  // Lay out first open discard card
  const starterCard = room.deck.pop();
  room.discardPile.push(starterCard);
  room.lastPlayRank = starterCard.rank; // Starts matched to open card

  // Ensure roundStarterIndex is valid and within bounds
  if (room.roundStarterIndex === undefined) {
    room.roundStarterIndex = 0;
  } else if (room.players.length > 0) {
    room.roundStarterIndex = room.roundStarterIndex % room.players.length;
  }

  // Find the first non-eliminated player starting from the current roundStarterIndex
  let starterIndex = room.roundStarterIndex;
  let attempts = 0;
  while (room.players[starterIndex].eliminated && attempts < room.players.length) {
    starterIndex = (starterIndex + 1) % room.players.length;
    attempts++;
  }

  room.currentTurnIndex = starterIndex;

  // Prepare starter index for the next round (cycles through all players one by one)
  room.roundStarterIndex = (room.roundStarterIndex + 1) % room.players.length;

  logToRoom(room, `--- Round ${room.roundNumber} Started ---`);
  logToRoom(
    room,
    `Starter discard card is ${starterCard.rank}${starterCard.suit}.`,
  );
  updateRoomState(room.id);
  broadcastAdminRoomUpdates();
}

// Reshuffle discard pile back to deck if empty
function reshuffleDiscardPile(room) {
  if (room.discardPile.length <= 1) return; // Keep top card
  const topCard = room.discardPile.pop();
  room.deck = shuffle(room.discardPile);
  room.discardPile = [topCard];
  logToRoom(
    room,
    "The draw deck was empty. Discard pile reshuffled back into the draw deck.",
  );
}

// Pass turn to next non-eliminated player
function advanceTurn(room) {
  let attempts = 0;
  do {
    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
    attempts++;
  } while (
    room.players[room.currentTurnIndex].eliminated &&
    attempts < room.players.length
  );
}

// Log message utility
function logToRoom(room, message) {
  room.logs.push(
    `[${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}] ${message}`,
  );
  if (room.logs.length > 50) room.logs.shift(); // Bound log memory
}

// Evaluate Show Action
function evaluateShow(room, caller) {
  const activePlayers = room.players.filter((p) => p.activeInRound);

  // Hand score mappings — snapshot the hand array so it isn't affected by
  // startNewRound() replacing p.hand references later
  const scores = activePlayers.map((p) => ({
    id: p.id,
    username: p.username,
    handScore: calculateHandScore(p.hand),
    hand: [...p.hand], // Snapshot, not a live reference
  }));

  // Find lowest score
  const minScore = Math.min(...scores.map((s) => s.handScore));
  const callerScoreDetails = scores.find((s) => s.id === caller.id);
  const isCallerLowest = callerScoreDetails.handScore === minScore;

  let showResults = {
    callerId: caller.id,
    callerUsername: caller.username,
    scores: scores,
    isValid: isCallerLowest,
    penalties: {},
  };

  logToRoom(room, `📢 SHOW called by ${caller.username}!`);

  if (isCallerLowest) {
    // Valid Show -> All players accumulate points equal to their hand value
    logToRoom(
      room,
      `✅ Valid Show! ${caller.username} has the lowest score (${callerScoreDetails.handScore}).`,
    );
    scores.forEach((s) => {
      const p = room.players.find((player) => player.id === s.id);
      p.totalScore += s.id === showResults.callerId ? 0 : s.handScore;
      showResults.penalties[s.id] =
        s.id === showResults.callerId ? 0 : s.handScore;
    });
  } else {
    // Wrong Show -> Caller gets flat 30 points penalty + their cards, others get 0 points.
    const penaltyPoints = callerScoreDetails.handScore + 30;
    logToRoom(
      room,
      `❌ WRONG SHOW! ${caller.username} called with ${callerScoreDetails.handScore} points, but a lower hand existed.`,
    );

    room.players.forEach((p) => {
      const hscore = showResults.scores.find((s) => s.id === p.id).handScore;
      if (p.activeInRound) {
        if (p.id === caller.id) {
          p.totalScore += penaltyPoints;
          showResults.penalties[p.id] = penaltyPoints;
        } else {
          p.totalScore += hscore;
          showResults.penalties[p.id] = hscore;
        }
      }
    });
  }

  // Calculate elimination state
  room.players.forEach((p) => {
    if (p.totalScore > 100 && !p.eliminated) {
      p.eliminated = true;
      logToRoom(
        room,
        `💀 Player ${p.username} has been eliminated (Score: ${p.totalScore}).`,
      );
    }
  });

  const remainingPlayers = room.players.filter((p) => !p.eliminated);

  if (remainingPlayers.length <= 1) {
    room.status = "game_over";
    const finalWinner = remainingPlayers[0]
      ? remainingPlayers[0].username
      : "No one (Tie)";
    logToRoom(room, `🏆 Game Over! The winner is ${finalWinner}.`);
  } else {
    room.status = "round_end";
    room.roundNumber += 1;
  }

  room.showResults = showResults;
  updateRoomState(room.id);
  broadcastAdminRoomUpdates();
}

// Sync room updates to clients (with information hiding)
function updateRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.players.forEach((player) => {
    // Clone clean copy of state
    const cleanRoomState = {
      id: room.id,
      status: room.status,
      discardPile: room.discardPile,
      topDiscardCard: room.discardPile[room.discardPile.length - 1] || null,
      lastPlayRank: room.lastPlayRank,
      currentTurnIndex: room.currentTurnIndex,
      logs: room.logs,
      roundNumber: room.roundNumber,
      deckCount: room.deck.length,
      showResults:
        room.status === "round_end" || room.status === "game_over"
          ? room.showResults
          : null,
      players: room.players.map((p) => {
        const isSelf = p.id === player.id;
        const revealPhase =
          room.status === "round_end" || room.status === "game_over";

        return {
          id: p.id,
          username: p.username,
          totalScore: p.totalScore,
          eliminated: p.eliminated,
          activeInRound: p.activeInRound,
          cardCount: p.hand.length,
          // Hide actual card objects unless self or round is revealed
          hand:
            isSelf || revealPhase
              ? p.hand
              : p.hand.map((c) => ({
                  id: "hidden",
                  suit: "?",
                  rank: "?",
                  score: 0,
                })),
        };
      }),
    };

    io.to(player.id).emit("gameStateUpdate", cleanRoomState);
  });
}
app.get("/api/rooms", (req, res) => {
  const availableRooms = Object.values(rooms)
    .filter((room) => room.status === "lobby")
    .map((room) => ({
      roomId: room.id,
      players: room.players.length,
      host: room.players[0].username,
    }));
  res.json(availableRooms);
});
// Start Server Listen
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server executing live on ${PORT}`);
});
