const params = new URLSearchParams(window.location.search);
const playerName = (params.get("name") || "").trim().slice(0, 20);
const mode = params.get("mode");
let roomCode = mode === "create" ? "" : (params.get("code") || "").trim().toUpperCase();

const room = document.getElementById("room");
const inviteCode = document.getElementById("invite-code");
const playerList = document.getElementById("player-list");
const statusMessage = document.getElementById("status");

function getPlayerId() {
    let id = localStorage.getItem("playerId");
    if (!id) {
        id = crypto.getRandomValues(new Uint32Array(4)).join("-");
        localStorage.setItem("playerId", id);
    }
    return id;
}


const canOpenRoom = mode === "create" || (mode === "join" && roomCode);
if (!canOpenRoom) {
    statusMessage.textContent = "Open a room from the Create Room or Join Room menu.";
} else {
    const socket = io();
    // use the saved player ID, so refresh keeps you as same player
    const playerId = getPlayerId();

    socket.on("connect", () => {
        if (roomCode) {
            socket.emit("join-room", { playerId, name: playerName, roomCode });
        } else {
            socket.emit("create-room", { playerId, name: playerName });
        }
    });

    socket.on("room-update", ({ code, players }) => {
        if (!roomCode) {
            roomCode = code;
            params.set("mode", "join");
            params.set("code", code);
            window.history.replaceState(null, "", `?${params}`);
        }

        inviteCode.textContent = code;
        const items = players.map((player) => {
            const item = document.createElement("li");
            item.textContent = player.id === playerId ? `${player.name} (you)` : player.name;
            return item;
        });
        playerList.replaceChildren(...items);
        statusMessage.textContent = "";
        room.hidden = false;
    });

    function showStatus(message) {
        statusMessage.textContent = message;
        room.hidden = true;
        playerList.replaceChildren();
    }

    socket.on("join-error", ({ message }) => showStatus(message));
    socket.on("disconnect", () => showStatus("Reconnecting to the room…"));
    socket.on("connect_error", () => showStatus("Reconnecting to the room…"));
}
