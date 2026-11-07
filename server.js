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

io.on('connection', (socket) => {
    console.log(`User connect on socket ${socket.id}`);
    
    socket.on("disconnect", (reason) => {
        console.log(`User disconnected on ${socket.id}, reason: ${reason}`);
    })
});

server.listen(port, hostname, () => {
  console.log(`Listening at: http://${hostname}:${port}`);
});