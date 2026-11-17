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
const startButton = document.getElementById("start-game");
const lobbyMessage = document.getElementById("lobby-message");
const promptText = document.getElementById("prompt");
const timerText = document.getElementById("timer");
const answerInput = document.getElementById("answer-input");
const attemptText = document.getElementById("attempt");
const lastResult = document.getElementById("last-result");

// this HAS to match size in room.css
const CENTER = 200;       // middle of the "invisible" box
const RADIUS = 150;       // how far seats are from the bomb
const SEAT_WIDTH = 100;
const SEAT_HEIGHT = 64;

// what each word-rejected reason means, for the player
const REJECT_REASONS = {
    "missing-letters": "doesn't have the letters",
    "not-a-word": "not a word",
    "already-used": "already used"
};

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

function heartsText(hearts, id) {
    if (Object.keys(hearts).length === 0) {
        return ""; // lobby, no game yet
    }
    if (!(id in hearts)) {
        return "watching"; // joined mid-game
    }
    if (hearts[id] === 0) {
        return "💀 out";
    }
    return "♥ ".repeat(hearts[id]).trim();
}

// draw players around the bomb
function drawPlayers(players, myId, hearts) {
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
        heartsLine.textContent = heartsText(hearts, player.id);
        seat.replaceChildren(nameLine, heartsLine);

        placeSeat(seat, i, players.length);
    }
}

function pointArrowAt(players, activeId){
    const index = players.findIndex((player) => player.id === activeId);
    if (index === -1){
        return; // player left the room
    }

    arrow.hidden = false;
    arrow.style.transform = "rotate(" + seatAngle(index, players.length) + "deg)";
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
    let currentPlayers = [];        // Last list from room-update, same order as the seats
    let activeId = null;            // who has the bomb right now
    let countdown = null;           // setInterval id for the timer text
    let currentHearts = {};         // last hearts map from the server, {} in the lobby
    
    function stopCountdown() {
        clearInterval(countdown);
        countdown = null;
        timerText.textContent = "";
    }

    function startCountdown(duration){
        stopCountdown();
        const deadline = Date.now() + duration;
        timerText.textContent = (duration/1000).toFixed(1) + "s";

        countdown = setInterval(() => {
            const left = Math.max(0, deadline - Date.now());
            timerText.textContent = (left/1000).toFixed(1) + "s";
            if (left === 0){
                clearInterval(countdown);
            }
        }, 100);
    }

    function nameOf(id){
        const player = currentPlayers.find((p) => p.id === id);
        return player ? player.name : "Someone";
    }

    socket.on("connect", () => {
        if (leaving) return;
        if (roomCode) {
            socket.emit("join-room", { playerId, name: playerName, roomCode });
        } else {
            socket.emit("create-room", { playerId, name: playerName });
        }
    });

    socket.on("room-update", ({ code, players, hostId, status }) => {
        if (leaving) return;
        if (!roomCode) {
            roomCode = code;
            params.set("mode", "join");
            params.set("code", code);
            window.history.replaceState(null, "", "?" + params);
        }

        inviteCode.textContent = code;
        currentPlayers = players;
        if (status === "lobby") {
            currentHearts = {};
        }
        drawPlayers(players, playerId, currentHearts);

        if (status === "lobby") {
            attemptText.textContent = "";
            lastResult.textContent = "";
            activeId = null;
            stopCountdown();
            answerInput.disabled = true;
            answerInput.value = "";
            promptText.textContent = "Waiting for the host to start";
            arrow.hidden = true;
        }
        else if (activeId) {
            pointArrowAt(players, activeId);
        }

        const isHost = hostId === playerId;
        startButton.hidden = !(isHost && status === "lobby");
        if (status === "playing"){
            lobbyMessage.textContent = ""; // game started, so old message is stale
        }

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

    startButton.addEventListener("click", () => {
        lobbyMessage.textContent = "";
        socket.emit("start-game");
    });

    answerInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || answerInput.disabled) {
            return;
        }
        socket.emit("submit-word", { word: answerInput.value});
    });

    answerInput.addEventListener("input", () => {
        if (answerInput.disabled) {
            return;
        }

        socket.emit("typing", { text: answerInput.value });
    });

    socket.on("start-error", ({ message}) =>{
        lobbyMessage.textContent = message;
    })

    socket.on("turn-start", (turn) => {
        activeId = turn.activeId;
        attemptText.textContent = "";
        promptText.textContent = turn.prompt.toUpperCase();
        pointArrowAt(currentPlayers, activeId);
        startCountdown(turn.duration);
        currentHearts = turn.hearts;
        drawPlayers(currentPlayers, playerId, currentHearts);

        const myTurn = activeId === playerId;
        answerInput.disabled = !myTurn;
        answerInput.value = "";

        if (myTurn){
            answerInput.focus();
        }
    })

    socket.on("typing", (typed) => {
        if (typed.playerId !== activeId) {
            return;
        }

        attemptText.textContent = nameOf(typed.playerId) + ": " + typed.text.toUpperCase();
    })

    socket.on("word-accepted", (result) => {
        lastResult.textContent = nameOf(result.playerId) + " played " + result.word.toUpperCase() + " ✓";
    });

    socket.on("bomb-exploded", (boom) => {
        currentHearts = boom.hearts;
        drawPlayers(currentPlayers, playerId, currentHearts);
        lastResult.textContent = "💥 " + nameOf(boom.playerId) + " lost a heart";
    });

    socket.on("game-over", ({ winnerName }) => {
        lobbyMessage.textContent = winnerName + " wins!";
    });

    socket.on("word-rejected", (result) => {
        const why = REJECT_REASONS[result.reason] || result.reason;
        lastResult.textContent = nameOf(result.playerId) + ": " + result.word.toUpperCase() + " ✗ (" + why + ")";

        if (result.playerId === playerId) {
            answerInput.select(); // highlight it so typing replaces it
        }
    });

    socket.on("join-error", ({ message }) => showStatus(message));
    socket.on("disconnect", () => showStatus("Reconnecting to the room..."));
    socket.on("connect_error", () => showStatus("Reconnecting to the room..."));
}
