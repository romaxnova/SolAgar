/*jslint bitwise: true, node: true */
'use strict';

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const SAT = require('sat');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');

const gameLogic = require('./game-logic');
const loggingRepositry = require('./repositories/logging-repository');
const chatRepository = require('./repositories/chat-repository');
const config = require('../../config');
const util = require('./lib/util');
const mapUtils = require('./map/map');
const {getPosition} = require("./lib/entityUtils");

// Backend API URL for Solana/USDC operations
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3001';

let map = new mapUtils.Map(config);

let sockets = {};
let spectators = [];
const INIT_MASS_LOG = util.mathLog(config.defaultPlayerMass, config.slowBase);

let leaderboard = [];
let leaderboardChanged = false;

const Vector = SAT.Vector;

// Add middleware for API endpoints
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(__dirname + '/../client'));

// API endpoints for Solana/USDC integration
app.post('/api/deposit', async (req, res) => {
    try {
        const { userId, amount } = req.body;
        
        if (!userId || !amount) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        // Call backend API to process deposit
        const response = await axios.post(`${BACKEND_API_URL}/api/deposit`, req.body);
        
        // Update player in game if they're connected
        const playerIndex = map.players.findIndexByUserId(userId);
        if (playerIndex > -1) {
            const player = map.players.data[playerIndex];
            player.hasDeposited = true;
            player.usdcBalance = response.data.newBalance;
            
            // Add to global liquidity pool
            map.players.globalLiquidityPool += amount;
            
            // Notify player
            if (sockets[player.id]) {
                sockets[player.id].emit('usdcUpdate', {
                    balance: player.usdcBalance,
                    gameValue: player.gameValue
                });
            }
        }
        
        res.json(response.data);
    } catch (error) {
        console.error('Error processing deposit:', error);
        res.status(500).json({ success: false, error: 'Failed to process deposit' });
    }
});

app.post('/api/withdraw', async (req, res) => {
    try {
        const { userId, amount, destinationAddress } = req.body;
        
        if (!userId || !amount || !destinationAddress) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        // Call backend API to process withdrawal
        const response = await axios.post(`${BACKEND_API_URL}/api/withdraw`, req.body);
        
        // Update player in game if they're connected
        const playerIndex = map.players.findIndexByUserId(userId);
        if (playerIndex > -1) {
            const player = map.players.data[playerIndex];
            player.usdcBalance = player.usdcBalance - amount;
            
            // Notify player
            if (sockets[player.id]) {
                sockets[player.id].emit('usdcUpdate', {
                    balance: player.usdcBalance,
                    gameValue: player.gameValue
                });
            }
        }
        
        res.json(response.data);
    } catch (error) {
        console.error('Error processing withdrawal:', error);
        res.status(500).json({ success: false, error: 'Failed to process withdrawal' });
    }
});

app.get('/api/game-stats', (req, res) => {
    res.json({
        success: true,
        globalLiquidityPool: map.players.globalLiquidityPool,
        activePlayers: map.players.data.length,
        topPlayers: leaderboard
    });
});

io.on('connection', function (socket) {
    let type = socket.handshake.query.type;
    console.log('User has connected: ', type);
    switch (type) {
        case 'player':
            addPlayer(socket);
            break;
        case 'spectator':
            addSpectator(socket);
            break;
        default:
            console.log('Unknown user type, not doing anything.');
    }
});

function generateSpawnpoint() {
    let radius = util.massToRadius(config.defaultPlayerMass);
    return getPosition(config.newPlayerInitialPosition === 'farthest', radius, map.players.data)
}


const addPlayer = (socket) => {
    var currentPlayer = new mapUtils.playerUtils.Player(socket.id);

    socket.on('gotit', function (clientPlayerData) {
        console.log('[INFO] Player ' + clientPlayerData.name + ' connecting!');
        currentPlayer.init(generateSpawnpoint(), config.defaultPlayerMass);

        if (map.players.findIndexByID(socket.id) > -1) {
            console.log('[INFO] Player ID is already connected, kicking.');
            socket.disconnect();
        } else if (!util.validNick(clientPlayerData.name)) {
            socket.emit('kick', 'Invalid username.');
            socket.disconnect();
        } else {
            console.log('[INFO] Player ' + clientPlayerData.name + ' connected!');
            sockets[socket.id] = socket;
            currentPlayer.clientProvidedData(clientPlayerData);
            
            // Check if player has deposited USDC to play
            if (currentPlayer.userId && currentPlayer.hasDeposited) {
                console.log(`[USDC] Player ${currentPlayer.name} has deposited 1 USDC to play`);
            } else {
                // If player hasn't deposited, notify them
                socket.emit('depositRequired', {
                    message: 'Deposit 1 USDC to play'
                });
            }
            
            map.players.pushNew(currentPlayer);
            io.emit('playerJoin', { name: currentPlayer.name });
            console.log('Total players: ' + map.players.data.length);
        }

    });

    socket.on('pingcheck', () => {
        socket.emit('pongcheck');
    });

    socket.on('windowResized', (data) => {
        currentPlayer.screenWidth = data.screenWidth;
        currentPlayer.screenHeight = data.screenHeight;
    });

    socket.on('respawn', () => {
        // Check if player has deposited USDC to play
        if (currentPlayer.userId && !currentPlayer.hasDeposited) {
            socket.emit('depositRequired', {
                message: 'Deposit 1 USDC to play'
            });
            return;
        }
        
        map.players.removePlayerByID(currentPlayer.id);
        socket.emit('welcome', currentPlayer, {
            width: config.gameWidth,
            height: config.gameHeight
        });
        console.log('[INFO] User ' + currentPlayer.name + ' has respawned');
    });

    socket.on('disconnect', () => {
        // If player has deposited and has game value, update their balance
        if (currentPlayer.userId && currentPlayer.hasDeposited && currentPlayer.gameValue > 0) {
            // Call backend API to update player's balance
            axios.post(`${BACKEND_API_URL}/api/deposit`, {
                userId: currentPlayer.userId,
                amount: currentPlayer.gameValue,
                txSignature: 'game_reward_' + Date.now()
            }).catch(err => {
                console.error('[USDC] Failed to update player balance on disconnect:', err);
            });
        }
        
        map.players.removePlayerByID(currentPlayer.id);
        console.log('[INFO] User ' + currentPlayer.name + ' has disconnected');
        socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
    });

    socket.on('playerChat', (data) => {
        var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
        var _message = data.message.replace(/(<([^>]+)>)/ig, '');

        if (config.logChat === 1) {
            console.log('[CHAT] [' + (new Date()).getHours() + ':' + (new Date()).getMinutes() + '] ' + _sender + ': ' + _message);
        }

        socket.broadcast.emit('serverSendPlayerChat', {
            sender: _sender,
            message: _message.substring(0, 35)
        });

        chatRepository.logChatMessage(_sender, _message, currentPlayer.ipAddress)
            .catch((err) => console.error("Error when attempting to log chat message", err));
    });

    socket.on('pass', async (data) => {
        const password = data[0];
        if (password === config.adminPass) {
            console.log('[ADMIN] ' + currentPlayer.name + ' just logged in as an admin.');
            socket.emit('serverMSG', 'Welcome back ' + currentPlayer.name);
            socket.broadcast.emit('serverMSG', currentPlayer.name + ' just logged in as an admin.');
            currentPlayer.admin = true;
        } else {
            console.log('[ADMIN] ' + currentPlayer.name + ' attempted to log in with incorrect password.');

            socket.emit('serverMSG', 'Password incorrect, attempt logged.');

            loggingRepositry.logFailedLoginAttempt(currentPlayer.name, currentPlayer.ipAddress)
                .catch((err) => console.error("Error when attempting to log failed login attempt", err));
        }
    });

    socket.on('kick', (data) => {
        if (!currentPlayer.admin) {
            socket.emit('serverMSG', 'You are not permitted to use this command.');
            return;
        }

        var reason = '';
        var worked = false;
        for (let playerIndex in map.players.data) {
            let player = map.players.data[playerIndex];
            if (player.name === data[0] && !player.admin && !worked) {
                if (data.length > 1) {
                    for (var f = 1; f < data.length; f++) {
                        if (f === data.length) {
                            reason = reason + data[f];
                        }
                        else {
                            reason = reason + data[f] + ' ';
                        }
                    }
                }
                if (reason !== '') {
                    console.log('[ADMIN] User ' + player.name + ' kicked successfully by ' + currentPlayer.name + ' for reason ' + reason);
                }
                else {
                    console.log('[ADMIN] User ' + player.name + ' kicked successfully by ' + currentPlayer.name);
                }
                socket.emit('serverMSG', 'User ' + player.name + ' was kicked by ' + currentPlayer.name);
                sockets[player.id].emit('kick', reason);
                sockets[player.id].disconnect();
                map.players.removePlayerByIndex(playerIndex);
                worked = true;
            }
        }
        if (!worked) {
            socket.emit('serverMSG', 'Could not locate user or user is an admin.');
        }
    });

    // Added for Solana integration
    socket.on('depositUsdc', async (data) => {
        try {
            if (!currentPlayer.userId) {
                socket.emit('serverMSG', 'You need to connect a wallet first.');
                return;
            }
            
            // Call backend API to process deposit
            const response = await axios.post(`${BACKEND_API_URL}/api/deposit`, {
                userId: currentPlayer.userId,
                amount: 1, // 1 USDC to play
                txSignature: 'game_deposit_' + Date.now()
            });
            
            if (response.data.success) {
                currentPlayer.hasDeposited = true;
                currentPlayer.usdcBalance = response.data.newBalance;
                
                // Add to global liquidity pool
                map.players.globalLiquidityPool += 1;
                
                socket.emit('depositSuccess', {
                    balance: currentPlayer.usdcBalance,
                    message: 'Successfully deposited 1 USDC to play'
                });
            } else {
                socket.emit('depositFailed', {
                    message: 'Failed to process deposit'
                });
            }
        } catch (error) {
            console.error('[USDC] Deposit error:', error);
            socket.emit('depositFailed', {
                message: 'Failed to process deposit'
            });
        }
    });
    
    socket.on('withdrawUsdc', async (data) => {
        try {
            if (!currentPlayer.userId) {
                socket.emit('serverMSG', 'You need to connect a wallet first.');
                return;
            }
            
            if (!data.amount || !data.destinationAddress) {
                socket.emit('serverMSG', 'Invalid withdrawal request.');
                return;
            }
            
            // Check minimum withdrawal amount (5 USDC)
            if (data.amount < 5) {
                socket.emit('withdrawFailed', {
                    message: 'Minimum withdrawal amount is 5 USDC'
                });
                return;
            }
            
            // Check if player has enough balance
            if (currentPlayer.usdcBalance < data.amount) {
                socket.emit('withdrawFailed', {
                    message: 'Insufficient balance'
                });
                return;
            }
            
            // Call backend API to process withdrawal
            const response = await axios.post(`${BACKEND_API_URL}/api/withdraw`, {
                userId: currentPlayer.userId,
                amount: data.amount,
                destinationAddress: data.destinationAddress
            });
            
            if (response.data.success) {
                currentPlayer.usdcBalance -= data.amount;
                
                socket.emit('withdrawSuccess', {
                    balance: currentPlayer.usdcBalance,
                    amount: response.data.withdrawalAmount,
                    fee: response.data.fee,
                    message: 'Successfully withdrew USDC'
                });
            } else {
                socket.emit('withdrawFailed', {
                    message: 'Failed to process withdrawal'
                });
            }
        } catch (error) {
            console.error('[USDC] Withdrawal error:', error);
            socket.emit('withdrawFailed', {
                message: 'Failed to process withdrawal'
            });
        }
    });

    // Heartbeat function, update everytime.
    socket.on('0', (target) => {
        currentPlayer.lastHeartbeat = new Date().getTime();
        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
            currentPlayer.target = target;
        }
    });

    socket.on('1', function () {
        // Fire food.
        const minCellMass = config.defaultPlayerMass + config.fireFood;
        for (let i = 0; i < currentPlayer.cells.length; i++) {
            if (currentPlayer.cells[i].mass >= minCellMass) {
                currentPlayer.changeCellMass(i, -config.fireFood);
                map.massFood.addNew(currentPlayer, i, config.fireFood);
            }
        }
    });

    socket.on('2', () => {
        currentPlayer.userSplit(config.limitSplit, config.defaultPlayerMass);
    });
}

const addSpectator = (socket) => {
    socket.on('gotit', function () {
        sockets[socket.id] = socket;
        spectators.push(socket.id);
        io.emit('playerJoin', { name: '' });
    });

    socket.emit("welcome", {}, {
        width: config.gameWidth,
        height: config.gameHeight
    });
}

const tickPlayer = (currentPlayer) => {
    if (currentPlayer.lastHeartbeat < new Date().getTime() - config.maxHeartbeatInterval) {
        sockets[currentPlayer.id].emit('kick', 'Last heartbeat received over ' + config.maxHeartbeatInterval + ' ago.');
        sockets[currentPlayer.id].disconnect();
    }

    currentPlayer.move(config.slowBase, config.gameWidth, config.gameHeight, INIT_MASS_LOG);

    const isEntityInsideCi<response clipped><NOTE>To save on context only part of this file has been shown to you. You should retry this tool after you have searched inside the file with `grep -n` in order to find the line numbers of what you are looking for.</NOTE>