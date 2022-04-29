const gameCanvas = document.getElementById("game");
const gridCanvas = document.getElementById("grid");
const leaderboardList = document.getElementById("leaderboard-list");
const usernameInput = document.getElementById("username-input");
const colorInput = document.getElementById("color-input");
const showNamesInput = document.getElementById("show-names-input");
const snekSizeInput = document.getElementById("snek-size-input");

const socket = io({
    reconnection: false
});

const ctx = gameCanvas.getContext("2d");
const gridCtx = gridCanvas.getContext("2d");

const ls = window.localStorage;

let scoreUpdateInterval;
let showNames = true;

function randInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max) + 1;
    return Math.floor(Math.random() * (max - min) + min);
}

if (!ls.getItem("username")) ls.setItem("username", "kid");
if (!ls.getItem("color")) ls.setItem("color", "#ffc96b");
if (!ls.getItem("showNames")) ls.setItem("showNames", JSON.stringify(true));
if (!ls.getItem("snekSize")) ls.setItem("snekSize", JSON.stringify(10));

usernameInput.value = ls.getItem("username");
colorInput.value = ls.getItem("color");
showNamesInput.checked = JSON.parse(ls.getItem("showNames"));
snekSizeInput.value = JSON.parse(ls.getItem("snekSize"));


snekSizeInput.addEventListener("change", (e) => {
    let snekSize = snekSizeInput.value.trim() || ls.getItem("snekSize");
    snekSizeInput.value = snekSize;

    console.log("Setting snekSize to", snekSize);
    socket.emit("snekSize", snekSize);
    ls.setItem("snekSize", snekSize);
});

usernameInput.addEventListener("change", (e) => {
    let username = (usernameInput.value.trim() || ls.getItem("username")).slice(0, 20);
    usernameInput.value = username;

    console.log("Setting username to", username);
    socket.emit("username", username);
    ls.setItem("username", username);
});
colorInput.addEventListener("change", (e) => {
    let color = colorInput.value;

    console.log("Setting color to", color);
    socket.emit("color", color);
    ls.setItem("color", color);
});
showNamesInput.addEventListener("change", (e) => {
    showNames = showNamesInput.checked;

    console.log("Setting showNames to", showNames);
    ls.setItem("showNames", JSON.stringify(showNames));
});

function gridPos(x, y, snekSize) {

    if (snekSize !== undefined) {
        return [Math.round(x / snekSize) * snekSize, Math.round(y / snekSize) * snekSize];
    } else {
        return [Math.round(x / player.snekSize) * player.snekSize, Math.round(y / player.snekSize) * player.snekSize];
    }
}

class Player {
    constructor(username, color) {
        this.username = username;
        this.color = color;
        this.wins = 0;

        // this.snekSize = 5;
        this.snekSize = ls.getItem("snekSize");

        this.init();
    }

    init() {

        [this.x, this.y] = gridPos(randInt(100, window.innerWidth - 100), randInt(100, window.innerHeight - 100), this.snekSize);


        this.direction = ["left", "up", "right", "down"][randInt(0, 3)];
        this.snekPath = [
            [this.x, this.y]
        ];
        this.startTime = Date.now();
        this.boost = 100;
        this.snekSpeed = 0.55;

        this.lastPos = {
            x: this.x,
            y: this.y
        };
        this.dead = true;
        this.lastScore = {
            wins: 0,
            score: 0
        };
    }
}

let player = new Player(ls.getItem("username"), ls.getItem("color"));

let players = {};

let onKeyDown = (e) => {
    if (e.repeat) return;
    let changedDirections = false;
    let initialPos = gridPos(player.x, player.y);
    switch (e.key) {
        case "ArrowLeft":
            if (player.dead) return;
            if (player.direction === "left" || player.direction === "right") break;
            changedDirections = true;
            player.direction = "left";
            [player.x, player.y] = gridPos(player.x, player.y);
            player.x -= player.snekSize / 2;
            break;
        case "ArrowRight":
            if (player.dead) return;
            if (player.direction === "right" || player.direction === "left") break;
            changedDirections = true;
            player.direction = "right";
            [player.x, player.y] = gridPos(player.x, player.y);
            player.x += player.snekSize / 2;
            break;
        case "ArrowDown":
            if (player.dead) return;
            if (player.direction === "down" || player.direction === "up") break;
            changedDirections = true;
            player.direction = "down";
            [player.x, player.y] = gridPos(player.x, player.y);
            player.y += player.snekSize / 2;
            break;
        case "ArrowUp":
            if (player.dead) return;
            if (player.direction === "up" || player.direction === "down") break;
            changedDirections = true;
            player.direction = "up";
            [player.x, player.y] = gridPos(player.x, player.y);
            player.y -= player.snekSize / 2;
            break;
        case "r":
            reset();
            break;
        case " ":
            if (player.dead) {
                reset();
            } else {
                player.snekSpeed = 0.8;
                socket.emit("boost start");
            }
            break;
        default:
            break;
    }

    if (changedDirections) {
        player.snekPath.push(initialPos);
        socket.emit("path", initialPos);
        socket.emit("position", player.x, player.y);
        socket.emit("direction", player.direction);
    }
};

let onKeyUp = (e) => {

    if (e.repeat) return;
    switch (e.key) {
        case " ":
            player.snekSpeed = 0.25;
            socket.emit("boost stop");
            socket.emit("position", player.x, player.y);
            break;
        default:
            break;
    }
};

function addToLeaderboard(socketID) {
    let player = players[socketID];
    let leaderboardListItem = document.createElement("li");
    leaderboardListItem.title = "Username (wins | score)";


    // leaderboardListItem.innerText = `${player.username} (☠️)`

    let score = (Date.now() - player.startTime) / 100;

    if (player.dead) score = player.lastScore.score;

    leaderboardListItem.innerText = `${player.username} (${player.wins} | ${Math.round(score)})`;
    leaderboardListItem.setAttribute("score", score);
    leaderboardListItem.setAttribute("socketID", socketID);

    if (player.dead) {
        leaderboardListItem.style.textDecoration = "line-through";
    }

    leaderboardList.appendChild(leaderboardListItem);
}

function removeFromLeaderboard(socketID) {
    let leaderboardListItem;
    for (let otherLeaderboardListItem of leaderboardList.children) {
        if (otherLeaderboardListItem.getAttribute("socketID") === socketID) {
            leaderboardListItem = otherLeaderboardListItem;
            break;
        }
    }
    if (leaderboardListItem) leaderboardListItem.remove();
}

socket.on("connect", () => {
    console.log("Connected to server!");
    players[socket.id] = player;

    socket.emit("join", player, (gameInfo) => {
        console.log("Joined game", gameInfo);
        players = {
            ...players,
            ...gameInfo.players
        };

        for (let socketID in players) {
            addToLeaderboard(socketID);
        }

        deadTextVisible = true;

        console.log("Game started");
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);

        scoreUpdateInterval = setInterval(() => {
            let mapped = [];
            for (let leaderboardListItem of leaderboardList.children) {
                let socketID = leaderboardListItem.getAttribute("socketID");
                let player = players[socketID];

                let score = (Date.now() - player.startTime) / 100;

                if (player.dead) score = player.lastScore.score;
                leaderboardListItem.setAttribute("score", score);

                // if (player.dead) {
                //   score =
                // } else {
                //   // leaderboardListItem.innerText = `${player.username} (${Math.round(
                //   //   score
                //   // )})`;
                // }

                mapped.push({
                    socketID: socketID,
                    score: score,
                    element: leaderboardListItem
                });
            }
            mapped.sort((a, b) => (a.score > b.score ? -1 : 1));

            leaderboardList.innerHTML = "";

            for (let item of mapped) {
                addToLeaderboard(item.socketID);
            }
        }, 10);

        window.requestAnimationFrame(loop);
    });
});


socket.on("join", (socketID, newPlayer) => {
    console.log("player joined", socketID, newPlayer);
    players[socketID] = newPlayer;

    socket.emit("position", player.x, player.y);
    socket.emit("direction", player.direction);

    addToLeaderboard(socketID);
});

socket.on("direction", (socketID, direction) => {
    console.log("dir");
    players[socketID].direction = direction;
});
socket.on("path", (socketID, pos, reset) => {
    console.log("path", reset);
    if (reset) {
        players[socketID].dead = false;
        players[socketID].snekPath = pos;
        players[socketID].startTime = Date.now();
    } else {
        players[socketID].snekPath.push(pos);
    }
});
socket.on("position", (socketID, x, y) => {
    console.log("pos");
    players[socketID].x = x;
    players[socketID].y = y;
});

socket.on("leave", (socketID) => {
    removeFromLeaderboard(socketID);
    delete players[socketID];
});

socket.on("username", (socketID, username) => {
    players[socketID].username = username;
});

socket.on("color", (socketID, color) => {
    players[socketID].color = color;
});

socket.on("snekSize", (socketID, snekSize) => {
    players[socketID].snekSize = snekSize;
});

socket.on("boost start", (socketID) => {
    players[socketID].snekSpeed = 0.8;
});
socket.on("boost stop", (socketID) => {
    players[socketID].snekSpeed = 0.25;
});

socket.on("dead", (socketID, dead) => {
    players[socketID].dead = dead;
    console.log("killed", dead);
});

socket.on("win", (socketID) => {
    players[socketID].wins++;
});

function isBetween(x1, y1, x2, y2, x, y) {
    let a = {
        x: x1,
        y: y1
    };
    let b = {
        x: x2,
        y: y2
    };
    let c = {
        x: x,
        y: y
    };

    let crossproduct = (c.y - a.y) * (b.x - a.x) - (c.x - a.x) * (b.y - a.y);

    if (Math.abs(crossproduct) > Number.EPSILON) return false;

    let dotproduct = (c.x - a.x) * (b.x - a.x) + (c.y - a.y) * (b.y - a.y);

    if (dotproduct < 0) return false;

    let squaredlengthba = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);

    if (dotproduct > squaredlengthba) return false;

    return true;
}

function intersects(segment1, segment2) {
    let [
        [a, b],
        [c, d]
    ] = segment1;
    let [
        [p, q],
        [r, s]
    ] = segment2;

    if (isBetween(a, b, c, d, p, q)) return 2;
    if (isBetween(a, b, c, d, r, s)) return 2;

    if (isBetween(p, q, r, s, a, b)) return 1;
    if (isBetween(p, q, r, s, c, d)) return 1;

    let det, gamma, lambda;
    det = (c - a) * (s - q) - (r - p) * (d - b);
    if (det === 0) {
        return false;
    } else {
        lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
        gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
        return 0 < lambda && lambda < 1 && 0 < gamma && gamma < 1;
    }
}

function segmentCircleIntersects(segment, h, k, r) {
    var a, b, c, d, u1, u2, ret, retP1, retP2, v1, v2;
    v1 = {};
    v2 = {};
    v1.x = segment[1][0] - segment[0][0];
    v1.y = segment[1][1] - segment[0][1];
    v2.x = segment[0][0] - h;
    v2.y = segment[0][1] - k;
    b = v1.x * v2.x + v1.y * v2.y;
    c = 2 * (v1.x * v1.x + v1.y * v1.y);
    b *= -2;
    d = Math.sqrt(b * b - 2 * c * (v2.x * v2.x + v2.y * v2.y - r * r));
    if (isNaN(d)) {
        // no intercept
        return [];
    }
    u1 = (b - d) / c; // these represent the unit distance of point one and two on the line
    u2 = (b + d) / c;
    retP1 = {}; // return points
    retP2 = {};
    ret = []; // return array
    if (u1 <= 1 && u1 >= 0) {
        // add point if on the line segment
        retP1.x = segment[0][0] + v1.x * u1;
        retP1.y = segment[0][1] + v1.y * u1;
        ret[0] = retP1;
    }
    if (u2 <= 1 && u2 >= 0) {
        // second add point if on the line segment
        retP2.x = segment[0][0] + v1.x * u2;
        retP2.y = segment[0][1] + v1.y * u2;
        ret[ret.length] = retP2;
    }
    return ret;
}

function resizeGameCanvas() {
    gameCanvas.width = window.innerWidth;
    gameCanvas.height = window.innerHeight;

    gridCanvas.width = window.innerWidth;
    gridCanvas.height = window.innerHeight;

    let gridSize = 50;
    gridCtx.beginPath();
    gridCtx.strokeStyle = "#fff0bf";

    for (
        let row = 0; row < Math.floor(window.innerHeight / gridSize) + 2; row++
    ) {
        gridCtx.moveTo(0, row * gridSize - gridSize / 2);
        gridCtx.lineTo(window.innerWidth, row * gridSize - gridSize / 2);
        gridCtx.stroke();
    }
    for (let col = 0; col < Math.floor(window.innerWidth / gridSize) + 2; col++) {
        gridCtx.moveTo(col * gridSize - gridSize / 2, 0);
        gridCtx.lineTo(col * gridSize - gridSize / 2, window.innerHeight);
        gridCtx.stroke();
    }
}

window.addEventListener("resize", resizeGameCanvas);
resizeGameCanvas();

function update(progress) {
    for (let socketID in players) {
        let player = players[socketID];

        if (player.dead) continue;

        switch (player.direction) {
            case "left":
                player.x -= player.snekSpeed * progress;
                break;
            case "up":
                player.y -= player.snekSpeed * progress;
                break;
            case "right":
                player.x += player.snekSpeed * progress;
                break;
            case "down":
                player.y += player.snekSpeed * progress;
                break;
            default:
                break;
        }
    }
    let died = false;

    // Check for line crossings / out of bounds
    if (player.dead) return;
    let currentSegment = [
        player.snekPath[player.snekPath.length - 1],
        [player.x, player.y]
    ];

    let otherSegments = [];

    for (let socketID in players) {
        let otherPlayer = players[socketID];
        if (otherPlayer.dead) {
            console.log("DEAD BRUI");
            continue;
        };

        if (otherPlayer !== player) {
            otherSegments.push([
                otherPlayer.snekPath[otherPlayer.snekPath.length - 1],
                [otherPlayer.x, otherPlayer.y]
            ]);
        }

        for (let i = 0; i < otherPlayer.snekPath.length - 1; i++) {
            let otherSegment = [otherPlayer.snekPath[i], otherPlayer.snekPath[i + 1]];
            // ctx.strokeStyle = "blue";
            // ctx.lineWidth = 2;
            // ctx.beginPath();

            // ctx.moveTo(...otherSegment[0]);
            // ctx.lineTo(...otherSegment[1]);
            // ctx.stroke();
            otherSegments.push(otherSegment);
        }
    }

    // console.log(otherSegments.length);
    for (let otherSegment of otherSegments) {

        // ctx.strokeStyle = "red";
        // ctx.lineWidth = 2;
        // ctx.beginPath();

        // ctx.moveTo(...otherSegment[0]);
        // ctx.lineTo(...otherSegment[1]);
        // ctx.stroke();

        let intersection = intersects(currentSegment, otherSegment);

        if (intersection === 1) {
            died = true;
            break;
        }

        if (intersection) {

            // console.log(otherSegment[1], player.snekPath[player.snekPath.length - 1])
            // if (otherSegment != player.snekPath[player.snekPath.length - 1]) {
            //     console.log("INTERSECT");
            //     ctx.strokeStyle = "red";
            //     ctx.lineWidth = 2;
            //     ctx.beginPath();
        
            //     ctx.moveTo(...otherSegment[0]);
            //     ctx.lineTo(...otherSegment[1]);
            //     ctx.stroke();
            // }
            if (otherSegment[1] == player.snekPath[player.snekPath.length - 1]) continue;

            switch (player.direction) {
                case "left":
                    if (player.lastPos.x > otherSegment[0][0]) died = true;
                    break;
                case "right":
                    if (player.lastPos.x < otherSegment[0][0]) died = true;
                    break;
                case "up":
                    if (player.lastPos.y > otherSegment[0][1]) died = true;
                    break;
                case "down":
                    if (player.lastPos.y < otherSegment[0][1]) died = true;
                    break;
                default:
                    break;
            }

            break;
        }
    }

    if (
        player.x < 0 ||
        player.y < 0 ||
        player.x > gameCanvas.width ||
        player.y > gameCanvas.height
    ) {
        if (!player.dead) {
            died = true;

            console.log(
                "die from bounds",
                player.x,
                player.y,
                gameCanvas.width,
                gameCanvas.height
            );
        }
    }

    if (died) {
        console.log("SOMEONE DIED");
        deadTextVisible = true;
        deadTextScale = 0.1;
        deadTextGrowing = true;

        
        player.dead = true;
        player.lastScore = {
            wins: player.wins,
            score: (Date.now() - player.startTime) / 100
        };
        socket.emit("dead", true);
    }




    player.lastPos = {
        x: player.x,
        y: player.y
    };
}



let deadTextGrowAmount = 0.002;
let deadTextGrowSpeed = 0.00003;

let deadTextScale = 1;
let deadTextVel = deadTextGrowSpeed / deadTextGrowAmount;
let deadTextGrowing = true;

let deadTextVisible = false;

function draw() {
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);



    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let socketID in players) {
        let player = players[socketID];
        if (player.dead) continue;

        

        ctx.beginPath();
        ctx.strokeStyle = player.color;
        ctx.lineWidth = player.snekSize;

        ctx.moveTo(...player.snekPath[0]);
        for (let pos of player.snekPath.slice(1)) {
            ctx.lineTo(...pos);
        }
        ctx.lineTo(player.x, player.y);

        ctx.stroke();

        ctx.fillStyle = "#faa205";
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.snekSize / 2, 0, 2 * Math.PI);
        ctx.fill();

        if (JSON.parse(ls.getItem("showNames"))) {
            ctx.font = "20px monospace";
            ctx.textAlign = "center";
            ctx.save();
            ctx.textBaseline = "bottom";

            ctx.lineWidth = 5;

            let username = player.username;

            if (
                leaderboardList.firstElementChild?.getAttribute("socketID") === socketID
            ) {
                username += " 👑";
            }

            ctx.strokeStyle = "white";
            ctx.strokeText(username, player.x, player.y - 10);

            ctx.fillStyle = "black";
            ctx.fillText(username, player.x, player.y - 10);

            ctx.restore();

            // ctx.textBaseline = "center";
            // ctx.closePath();
        }
    }

    if (deadTextVisible) {
        ctx.textAlign = "center";
        ctx.textBaseline = "center";
        ctx.font = `${Math.round(gameCanvas.width / 10)}px monospace`;


        ctx.lineWidth = 2;

        ctx.fillStyle = "#fad764";

        ctx.save();
        ctx.translate(gameCanvas.width / 2, gameCanvas.height / 3);
        ctx.scale(deadTextScale, deadTextScale);
        ctx.fillText("Press Space", 0, 0);
        ctx.restore();

        if (deadTextGrowing) {
            deadTextVel += deadTextGrowSpeed;
            if (deadTextVel > deadTextGrowAmount && player.dead) {
                deadTextVel = deadTextGrowAmount;
                deadTextGrowing = false;
            }
        } else {
            deadTextVel -= deadTextGrowSpeed;
            if (deadTextVel < -deadTextGrowAmount && player.dead) {
                deadTextVel = -deadTextGrowAmount;
                deadTextGrowing = true;
            }
        }

        if (player.dead) {
            if (deadTextScale < 1) {
                deadTextGrowing = true;
            }
            if (deadTextScale > 1) {
                deadTextGrowing = false;
            }
        }

        if (deadTextScale < 0.1) {
            deadTextVisible = false;
            deadTextScale = 1;
            deadTextVel = deadTextGrowSpeed / deadTextGrowAmount;
            deadTextGrowing = true;
        }


        deadTextScale += deadTextVel;
    }
}

let lastRender = 0;

function loop(timestamp) {
    let progress = timestamp - lastRender;

    draw();
    update(progress);


    lastRender = timestamp;
    window.requestAnimationFrame(loop);
}

function reset() {

    player.init();
    player.dead = false;
    socket.emit("dead", false);
    socket.emit("boost stop");
    socket.emit("path", player.snekPath, true);
    socket.emit("position", player.x, player.y);
    socket.emit("direction", player.direction);
    
    deadTextVel = -0.05;
    deadTextGrowing = true;

}
