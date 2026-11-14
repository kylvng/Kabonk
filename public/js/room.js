const params = new URLSearchParams(window.location.search);
const playerName = (params.get("name") || "").trim().slice(0, 20);
const mode = params.get("mode");
let roomCode = mode === "create" ? "" : (params.get("code") || "").trim().toUpperCase();

const room = document.getElementById("room");
const statusMessage = document.getElementById("status");
const inviteCode = document.getElementById("invite-code");
const circle = document.getElementById("circle");
const arrow = document.getElementById("arrow");
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");
const leaveButton = document.getElementById("leave-room");
const backHome = document.getElementById("back-home");

// this HAS to match size in room.css
const CENTER = 200;       // middle of the "invisible" box
const RADIUS = 150;       // how far seats are from the bomb
const SEAT_WIDTH = 100;
const SEAT_HEIGHT = 64;

// remembers each player's seat element, so seats can slide
const seats = Object.create(null);

// finding where to "sit" relative to the amount of players in the game
function seatAngle(index, total) {
    // splits the circle (box) into equal pieces; starts at the top and goes clockwise
    return -90 + index * (360 / total);
}

function placeSeat(seat, index, total) {
    const angle = seatAngle(index, total);   // which direction from the bomb is this player sitting in
    const radians = angle * Math.PI / 180;   // convert angle into radians

    // cos gives how far left/right, sin gives how far up/down
    // calculate the point for the middle of the seat
    const x = CENTER + RADIUS * Math.cos(radians);
    const y = CENTER + RADIUS * Math.sin(radians);

    // places actual seat
    seat.style.left = (x - SEAT_WIDTH / 2) + "px";
    seat.style.top = (y - SEAT_HEIGHT / 2) + "px";
}


// draw players around the bomb
function drawPlayers(players, myId) {
    // remove seats of players who left
    for (const id in seats) {
        const stillHere = players.some((player) => player.id === id);
        if (!stillHere) {
            seats[id].remove();
            delete seats[id];
        }
    }

    // adds or moves a seat for every player 
    for (let i = 0; i < players.length; i++) {
        const player = players[i];

        // makes a new seat if this player doesn't have one yet
        if (!seats[player.id]) {
            const seat = document.createElement("div");
            seat.classList.add("seat");
            circle.appendChild(seat);
            seats[player.id] = seat;
        }

        const seat = seats[player.id];

        // name on top, hearts underneath
        const nameLine = document.createElement("div");
        nameLine.textContent = player.name;
        if (player.id === myId) {
            nameLine.textContent = player.name + " (you)";
            seat.classList.add("you");
        }

        const heartsLine = document.createElement("div");
        heartsLine.classList.add("hearts");
        heartsLine.textContent = "♥ ♥";

        seat.replaceChildren(nameLine, heartsLine);

        placeSeat(seat, i, players.length);
    }

    // points the arrow at the first player (this is a placeholder until turns exist)
    if (players.length > 0) {
        arrow.style.transform = "rotate(" + seatAngle(0, players.length) + "deg)";
    }
}


// Each tab keeps its own player ID across navigation and refreshes.
function getPlayerId() {
    let id = sessionStorage.getItem("playerId");
    if (!id) {
        id = crypto.getRandomValues(new Uint32Array(4)).join("-");
        sessionStorage.setItem("playerId", id);
    }
    return id;
}

const canOpenRoom = playerName && (mode === "create" || (mode === "join" && roomCode));

if (!canOpenRoom) {
    statusMessage.textContent = "Open a room from the Create Room or Join Room menu.";
} else {
    const socket = io();
    // use the saved player ID, so a refresh keeps you as the same player
    const playerId = getPlayerId();
    let leaving = false;

    socket.on("connect", () => {
        if (leaving) return;
        if (roomCode) {
            socket.emit("join-room", { playerId, name: playerName, roomCode });
        } else {
            socket.emit("create-room", { playerId, name: playerName });
        }
    });

    socket.on("room-update", ({ code, players }) => {
        if (leaving) return;
        if (!roomCode) {
            roomCode = code;
            params.set("mode", "join");
            params.set("code", code);
            window.history.replaceState(null, "", "?" + params);
        }

        inviteCode.textContent = code;
        drawPlayers(players, playerId);

        statusMessage.hidden = true;
        backHome.hidden = true;
        chatInput.disabled = false;
        chatSend.disabled = false;
        room.hidden = false;
    });

    function showStatus(message) {
        statusMessage.textContent = message;
        statusMessage.hidden = false;
        backHome.hidden = false;
        chatInput.disabled = true;
        chatSend.disabled = true;
        room.hidden = true;
    }

    chatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = chatInput.value.trim();
        if (!text || !socket.connected || chatInput.disabled || leaving) return;
        socket.emit("chat", { text });
        chatInput.value = "";
    });

    socket.on("chat", ({ user, text }) => {
        const item = document.createElement("li");
        const sender = document.createElement("strong");
        sender.textContent = user + ": ";
        item.append(sender, document.createTextNode(text));
        chatMessages.appendChild(item);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    leaveButton.addEventListener("click", () => {
        leaving = true;
        leaveButton.disabled = true;
        chatInput.disabled = true;
        chatSend.disabled = true;

        function goHome() {
            socket.disconnect();
            window.location.assign("/");
        }

        if (socket.connected) {
            socket.timeout(3000).emit("leave-room", goHome);
        } else {
            goHome();
        }
    });

    socket.on("join-error", ({ message }) => showStatus(message));
    socket.on("disconnect", () => showStatus("Reconnecting to the room..."));
    socket.on("connect_error", () => showStatus("Reconnecting to the room..."));
}
