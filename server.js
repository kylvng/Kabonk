const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require('socket.io');

const port = process.env.PORT || 3000;
const hostname = "0.0.0.0";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();

// create room code

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomCode() {
    let code = "";
    for (let i = 0; i < 4; i++) {
        code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    }
    return code;
}

function makeRoomCode(){
    let code = randomCode();
    while (rooms.has(code)){
        code = randomCode();
    }
    return code;
}

io.on('connection', (socket) => {
    console.log(`User connect on socket ${socket.id}`);


    socket.on("create-room", ({playerId, name}) => {
        if (!playerId || !name){
            return;
        }

        const code = makeRoomCode();
        const room = {
            code,
            hostId: playerId,
            status: "lobby",
            players: [{
                id:playerId,
                name,
                socketId: socket.id
            }]
        };
        rooms.set(code,room);

        socket.join(code);
        socket.data.roomCode = code;
        socket.data.playerId = playerId;

        io.to(code).emit("room-update", room);
    })

    socket.on("join-room", ({ roomCode, user }) => {
        if (!roomCode) return;

        socket.join(roomCode);
        socket.data.roomCode = roomCode;

        console.log(`${user} joined room ${roomCode}`);

        io.to(roomCode).emit("chat", {
            user: "System",
            text: `${user} joined the room`
        });
    });
    
    socket.on("disconnect", (reason) => {
        console.log(`User disconnected on ${socket.id}, reason: ${reason}`);
    })
});

server.listen(port, hostname, () => {
  console.log(`Listening at: http://${hostname}:${port}`);
});