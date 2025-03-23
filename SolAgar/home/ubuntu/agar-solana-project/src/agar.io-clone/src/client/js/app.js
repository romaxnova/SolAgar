var io = require('socket.io-client');
var render = require('./render');
var ChatClient = require('./chat-client');
var Canvas = require('./canvas');
var global = require('./global');

var playerNameInput = document.getElementById('playerNameInput');
var socket;

// Solana/USDC integration variables
var walletConnected = false;
var userId = null;
var walletPublicKey = null;
var usdcBalance = 0;
var gameValue = 0;
var globalLiquidityPool = 0;
var hasDeposited = false;

var debug = function (args) {
    if (console && console.log) {
        console.log(args);
    }
};

if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
    global.mobile = true;
}

function startGame(type) {
    global.playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0, 25);
    global.playerType = type;

    global.screen.width = window.innerWidth;
    global.screen.height = window.innerHeight;

    document.getElementById('startMenuWrapper').style.maxHeight = '0px';
    document.getElementById('gameAreaWrapper').style.opacity = 1;
    if (!socket) {
        socket = io({ query: "type=" + type });
        setupSocket(socket);
    }
    if (!global.animLoopHandle)
        animloop();
    socket.emit('respawn');
    window.chat.socket = socket;
    window.chat.registerFunctions();
    window.canvas.socket = socket;
    global.socket = socket;
}

// Checks if the nick chosen contains valid alphanumeric characters (and underscores).
function validNick() {
    var regex = /^\w*$/;
    debug('Regex Test', regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null;
}

// Simulate wallet connection for development
function connectWallet() {
    if (walletConnected) return;
    
    // Simulate API call to create wallet
    fetch('/api/create-wallet', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            walletConnected = true;
            userId = data.userId;
            walletPublicKey = data.publicKey;
            
            // Update UI
            document.getElementById('walletStatusText').textContent = 'Connected: ' + walletPublicKey.substring(0, 6) + '...' + walletPublicKey.substring(walletPublicKey.length - 4);
            document.getElementById('connectWalletButton').style.display = 'none';
            document.getElementById('walletActions').style.display = 'block';
            
            // Update player data if in game
            if (global.gameStart && global.socket) {
                global.socket.emit('gotit', {
                    name: global.playerName,
                    userId: userId,
                    walletPublicKey: walletPublicKey,
                    usdcBalance: usdcBalance,
                    hasDeposited: hasDeposited
                });
            }
            
            window.chat.addSystemLine('Wallet connected successfully!');
        } else {
            window.chat.addSystemLine('Failed to connect wallet: ' + (data.error || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error connecting wallet:', error);
        window.chat.addSystemLine('Error connecting wallet. Please try again.');
    });
}

// Deposit 1 USDC to play
function depositUsdc() {
    if (!walletConnected) {
        window.chat.addSystemLine('Please connect your wallet first.');
        return;
    }
    
    if (hasDeposited) {
        window.chat.addSystemLine('You have already deposited USDC to play.');
        return;
    }
    
    socket.emit('depositUsdc');
}

// Withdraw USDC
function withdrawUsdc() {
    if (!walletConnected) {
        window.chat.addSystemLine('Please connect your wallet first.');
        return;
    }
    
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const destinationAddress = document.getElementById('destinationAddress').value;
    
    if (isNaN(amount) || amount < 5) {
        window.chat.addSystemLine('Minimum withdrawal amount is 5 USDC.');
        return;
    }
    
    if (!destinationAddress) {
        window.chat.addSystemLine('Please enter a destination address.');
        return;
    }
    
    socket.emit('withdrawUsdc', {
        amount: amount,
        destinationAddress: destinationAddress
    });
}

// Update USDC balance display
function updateUsdcDisplay() {
    document.getElementById('walletBalance').textContent = usdcBalance.toFixed(2);
    document.getElementById('gameValue').textContent = gameValue.toFixed(2);
    document.getElementById('globalPool').textContent = globalLiquidityPool.toFixed(2);
    
    // Show withdrawal section if balance is sufficient
    if (usdcBalance >= 5) {
        document.getElementById('withdrawalSection').style.display = 'block';
    } else {
        document.getElementById('withdrawalSection').style.display = 'none';
    }
}

window.onload = function () {

    var btn = document.getElementById('startButton'),
        btnS = document.getElementById('spectateButton'),
        nickErrorText = document.querySelector('#startMenu .input-error');
        
    // Solana/USDC integration UI elements
    var connectWalletBtn = document.getElementById('connectWalletButton'),
        depositBtn = document.getElementById('depositButton'),
        withdrawBtn = document.getElementById('withdrawButton');
    
    // Set up wallet connection button
    connectWalletBtn.onclick = function() {
        connectWallet();
    };
    
    // Set up deposit button
    depositBtn.onclick = function() {
        depositUsdc();
    };
    
    // Set up withdraw button
    withdrawBtn.onclick = function() {
        withdrawUsdc();
    };

    btnS.onclick = function () {
        startGame('spectator');
    };

    btn.onclick = function () {
        // Checks if the nick is valid.
        if (validNick()) {
            nickErrorText.style.opacity = 0;
            
            // Check if wallet is connected and has deposited
            if (walletConnected && hasDeposited) {
                startGame('player');
            } else if (walletConnected && !hasDeposited) {
                window.chat.addSystemLine('Please deposit 1 USDC to play.');
                depositBtn.focus();
            } else {
                window.chat.addSystemLine('Please connect your wallet first.');
                connectWalletBtn.focus();
            }
        } else {
            nickErrorText.style.opacity = 1;
        }
    };

    var settingsMenu = document.getElementById('settingsButton');
    var settings = document.getElementById('settings');

    settingsMenu.onclick = function () {
        if (settings.style.maxHeight == '300px') {
            settings.style.maxHeight = '0px';
        } else {
            settings.style.maxHeight = '300px';
        }
    };

    playerNameInput.addEventListener('keypress', function (e) {
        var key = e.which || e.keyCode;

        if (key === global.KEY_ENTER) {
            if (validNick()) {
                nickErrorText.style.opacity = 0;
                
                // Check if wallet is connected and has deposited
                if (walletConnected && hasDeposited) {
                    startGame('player');
                } else if (walletConnected && !hasDeposited) {
                    window.chat.addSystemLine('Please deposit 1 USDC to play.');
                    depositBtn.focus();
                } else {
                    window.chat.addSystemLine('Please connect your wallet first.');
                    connectWalletBtn.focus();
                }
            } else {
                nickErrorText.style.opacity = 1;
            }
        }
    });
};

// TODO: Break out into GameControls.

var playerConfig = {
    border: 6,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var player = {
    id: -1,
    x: global.screen.width / 2,
    y: global.screen.height / 2,
    screenWidth: global.screen.width,
    screenHeight: global.screen.height,
    target: { x: global.screen.width / 2, y: global.screen.height / 2 }
};
global.player = player;

var foods = [];
var viruses = [];
var fireFood = [];
var users = [];
var leaderboard = [];
var target = { x: player.x, y: player.y };
global.target = target;

window.canvas = new Canvas();
window.chat = new ChatClient();

var visibleBorderSetting = document.getElementById('visBord');
visibleBorderSetting.onchange = settings.toggleBorder;

var showMassSetting = document.getElementById('showMass');
showMassSetting.onchange = settings.toggleMass;

var continuitySetting = document.getElementById('continuity');
continuitySetting.onchange = settings.toggleContinuity;

var roundFoodSetting = document.getElementById('roundFood');
roundFoodSetting.onchange = settings.toggleRoundFood;

var c = window.canvas.cv;
var graph = c.getContext('2d');

$("#feed").click(function () {
    socket.emit('1');
    window.canvas.reenviar = false;
});

$("#split").click(function () {
    socket.emit('2');
    window.canvas.reenviar = false;
});

function handleDisconnect() {
    socket.close();
    if (!global.kicked) { // We have a more specific error message 
        render.drawErrorMessage('Disconnected!', graph, global.screen);
    }
}

// socket stuff.
function setupSocket(socket) {
    // Handle ping.
    socket.on('pongcheck', function () {
        var latency = Date.now() - global.startPingTime;
        debug('Latency: ' + latency + 'ms');
        window.chat.addSystemLine('Ping: ' + latency + 'ms');
    });

    // Handle error.
    socket.on('connect_error', handleDisconnect);
    socket.on('disconnect', handleDisconnect);

    // Handle connection.
    socket.on('welcome', function (playerSettings, gameSizes) {
        player = playerSettings;
        player.name = global.playerName;
        player.screenWidth = global.screen.width;
        player.screenHeight = global.screen.height;
        player.target = window.canvas.target;
        
        // Add wallet data if connected
        if (walletConnected) {
            player.userId = userId;
            player.walletPublicKey = walletPublicKey;
            player.usdcBalance = usdcBalance;
            player.hasDeposited = hasDeposited;
        }
        
        global.player = player;
        window.chat.player = player;
        socket.emit('gotit', player);
        global.gameStart = true;
        window.chat.addSystemLine('Connected to the game!');
        window.chat.addSystemLine('Type <b>-help</b> for a list of commands.');
        if (global.mobile) {
            document.getElementById('gameAreaWrapper').removeChild(document.getElementById('chatbox'));
        }
        c.focus();
        global.game.width = gameSizes.width;
        global.game.height = gameSizes.height;
        resize();
    });

    // USDC integration events
    socket.on('depositRequired', function(data) {
        window.chat.addSystemLine(data.message);
        if (walletConnected && !hasDeposited) {
            document.getElementById('depositButton').focus();
        }
    });
    
    socket.on('depositSuccess', function(data) {
        hasDeposited = true;
        usdcBalance = data.balance;
        window.chat.addSystemLine(data.message);
        updateUsdcDisplay();
    });
    
    socket.on('depositFailed', function(data) {
        window.chat.addSystemLine(data.message);
    });
    
    socket.on('withdrawSuccess', function(data) {
        usdcBalance = data.balance;
        window.chat.addSystemLine(data.message + ' (Amount: ' + data.amount + ' USDC, Fee: ' + data.fee + ' USDC)');
        updateUsdcDisplay();
    });
    
    socket.on('withdrawFailed', function(data) {
        window.chat.addSystemLine(data.message);
    });
    
    socket.on('usdcUpdate', function(data) {
        usdcBalance = data.balance;
        gameValue = data.gameValue;
        if (data.globalLiquidityPool) {
            globalLiquidityPool = data.globalLiquidityPool;
        }
        updateUsdcDisplay();
    });

    socket.on('playerDied', (data) => {
        const player = isUnnamedCell(data.playerEatenName) ? 'An unnamed cell' : data.playerEatenName;
        //const killer = isUnnamedCell(data.playerWhoAtePlayerName) ? 'An unnamed cell' : data.playerWhoAtePlayerName;

        //window.chat.addSystemLine('{GAME} - <b>' + (player) + '</b> was eaten by <b>' + (killer) + '</b>');
        window.chat.addSystemLine('{GAME} - <b>' + (player) + '</b> was eaten');
    });

    socket.on('playerDisconnect', (data) => {
        window.chat.addSystemLine('{GAME} - <b>' + (isUnnamedCell(data.name) ? 'An unnamed cell' : data.name) + '</b> disconnected.');
    });

    socket.on('playerJoin', (data) => {
        window.chat.addSystemLine('{GAME} - <b>' + (isUnnamedCell(data.name) ? 'An unnamed cell' : data.name) + '</b> joined.');
    });

    socket.on('leaderboard', (data) => {
        leaderboard = data.leaderboard;
        var status = '<span class="title">Leaderboard</span>';
        for (var i = 0; i < leaderboard.length; i++) {
            status += '<br />';
            if (leaderboard[i].id == player.id) {
                if (leaderboard[i].name.length !== 0)
                    status += '<span class="me">' + (i + 1) + '. ' + leaderboard[i].name + " (" + (leaderboard[i].gameValue || 0).toFixed(2) + " USDC)</span>";
                else
                    status += '<span class="me">' + (i + 1) + ". An unnamed cell</span>";
            } else {
                if (leaderboard[i].name.length !== 0)
                    status += (i + 1) + '. ' + leaderboard[i].name + " (" + (leaderboard[i].gameValue || 0).toFixed(2) + " USDC)";
                else
                    status += (i + 1) + '. An unnamed cell';
            }
        }
        //status += '<br />Players: ' + data.players;
        document.getElementById('status').innerHTML = status;
    });

    socket.on('serverMSG', function (data) {
        window.chat.addSystemLine(data);
    });

    // Chat.
    socket.on('serverSendPlayerChat', function (data) {
        window.chat.addChatLine(data.sender, data.message, false);
    });

    // Handle movement.
    socket.on('serverTellPlayerMove', function (playerData, userData, foodsList, massList, virusList) {
        if (global.playerType == 'player') {
            player.x = playerData.x;
            player.y = playerData.y;
            player.hue = playerData.hue;
            player.massTotal = playerData.massTotal;
            player.cells = playerData.cells;
            
            // Update USDC game value if available
            if (playerData.gameValue !== undefined) {
                gameValue = playerData.gameValue;
                updateUsdcDisplay();
            }
        }
        users = userData;
        foods = foodsList;
        viruses = virusList;
        fireFood = massList;
    });

    // Death.
    socket.on('RIP', function () {
        global.gameStart = false;
        render.drawErrorMessage('You died!', graph, global.screen);
        window.setTimeout(() => {
            document.getElementById('gameAreaWrapper').style.opacity = 0;
            document.getElementById('startMenuWrapper').style.maxHeight = '1000px';
            if (global.animLoopHandle) {
                window.cancelAnimationFrame(global.animLoopHandle);
                global.animLoopHandle = undefined;
            }
        }, 2500);
    });

    socket.on('kick', function (reason) {
        global.gameStart = false;
        global.kicked = true;
        if (reason !== '') {
            render.drawErrorMessage('You were kicked for: ' + reason, graph, global.screen);
        }
        else {
            render.drawErrorMessage('You were kicked!', graph, global.screen);
        }
        socket.close();
    });
}

const isUnnamedCell = (name) => name.length < 1;

const getPosition = (entity, player, screen) => {
    return {
       <response clipped><NOTE>To save on context only part of this file has been shown to you. You should retry this tool after you have searched inside the file with `grep -n` in order to find the line numbers of what you are looking for.</NOTE>