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

function leaveRoom(socket){
    const code = socket.data.roomCode;
    const playerId = socket.data.playerId;
    const room = rooms.get(code);

    if (!room){
        return;
    }

    // find if the socket is an old socket, only the current socket attached to the player can remove them
    const player = room.players.find(p => p.id === playerId);
    if (!player || player.socketId !== socket.id){
        return;
    }

    room.players = room.players.filter(p => p.id !== playerId);

    if (room.players.length === 0){
        rooms.delete(code);
        return;
    }

    if (room.hostId === playerId){
        room.hostId = room.players[0].id;
    }

    io.to(code).emit("room-update", room);
}

io.on('connection', (socket) => {
    console.log(`User connect on socket ${socket.id}`);


    socket.on("create-room", ({playerId, name}) => {
        if (!playerId || !name){
            return;
        }

        const code = makeRoomCode();
        const room = {
            code: code,
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
                name: name,
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
        leaveRoom(socket);
        socket.leave(code);
        socket.data.roomCode= undefined;
        socket.data.playerId= undefined;

    });
    
    socket.on("disconnect", (reason) => {
        console.log(`User disconnected on ${socket.id}, reason: ${reason}`);
        leaveRoom(socket);
    })
});

server.listen(port, hostname, () => {
  console.log(`Listening at: http://${hostname}:${port}`);
});