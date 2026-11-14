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

const { rooms, makeRoomCode, leaveRoom } = require("./game/rooms");
const { startGame, submitWord } = require("./game/gameLoop");

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

    socket.on("join-room", ({ roomCode, playerId, name}) => {
        if (!roomCode || !playerId || !name){
            return;
        }

        const code = roomCode.toUpperCase();
        const room = rooms.get(code);

        if (!room){
            socket.emit("join-error", {message: "The following room does not exist"});
            return;
        }

        const existing = room.players.find(p => p.id === playerId);

        if (existing){
            existing.socketId = socket.id;
        }
        else{
            if (room.players.length >= 8){
                socket.emit("join-error", {message: "The existing room is full"});
                return;
            }
            const player = {
                id: playerId,
                name,
                socketId: socket.id,
                spectating: room.status === "playing"
            };

            room.players.push(player);
        }

        socket.join(code);
        socket.data.roomCode = code;
        socket.data.playerId = playerId;

        io.to(code).emit("room-update", room);
    });

    socket.on("leave-room", () => {
        const code = socket.data.roomCode;
        leaveRoom(io, socket);
        socket.leave(code);
        socket.data.roomCode= undefined;
        socket.data.playerId= undefined;

    });

    socket.on("start-game", () => {
        const code = socket.data.roomCode;
        const playerId = socket.data.playerId;
        const room = rooms.get(code);

        if (!room) {
            return;
        }

        if (room.hostId !== playerId) {
            socket.emit("start-error", { message: "Only the host can start the game" });
            return;
        }

        if (room.players.length < 2) {
            socket.emit("start-error", { message: "Need at least 2 players to start" });
            return;
        }

        if (room.status === "playing") {
            return;
        }

        room.status = "playing";
        io.to(code).emit("room-update", room);
        startGame(io, room);
    });

    socket.on("submit-word", ({word}) => {
        const room = rooms.get(socket.data.roomCode);
        if(!room){
            return;
        }

        submitWord(io, room, socket.data.playerId, word);
    });

    socket.on("typing", ({text}) => {
        const code = socket.data.roomCode;
        if (!code){
            return;
        }

        socket.to(code).emit("typing", {
            playerId: socket.data.playerId,
            text
        });
    });
    
    socket.on("disconnect", (reason) => {
        console.log(`User disconnected on ${socket.id}, reason: ${reason}`);
        leaveRoom(io, socket);
    })
});

server.listen(port, hostname, () => {
  console.log(`Listening at: http://${hostname}:${port}`);
});