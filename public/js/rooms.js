const socket = io();

const usernameInput = document.getElementById("username");
if (localStorage.getItem("playerUsername"))
  usernameInput.value = localStorage.getItem("playerUsername");
const roomsList = document.getElementById("rooms-list");

const createRoomBtn = document.getElementById("create-room-btn");

loadRooms();

async function loadRooms() {
  const response = await fetch("/api/rooms");

  const rooms = await response.json();

  renderRooms(rooms);
}

function renderRooms(rooms) {
  roomsList.innerHTML = "";

  if (rooms.length === 0) {
    roomsList.innerHTML = "<p>No rooms available</p>";

    return;
  }

  rooms.forEach((room) => {
    const div = document.createElement("div");

    div.className = "glass-panel p-1 mb-1";

    div.innerHTML = `
      <div
        class="
        flex
        justify-between
        items-center">

        <div>
          <strong>
           ${room.host}'s table - ${room.roomId}
          </strong>
          <br/>
          ${room.players}
          players
        </div>

        <button
          class="btn btn-success"
        >
          Join
        </button>

      </div>
    `;

    div.querySelector("button").addEventListener("click", () => {
      const username = usernameInput.value.trim();

      if (!username) {
        alert("Enter username");
        return;
      }

      window.location.href = `/game.html?username=${encodeURIComponent(username)}&room=${room.roomId}`;
    });

    roomsList.appendChild(div);
  });
}

createRoomBtn.addEventListener("click", () => {
  const username = usernameInput.value.trim();

  if (!username) {
    alert("Enter username");
    return;
  }

  socket.emit(
    "createRoom",
    {
      username,
    },
    (response) => {
      window.location.href = `/game.html?username=${encodeURIComponent(username)}&room=${response.roomId}`;
    },
  );
});
