const { playerLeft } = require("./gameLoop");

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

function leaveRoom(io, socket){
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

    // game must first know who left, then the room can filter out players
    playerLeft(io, room, playerId);    

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

module.exports = { rooms, makeRoomCode, leaveRoom };
