const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = {};

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('createRoom', (playerName, callback) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            players: [{ id: socket.id, name: playerName, position: { x: 0, y: 2.4, z: 0 }, caught: false, isWaving: false, waveTime: 0, isCrouching: false, crouchAmount: 0, isMoving: false, animationTime: 0 }],
            hunter: null,
            gameStarted: false,
            creatorId: socket.id // Store the creator's ID
        };
        socket.join(roomCode);
        callback(roomCode);
        io.to(roomCode).emit('playerList', rooms[roomCode].players);
    });

    socket.on('joinRoom', (roomCode, playerName, callback) => {
        if (rooms[roomCode]) {
            if (rooms[roomCode].gameStarted) {
                callback({ success: false, message: 'Game already started' });
                return;
            }
            rooms[roomCode].players.push({ id: socket.id, name: playerName, position: { x: 0, y: 2.4, z: 0 }, caught: false, isWaving: false, waveTime: 0, isCrouching: false, crouchAmount: 0, isMoving: false, animationTime: 0 });
            socket.join(roomCode);
            callback({ success: true, roomCode });
            io.to(roomCode).emit('playerList', rooms[roomCode].players);
        } else {
            callback({ success: false, message: 'Invalid room code' });
        }
    });

    socket.on('startGame', (roomCode) => {
        if (rooms[roomCode] && !rooms[roomCode].gameStarted && socket.id === rooms[roomCode].creatorId) {
            rooms[roomCode].gameStarted = true;
            const hunterIndex = Math.floor(Math.random() * rooms[roomCode].players.length);
            rooms[roomCode].hunter = rooms[roomCode].players[hunterIndex].id;
            io.to(roomCode).emit('gameStarted', { hunter: rooms[roomCode].hunter });
            io.to(roomCode).emit('playerList', rooms[roomCode].players);
        }
    });

    socket.on('updatePosition', (roomCode, position, animationState) => {
        if (rooms[roomCode]) {
            const player = rooms[roomCode].players.find(p => p.id === socket.id);
            if (player && !player.caught) {
                player.position = position;
                player.isWaving = animationState.isWaving;
                player.waveTime = animationState.waveTime;
                player.isCrouching = animationState.isCrouching;
                player.crouchAmount = animationState.crouchAmount;
                player.isMoving = animationState.isMoving;
                player.animationTime = animationState.animationTime;
                io.to(roomCode).emit('playerMoved', { id: socket.id, position, animationState });
            }
        }
    });

    socket.on('playerTagged', (roomCode, taggedPlayerId) => {
        if (rooms[roomCode]) {
            const taggedPlayer = rooms[roomCode].players.find(p => p.id === taggedPlayerId);
            if (taggedPlayer && !taggedPlayer.caught) {
                taggedPlayer.caught = true;
                io.to(roomCode).emit('playerCaught', taggedPlayerId);

                const allCaught = rooms[roomCode].players.every(p => p.caught || p.id === rooms[roomCode].hunter);
                if (allCaught) {
                    io.to(roomCode).emit('gameOver', { winner: 'hunter' });
                    delete rooms[roomCode];
                }
            }
        }
    });

    socket.on('disconnect', () => {
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                io.to(roomCode).emit('playerList', room.players);
                if (room.players.length === 0) delete rooms[roomCode];
                break;
            }
        }
        console.log('Player disconnected:', socket.id);
    });
});

server.listen(3000, () => console.log('Server running on port 3000'));
