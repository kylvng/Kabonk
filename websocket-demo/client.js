
const { io } = require("socket.io-client");
const socket = io("http://localhost:3000");
const readline = require("readline");
const rl = readline.createInterface({ input : process.stdin });

const user =  process.argv[2];

rl.on("line", (line) => {
    socket.emit("chat", {user: user, text: line});
});

socket.on("connect", () => {
    console.log("Connected to server with ID:", socket.id);
    });

socket.on("chat", (msg) => {
    console.log(`${msg.user}: ${msg.text}`);
})

socket.on("disconnect", () => {
    console.log("Disconnected from server");
    });
