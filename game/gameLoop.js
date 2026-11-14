const {createPromptPool, tierForTurn} = require("./promptPool");
const { checkWord} = require("./wordCheck");

const START_HEARTS = 2;
const START_TIME = 8000;         // ms, bomb time at normal speed
const MIN_TIME = 4000;          // fastest the bomb gets
const STEP = 1500;              // how much faster each speed-up is
const SPEEDUP_EVERY = 30000;    // speed up every 30 s since the last explosion

// roomCode -> game state
const games = new Map(); 

function startGame(io,room) {

    const eligible = room.players.filter(p => !p.spectating);
    const firstPlayer = eligible[Math.floor(Math.random() * eligible.length)];
    const game = {
        activeId: firstPlayer.id,
        hearts: {},                 // playerId -> hearts left
        usedWords: new Set(),
        speedStart: Date.now(),     // when the 30s clock start; reset on explosion
        turnCount: 0,
        prompt: null,
        promptOwnerId: null,        // who first got the current prompt
        validWords: null,
        clearUsedOnNewPrompt: false,
        timer: null,
        pool: createPromptPool()
    };
    
    for (const player of room.players) {
        if (!player.spectating) {
            game.hearts[player.id] = START_HEARTS;
        }
    }

    games.set(room.code, game);
    startTurn(io, room, true);

}

function startTurn(io, room, newPrompt){
    const game = games.get(room.code);


    if (newPrompt){
        if (game.clearUsedOnNewPrompt) {
            game.usedWords.clear();
            game.clearUsedOnNewPrompt = false;
        }
        const entry = game.pool.next(tierForTurn(game.turnCount));
        game.prompt = entry.prompt;
        game.validWords = entry.validWords;
        game.promptOwnerId = game.activeId;
    }

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

// ids of players with hearts left
function aliveIds(game) {
    return Object.keys(game.hearts).filter(id => game.hearts[id] > 0);
}

function nextAlive(room, game){
    const ids = room.players.map(p => p.id);
    const start = ids.indexOf(game.activeId);
    for (let step = 1; step <= ids.length; step++){
        const id = ids[(start + step) % ids.length];
        if (game.hearts[id] > 0){
            return id;
        }
    }

    return null;
}

function passesSeat(room, fromId, toId, seatId){
    const ids = room.players.map(p => p.id);
    const start = ids.indexOf(fromId);
    for (let step = 1; step <= ids.length; step++){
        const id = ids[(start+step) %ids.length];
        if (id === seatId){
            return true;
        }
        if (id === toId){
            return false;
        }
    }
    return false;
}
 
function explode(io, room) {
    const game = games.get(room.code)    ;
    if (!game){
        return;
    }

    game.timer = null;

    const loserId = game.activeId;
    game.hearts[loserId] -= 1;
    game.speedStart = Date.now();       // losing a heart resets the speed
    game.clearUsedOnNewPrompt = true;   // reset used words once this prompt is gone

    io.to(room.code).emit("bomb-exploded", {
        playerId: loserId,
        hearts: game.hearts
    });

    const alive = aliveIds(game);
    if (alive.length=== 1){
        endGame(io, room, alive[0]);
        return;
    }

    const nextId = nextAlive(room,game);
    const newPrompt = passesSeat(room, loserId, nextId, game.promptOwnerId);
    game.activeId = nextId;
    startTurn(io, room, newPrompt);
}

function submitWord(io, room, playerId, input){
    const game = games.get(room.code);
    if (!game) {
        return;
    }

    if (playerId !== game.activeId){
        return;
    }

    const result = checkWord(input, game.prompt, game.validWords, game.usedWords);

    if (!result.valid){
        if (result.reason === "empty"){
            return;
        }

        // the whole room sees failed attempt
        io.to(room.code).emit("word-rejected", {
            playerId,
            word: String(input).trim().slice(0,30),
            reason: result.reason
        });
        return;
    }

    clearTimeout(game.timer);
    game.timer = null;
    game.usedWords.add(result.word);
    game.turnCount += 1;

    io.to(room.code).emit("word-accepted", {
        playerId: playerId,
        word: result.word
    });

    game.activeId = nextAlive(room, game);
    startTurn(io, room, true);
}

function endGame(io, room, winnerId){
        const game = games.get(room.code);
        clearTimeout(game.timer);
        games.delete(room.code);

        const winner = room.players.find(p => p.id === winnerId);
        io.to(room.code).emit("game-over", {
            winnerId,
            winnerName: winner.name
        });
    }

module.exports = {games, startGame, submitWord};