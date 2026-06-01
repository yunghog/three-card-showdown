Save this file as `antigravity-game-context.md` in your project root. It is designed to act as a system context prompt for your AI IDE, allowing it to instantly map the visual frontend modules, network events, and backend logical gates.

***

# System Context: Three Card Points Game Codebase Engine

This context document maps the codebase for the **Three Card Points Game**. It outlines the authoritative server design, state schemas, network lifecycle, and frontend visual rendering loops so an AI developer agent can locate, modify, or extend features with absolute pinpoint accuracy.

---

## 1. Game Mechanics & Logical Specifications

```text
       DECK (52 Cards)
              │
      [Deals 3 Cards] ──➔ PLAYER HANDS (A=1, Face=10, Numbers=Value)
              │
              ▼
   DISCARD PILE (Top Card starts matching chain)
```

*   **Objective:** Achieve the lowest hand score among active players when a `SHOW` is triggered.
*   **Card Point Math:** Aces = 1 point; 2 through 10 = face value; Jacks, Queens, Kings = 10 points. Hand value is computed via absolute sum.
*   **Turn Flow Constraints:** On a player's turn, they must perform exactly one of these primary actions:
    1.  **Discard & Draw Loop:** Play 1, 2, or 3 cards of identical rank. Then, evaluate the **Matching Rule**:
        *   Compare the rank of the played card(s) against the **top card of the discard pile prior to this turn** OR against the **rank discarded by the immediate previous player**.
        *   If a match is found: Draw 0 cards.
        *   If no match is found: Automatically draw 1 card from the deck.
    2.  **Call SHOW:** Can be triggered *on a player's turn instead of playing cards*.
*   **Show Resolution Outcomes:**
    *   **Valid Show:** Caller's hand score $\le$ all other active players' hand scores. All players add their current hand scores to their total game scores.
    *   **Wrong Show:** At least one opponent has a strictly lower hand score than the caller. The caller is penalized: they receive their current hand score + a flat **30-point penalty**. All other players receive 0 points for that round.
*   **Tournament Elimination:** Players who exceed 100 cumulative points are permanently marked as `eliminated = true`. The last remaining player with $\le$ 100 points wins the tournament.

---

## 2. Source Code Architecture & File Map

The application is structured into four core files. Below is the precise map of where logical systems reside:

```text
three-card-points/
├── server.js               <-- Authoritative state machine, deck math, validations
└── public/
    ├── index.html          <-- UI layout, modals, grid containers, state views
    ├── css/style.css       <-- CSS variables, card utilities, styling classes
    └── js/game.js          <-- Client sockets, render pipelines, user selection input
```

### File Systems Breakdown

#### `server.js`
*   **Deck & Scoring Engine:** Generates standard 52-card JSON arrays inside `createDeck()`.
*   **Turn Cycle Pipeline:** Manages client validations, card reductions, matching checks, automatic deck drawing, and turn handovers (`advanceTurn()`).
*   **Show and Penalty Systems:** Resolves hand scores, applies penalties, manages elimination state, and evaluates tournament endings inside `evaluateShow()`.
*   **Security & Sanitization Gateway:** Implements `updateRoomState()`. Before emitting state updates over Socket.IO, it sanitizes other players' hands to block client-side deck snooping.

#### `public/index.html`
*   **Lobby View:** Screen `#lobby-screen`. Captures room joining parameters.
*   **Arena Field Grid:** Screen `#game-screen`. Houses player statistics headers, active card zones, opponent lists, matching decks, and the event log terminal.
*   **Outcome Overlays:** Modal `#result-modal`. Renders card reveals, round score gains, and active tournament standings.

#### `public/css/style.css`
*   **Visual Parameters:** CSS Custom Properties (`:root`) govern layout colors, transitions, and theme definitions.
*   **Cards Component Module:** Rules for `.card`, `.selected` toggles, `.card-back` textures, and suit color overrides (`.suit-red`, `.suit-black`).
*   **Grid Framework:** Utility declarations for flex alignments, margins, and responsiveness breakpoints.

#### `public/js/game.js`
*   **Server Communications Module:** Outbound Socket.IO actions (`joinRoom`, `startGame`, `playCards`, `callShow`).
*   **Display Render Pipeline:** Subsections for top scoreboards, table cards, opponent layouts, and logging text.
*   **Selection Filters:** Prevents invalid GUI moves (e.g., locking the play button if selected hand cards are of differing ranks).

---

## 3. Data Models & JSON Schemas

### Server-Side Room State Model (`rooms[roomId]`)
```json
{
  "id": "ROOM_ID_STRING",
  "status": "lobby | playing | round_end | game_over",
  "deck": [
    { "id": "7-♦", "suit": "♦", "rank": "7", "score": 7 }
  ],
  "discardPile": [
    { "id": "K-♠", "suit": "♠", "rank": "K", "score": 10 }
  ],
  "lastPlayRank": "K",
  "currentTurnIndex": 0,
  "logs": [
    "[10:30:15 AM] User joined the room."
  ],
  "roundNumber": 1,
  "players": [
    {
      "id": "SOCKET_ID",
      "username": "Username",
      "hand": [
        { "id": "A-♥", "suit": "♥", "rank": "A", "score": 1 }
      ],
      "totalScore": 0,
      "eliminated": false,
      "activeInRound": true
    }
  ],
  "showResults": null
}
```

### Sanitized Outbound Client Payload (`gameStateUpdate`)
The array structure emitted to players during active play. Other players' cards are masked:
```json
{
  "id": "ROOM_ID_STRING",
  "status": "playing",
  "discardPile": [ ... ],
  "topDiscardCard": { "id": "K-♠", "suit": "♠", "rank": "K", "score": 10 },
  "lastPlayRank": "K",
  "currentTurnIndex": 0,
  "logs": [ ... ],
  "roundNumber": 1,
  "deckCount": 42,
  "players": [
    {
      "id": "MY_SOCKET_ID",
      "username": "Me",
      "totalScore": 0,
      "eliminated": false,
      "activeInRound": true,
      "cardCount": 3,
      "hand": [ { "id": "A-♥", "suit": "♥", "rank": "A", "score": 1 } ] // Visible
    },
    {
      "id": "OPPONENT_SOCKET_ID",
      "username": "Opponent_User",
      "totalScore": 0,
      "eliminated": false,
      "activeInRound": true,
      "cardCount": 3,
      "hand": [ { "id": "hidden", "suit": "?", "rank": "?", "score": 0 } ] // Masked
    }
  ],
  "showResults": null
}
```

---

## 4. Socket Network Protocol Events

This table details the real-time websocket API contract between client and server:

| Event Name | Direction | Payload Structure | Code Location (Trigger) | Backend Response (Mutation) |
| :--- | :--- | :--- | :--- | :--- |
| `joinRoom` | Client ➔ Server | `{ username: string, roomId: string }` | `game.js`: Form submission | Registers player to room, pushes log, calls `updateRoomState()` |
| `startGame` | Client ➔ Server | `roomId: string` | `game.js`: Start button / Next round click | Resets status to `playing`, shuffles deck, deals cards, calls `updateRoomState()` |
| `playCards` | Client ➔ Server | `{ roomId: string, cardIds: array }` | `game.js`: Play button click | Validates hand ownership and identical ranks. Removes cards, executes match evaluations, processes auto-draws, shifts turns, calls `updateRoomState()` |
| `callShow` | Client ➔ Server | `roomId: string` | `game.js`: Show button click | Validates turn. Triggers `evaluateShow()`, processes score accumulations, registers eliminations, shifts status, calls `updateRoomState()` |
| `gameStateUpdate` | Server ➔ Client | `cleanRoomState: object` (Sanitized) | `server.js`: `updateRoomState()` | Erases hidden card properties, computes counts, and emits a secure payload to each socket connection |
| `errorMsg` | Server ➔ Client | `message: string` | `server.js`: Server-side validations | Pops up client-side `alert()` browser dialog |

---

## 5. Trace Logic: Lifecycle of a Turn & Round

```text
Turn Starts (Active Player)
    │
    ├───► Call SHOW ──➔ Calculate Hand Sums ──➔ Validate Caller Score
    │                                                    │
    │                                                    ├──➔ Valid: Add scores normally
    │                                                    └──➔ Wrong: +30 Penalty to caller
    │
    └───► Play Card(s) ──➔ Validate Rank Identity
                                 │
                                 ▼
                     Evaluate Discard Matching Check
                                 │
                     ├───► Match Found: Draw 0 Cards
                     └───► No Match: Auto-Draw 1 Card from Deck
                                 │
                                 ▼
                     Advance Turn ➔ Broadcast State
```

### Detailed Execution Phase

1.  **Turn Validation:** 
    *   `game.js` determines turn ownership. Hand card `click` listeners are activated. 
    *   The click handler validates selection: if the clicked card's rank differs from existing selections, it resets the array and highlights the newly clicked card.
2.  **Move Execution on Server:**
    *   Client emits `playCards`.
    *   The backend validates that the active player owns the chosen card IDs, and that all chosen cards share an identical rank (`allSameRank`).
3.  **Evaluate Matching Rule:**
    *   The server captures `topDiscardCardBefore` (the card resting on top of the discard pile *prior* to this move).
    *   It checks the matching condition: `isMatch = (playedRank === topDiscardCardBefore.rank) || (playedRank === room.lastPlayRank)`.
    *   If `isMatch == true`, it bypasses drawing. Hand card count decreases.
    *   If `isMatch == false`, it removes the top card from `room.deck` and pushes it to the player's hand. If the deck is empty, `reshuffleDiscardPile()` triggers first.
4.  **Register Discard:**
    *   Played cards are moved to `room.discardPile`.
    *   `room.lastPlayRank` updates to the current discarded rank.
5.  **Turn Handover:**
    *   `advanceTurn()` increments `room.currentTurnIndex`.
    *   It uses a `do-while` loop to skip over players with `eliminated == true`.
    *   Calls `updateRoomState()` to compile and send the updated state to all connected players.

---

## 6. Target Guide for Custom Feature Implementation

To add new rules or change existing mechanics, use this reference table to find the exact code coordinates:

```text
To Add a Turn Timer:
   - server.js: Add intervals inside startNewRound() and playCards().
   - game.js: Render timer in top-scoreboard.

To Change Deck/Scoring Rules:
   - server.js: Edit createDeck() point evaluations.

To Add Game Graphics/Themes:
   - style.css: Customize card styling rules under .card and .card-back.
```

*   **Changing Point Values (e.g., make Aces worth 11, or Jacks worth 15):**
    *   *Target:* `server.js` ➔ `createDeck()`.
    *   *Logic:* Modify the value mapping conditionals used to compute card score assignments.
*   **Altering Tournament Elimination Threshold (e.g., lower it to 50 or raise to 150):**
    *   *Target:* `server.js` ➔ `evaluateShow()`.
    *   *Logic:* Update the score evaluation threshold check (`p.totalScore > 100`).
*   **Adjusting the Wrong Show Penalty (e.g., change the penalty from 30 points to 50):**
    *   *Target:* `server.js` ➔ `evaluateShow()`.
    *   *Logic:* Change the hardcoded offset value (`const penaltyPoints = callerScoreDetails.handScore + 30;`).
*   **Restructuring the Matching Rule criteria (e.g., matching suits instead of ranks):**
    *   *Target:* `server.js` ➔ `socket.on('playCards')`.
    *   *Logic:* Adjust the evaluation expressions for `matchesTopDiscard` and `matchesPreviousPlay` to compare suits instead of ranks.
*   **Modifying Card Selections or Play Constraints on the Client:**
    *   *Target:* `public/js/game.js` ➔ `renderMyHand()`.
    *   *Logic:* Modify the click event listener validation checks that control how cards are selected and when the play button is enabled.