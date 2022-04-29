const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { Webhook, MessageBuilder } = require("discord-webhook-node");
const res = require("express/lib/response");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));

app.use("/", express.static("public"));

class Player {
    static players = {};

    constructor(socket) {
        this.socket = socket;

        Player.players[socket.id] = this;
    }
}

function makeID(length) {
    let id = "";
    let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let i = 0; i < length; i++) {
        id += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return id;
}

function randInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
}

io.on("connection", (socket) => {
    console.log("A user connected!", socket.id);
    let player;

    socket.on("join", (newPlayer, callback) => {
        // console.log("in", player);
        console.log(socket.id, "join:", newPlayer);

        player = new Player(socket);

        Object.assign(player, newPlayer);

        let playersForClient = {};

        for (let otherPlayerSocketID in Player.players) {
            let otherPlayer = Player.players[otherPlayerSocketID];

            if (otherPlayer === player) continue;

            let theirSocket = otherPlayer.socket;
            otherPlayer.socket = null;

            playersForClient[theirSocket.id] = {
                ...otherPlayer
            };

            otherPlayer.socket = theirSocket;
        }
        console.log(playersForClient);

        callback({
            players: playersForClient
        });

        player.socket = null;
        socket.broadcast.emit("join", socket.id, player);
        player.socket = socket;
    });

    socket.on("direction", (direction) => {
        player.direction = direction;
        socket.broadcast.emit("direction", player.socket.id, direction);
    });

    socket.on("position", (x, y) => {
        player.x = x;
        player.y = y;
        socket.broadcast.emit("position", player.socket.id, x, y);
    });

    socket.on("path", (pos, reset) => {
        if (reset) {
            player.snekPath = pos;
            player.startTime = Date.now();
        } else {
            player.snekPath.push(pos);
        }
        socket.broadcast.emit("path", player.socket.id, pos, reset);
    });

    socket.on("boost start", () => {
        player.snekSpeed = 0.8;
        socket.broadcast.emit("boost start", socket.id);
    });
    socket.on("boost stop", () => {
        player.snekSpeed = 0.25;
        socket.broadcast.emit("boost stop", socket.id);
    });

    socket.on("username", (username) => {
        player.username = username;
        io.emit("username", socket.id, username);
    });
    socket.on("color", (color) => {
        player.color = color;
        io.emit("color", socket.id, color);
    });
    socket.on("snekSize", (snekSize) => {
        player.snekSize = snekSize;
        io.emit("snekSize", socket.id, snekSize);
    });
    socket.on("dead", (dead) => {
        player.dead = dead;
        io.emit("dead", socket.id, dead);


        if (dead) {
            let alivePlayers = [];

            for (let socketID in Player.players) {
                if (!Player.players[socketID].dead) alivePlayers.push(socketID);
            }

            if (alivePlayers.length === 1) {
                Player.players[alivePlayers[0]].wins++;
                io.emit("win", alivePlayers[0]);
            }
        }


    });

    socket.on("disconnecting", () => {
        console.log(socket.id, player.username, "disconnecting");
        io.emit("leave", socket.id);
        delete Player.players[socket.id];
    });

    socket.on("disconnect", () => {
        console.log("A user disconnected!", socket.id);
    });
});

server.listen(PORT, () => {
    console.log("Listening on port", PORT);
});