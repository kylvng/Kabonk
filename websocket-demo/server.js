const express = require("express");
const http = require("http");
const { Server } = require('socket.io');

const port = 3000;
const hostname = "localhost";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
    console.log(`User connect on socket ${socket.id}`);
    
    // join room
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

    // send messages only to the user's room
    socket.on("chat", (msg) => {
        const roomCode = socket.data.roomCode;

        if (!roomCode) return;

        io.to(roomCode).emit("chat", msg);
    });

    socket.on("disconnect", (reason) => {
        console.log(`User disconnected on ${socket.id}, reason: ${reason}`);
    })
});

server.listen(port, hostname, () => {
  console.log(`Listening at: http://${hostname}:${port}`);
});