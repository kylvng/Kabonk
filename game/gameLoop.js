const {createPromptPool, tierForTurn} = require("./promptPool");

const START_HEARTS = 2;
const START_TIME = 8000;         // ms, bomb time at normal speed
const MIN_TIME = 4000;          // fastest the bomb gets
const STEP = 1500;              // how much faster each speed-up is
const SPEEDUP_EVERY = 30000;    // speed up every 30 s since the last explosion

// roomCode -> game state
const games = new Map(); 

function startGame(io,room) {
    const firstPlayer = room.players.find(p => !p.spectating);
    const game = {
        activeId: firstPlayer.id,
        hearts: {},                 // playerId -> hearts left
        usedWords: new Set(),
        speedStart: Date.now(),     // when the 30s clock start; reset on explosion
        turnCount: 0,
        prompt: null,
        validWords: null,
        timer: null,
        pool: createPromptPool()
    };
    
    for (const player of room.players) {
        if (!player.spectating) {
            game.hearts[player.id] = START_HEARTS;
        }
    }

    games.set(room.code, game);
    startTurn(io, room);

}

function startTurn(io, room){
    const game = games.get(room.code);
    const entry = game.pool.next(tierForTurn(game.turnCount));
    game.prompt = entry.prompt;
    game.validWords = entry.validWords;

    const elapsed = Date.now() - game.speedStart;
    const speedLevel = Math.floor(elapsed / SPEEDUP_EVERY);
    const duration = Math.max(MIN_TIME, START_TIME - STEP * speedLevel);
    game.timer = setTimeout(() => explode(io, room), duration);

    io.to(room.code).emit("turn-start", {
        activeId: game.activeId,
        prompt: game.prompt,
        duration,
        hearts: game.hearts
    });
}

function explode(io, room) {
    console.log(`KABONK in ${room.code}`);
    
}

module.exports = {games, startGame};