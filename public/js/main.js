// Kabonk home screen script

console.log("main.js loaded");

// find elements on the page
const createRoomButton = document.getElementById("create-room-button");
const joinRoomButton = document.getElementById("join-room-button");
const howToPlayButton = document.getElementById("how-to-play-button");

const createRoomModal = document.getElementById("create-room-modal");
const joinRoomModal = document.getElementById("join-room-modal");
const howToPlayModal = document.getElementById("how-to-play-modal");

const createRoomClose = document.getElementById("create-room-close");
const joinRoomClose = document.getElementById("join-room-close");
const howToPlayClose = document.getElementById("how-to-play-close");

const modeButtons = document.querySelectorAll(".mode");


// opens a pop-up, then hidden becomes false
createRoomButton.addEventListener("click", () => {
    createRoomModal.hidden = false;
});

joinRoomButton.addEventListener("click", () => {
    joinRoomModal.hidden = false;
});

howToPlayButton.addEventListener("click", () => {
    howToPlayModal.hidden = false;
});


// close the pop-up with X, hidden is true
createRoomClose.addEventListener("click", () => {
    createRoomModal.hidden = true;
});

joinRoomClose.addEventListener("click", () => {
    joinRoomModal.hidden = true;
});

howToPlayClose.addEventListener("click", () => {
    howToPlayModal.hidden = true;
});


// picking game mode, selected game mode will be highlighted
for (const button of modeButtons) {
    button.addEventListener("click", () => {
        for (const eachButton of modeButtons) {
            eachButton.classList.remove("selected");
        }
        button.classList.add("selected");
    });
}


// creates a player ID for user upon visiting the home page, ID stays across different rooms
function getPlayerId() {
    let id = localStorage.getItem("playerId");
    if (!id) {
        id = crypto.getRandomValues(new Uint32Array(4)).join("-");
        localStorage.setItem("playerId", id);
    }
    return id;
}

getPlayerId();


// checks the code with the server before going to the game lobby page
const socket = io();

const joinForm = document.getElementById("join-form");
const joinNameInput = document.getElementById("join-name-input");
const roomCodeInput = document.getElementById("room-code-input");
const joinError = document.getElementById("join-error");

// when player clicks join, ask the server before leaving
joinForm.addEventListener("submit", (event) => {
    event.preventDefault();   // stops the form from leaving the page
    joinError.hidden = true;  // clears any old error

    socket.emit("join-room", {
        playerId: getPlayerId(),
        name: joinNameInput.value.trim(),
        roomCode: roomCodeInput.value.trim().toUpperCase()
    });
});

// the room exists, so now go to the game room page
socket.on("room-update", () => {
    joinForm.submit();   // let the form go to room.html like normal
});

// error message shows in pop-up and stays on current page
socket.on("join-error", ({ message }) => {
    joinError.textContent = message;
    joinError.hidden = false;
});