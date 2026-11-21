const { playerLeft } = require("./gameLoop");
const db = require("../db");
const store = require("../db/roomStore");

const rooms = new Map();
const RESTORE_GRACE = Number(process.env.RESTORE_GRACE_MS) || 30000;   // how long restored players have to reconnect

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

    if (code) {
        socket.leave(code);
    }
    socket.data.roomCode = undefined;
    socket.data.playerId = undefined;

    if (!room){
        return;
    }

    // find if the socket is an old socket, only the current socket attached to the player can remove them
    const player = room.players.find(p => p.id === playerId);
    if (!player || player.socketId !== socket.id){
        return;
    }

    removePlayer(io, room, playerId);
}

function removePlayer(io, room, playerId){
    // game must first know who left, then the room can filter out players
    playerLeft(io, room, playerId);

    room.players = room.players.filter(p => p.id !== playerId);
    store.removePlayer(room.code, playerId);

    if (room.players.length === 0){
        rooms.delete(room.code);
        store.deleteRoom(room.code);
        return;
    }

    if (room.hostId === playerId){
        room.hostId = room.players[0].id;
        store.setHost(room.code, room.hostId);
    }

    io.to(room.code).emit("room-update", room);
}

// Loads rooms saved before a restart. Players get their seat back by rejoining
// (the room page rejoins on reconnect); anyone who doesn't within graceMs is removed.
// Games in progress go back to the lobby, since game state isn't saved.
async function restoreRooms(io, graceMs = RESTORE_GRACE){
    if (!db.enabled){
        return [];
    }

    await db.init();
    const restored = await store.loadRooms();

    for (const room of restored){
        if (room.players.length === 0){
            store.deleteRoom(room.code);
            continue;
        }
        if (!room.players.some(p => p.id === room.hostId)){
            room.hostId = room.players[0].id;
            store.setHost(room.code, room.hostId);
        }
        if (room.status === "playing"){
            room.status = "lobby";
            for (const player of room.players){
                player.spectating = false;
            }
            store.setStatus(room.code, "lobby");
        }
        rooms.set(room.code, room);
    }

    const cleanup = setTimeout(() => {
        for (const room of restored){
            if (rooms.get(room.code) !== room){
                continue;
            }
            for (const player of [...room.players]){
                if (player.socketId === null){
                    removePlayer(io, room, player.id);
                }
            }
        }
    }, graceMs);
    cleanup.unref();

    return restored.filter(room => rooms.get(room.code) === room);
}

module.exports = { rooms, makeRoomCode, leaveRoom, removePlayer, restoreRooms };
