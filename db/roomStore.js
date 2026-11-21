const db = require("./index");


function saveRoom(room) {
    db.write(
        `INSERT INTO rooms (code, host_id, status) VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE
         SET host_id = EXCLUDED.host_id, status = EXCLUDED.status, updated_at = now()`,
        [room.code, room.hostId, room.status]
    );
    db.write("DELETE FROM players WHERE room_code = $1", [room.code]);
    for (const player of room.players) {
        addPlayer(room.code, player);
    }
}

function addPlayer(code, player) {
    db.write(
        `INSERT INTO players (room_code, id, name, spectating) VALUES ($1, $2, $3, $4)
         ON CONFLICT (room_code, id) DO UPDATE SET name = EXCLUDED.name, spectating = EXCLUDED.spectating`,
        [code, player.id, player.name, Boolean(player.spectating)]
    );
}

function removePlayer(code, playerId) {
    db.write("DELETE FROM players WHERE room_code = $1 AND id = $2", [code, playerId]);
}

function deleteRoom(code) {
    db.write("DELETE FROM rooms WHERE code = $1", [code]);
}

function setHost(code, hostId) {
    db.write("UPDATE rooms SET host_id = $2, updated_at = now() WHERE code = $1", [code, hostId]);
}

function setStatus(code, status) {
    db.write("UPDATE rooms SET status = $2, updated_at = now() WHERE code = $1", [code, status]);
    if (status === "lobby") {
        db.write("UPDATE players SET spectating = false WHERE room_code = $1", [code]);
    }
}

async function loadRooms() {
    await db.flush();
    const { rows: roomRows } = await db.query("SELECT code, host_id, status FROM rooms");
    const { rows: playerRows } = await db.query(
        "SELECT room_code, id, name, spectating FROM players ORDER BY seat"
    );

    const rooms = roomRows.map((r) => ({ code: r.code, hostId: r.host_id, status: r.status, players: [] }));
    const byCode = new Map(rooms.map((room) => [room.code, room]));
    for (const p of playerRows) {
        byCode.get(p.room_code)?.players.push({
            id: p.id,
            name: p.name,
            socketId: null,
            spectating: p.spectating,
        });
    }
    return rooms;
}

module.exports = { saveRoom, addPlayer, removePlayer, deleteRoom, setHost, setStatus, loadRooms };
