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

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

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

    // Prevent joining if game has already started
    if (room.status !== "lobby") {
      socket.emit("errorMsg", "Game has already started in this room.");
      return;
    }

    // Add player to room
    const player = {
      id: socket.id,
      username: username,
      hand: [],
      totalScore: 0,
      eliminated: false,
      activeInRound: false,
    };
    room.players.push(player);

    logToRoom(room, `${username} joined the room.`);
    updateRoomState(roomId);
  });

  // Start Game
  socket.on("startGame", (roomId) => {
    const room = rooms[roomId];
    if (!room || room.status !== "lobby") return;
    if (room.players.length < 2) {
      socket.emit("errorMsg", "Need at least 2 players to start.");
      return;
    }

    room.status = "playing";
    room.roundNumber = 1;

    // Reset all scores
    room.players.forEach((p) => {
      p.totalScore = 0;
      p.eliminated = false;
    });

    startNewRound(room);
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
  });

  // Disconnect Handling
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
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
        }
        break;
      }
    }
  });
});

// Start a fresh round of cards
function startNewRound(room) {
  room.deck = shuffle(createDeck());
  room.discardPile = [];
  room.lastPlayRank = null;
  room.status = "playing";

  // Identify non-eliminated players
  const activePlayers = room.players.filter((p) => !p.eliminated);

  if (activePlayers.length < 2) {
    room.status = "game_over";
    logToRoom(room, "Game over! Not enough players left.");
    updateRoomState(room.id);
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

  // Turn index set to first active player
  room.currentTurnIndex = room.players.findIndex((p) => !p.eliminated);

  logToRoom(room, `--- Round ${room.roundNumber} Started ---`);
  logToRoom(
    room,
    `Starter discard card is ${starterCard.rank}${starterCard.suit}.`,
  );
  updateRoomState(room.id);
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

  // Hand score mappings
  const scores = activePlayers.map((p) => ({
    id: p.id,
    username: p.username,
    handScore: calculateHandScore(p.hand),
    hand: p.hand,
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
      p.totalScore += s.handScore;
      showResults.penalties[s.id] = s.handScore;
    });
  } else {
    // Wrong Show -> Caller gets flat 30 points penalty + their cards, others get 0 points.
    const penaltyPoints = callerScoreDetails.handScore + 30;
    logToRoom(
      room,
      `❌ WRONG SHOW! ${caller.username} called with ${callerScoreDetails.handScore} points, but a lower hand existed.`,
    );

    room.players.forEach((p) => {
      if (p.activeInRound) {
        if (p.id === caller.id) {
          p.totalScore += penaltyPoints;
          showResults.penalties[p.id] = penaltyPoints;
        } else {
          showResults.penalties[p.id] = 0; // Other players safe
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

// Start Server Listen
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server executing live on http://localhost:${PORT}`);
});
