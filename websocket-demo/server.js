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
    
    socket.on("chat", (msg) => {
        io.emit("chat", msg);
    })

    socket.on("disconnect", (reason) => {
        console.log(`User disconnected on ${socket.id}, reason: ${reason}`);
    })
});

server.listen(port, hostname, () => {
  console.log(`Listening at: http://${hostname}:${port}`);
});