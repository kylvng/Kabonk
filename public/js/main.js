// Kabok home screen script

console.log("main.js loaded");

// ---------- Find the elements on the page ----------
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

