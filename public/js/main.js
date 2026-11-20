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


// Each tab keeps its own player ID across navigation and refreshes.
function getPlayerId() {
    let id = sessionStorage.getItem("playerId");
    if (!id) {
        id = crypto.getRandomValues(new Uint32Array(4)).join("-");
        sessionStorage.setItem("playerId", id);
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

const createForm = document.getElementById("create-form");
const createNameInput = document.getElementById("create-name-input");

// // save the player's name so they don't have to type it again next time
// it fills in the name boxes here (can be changed)
const savedName = localStorage.getItem("playerName") || "";
createNameInput.value = savedName;
joinNameInput.value = savedName;

createForm.addEventListener("submit", () => {
    localStorage.setItem("playerName", createNameInput.value.trim());
});

// when player clicks join, ask the server before leaving
joinForm.addEventListener("submit", (event) => {
    event.preventDefault();   // stops the form from leaving the page
    joinError.hidden = true;  // clears any old error

    if (joinNameInput.value.trim() === "") {
        joinError.textContent = "Please enter a name";
        joinError.hidden = false;
        return;
    }

    localStorage.setItem("playerName", joinNameInput.value.trim());

    socket.emit("check-room", {
        roomCode: roomCodeInput.value.trim().toUpperCase()
    });
});

// invite link
const linkRoom = new URLSearchParams(window.location.search).get("room");

// the room exists, so now go to the game room page
socket.on("room-ok", () => {
    if (linkRoom) {
        window.location.replace("/room.html?mode=join&code=" + roomCodeInput.value);
    } else {
        joinForm.submit(); // let the form go to room.html like normal
    }   
});

// error message shows in pop-up and stays on current page
socket.on("join-error", ({ message }) => {
    joinRoomModal.hidden = false;
    joinError.textContent = message;
    joinError.hidden = false;
});

if (linkRoom) {
    roomCodeInput.value = linkRoom.trim().toUpperCase();
    socket.emit("check-room", { roomCode: roomCodeInput.value });
}


