const express   = require("express");
const socketio  = require("socket.io");
const fs        = require("fs");
const crypto    = require("crypto");

const app = express();
const server = require("http").createServer(app);
const io = socketio(server);

let messages = [];
let connected = 0;
let peoples = {
    // ip : username
};
let groups = {
    // username-username : id
};

class LOGGER {
    constructor(logfile="out.log") {
        this.ansiColors = {
            red: "\x1b[91m",
            green: "\x1b[92m",
            gray: "\x1b[90m",
            reset: "\x1b[0m"
        };
        this.file = logfile;
    }

    info (message, ...optionalParams) {
        let data = `${this.ansiColors.gray + new Date().toUTCString() + this.ansiColors.reset} - ${this.ansiColors.green + "INFO" + this.ansiColors.reset} : ${message}`;

        this.write(data, ...optionalParams);
    }

    error (message, ...optionalParams) {
        let data = `${this.ansiColors.gray + new Date().toUTCString() + this.ansiColors.reset} - ${this.ansiColors.red + "ERROR" + this.ansiColors.reset} : ${message}`;

        this.write(data, ...optionalParams);
    }

    write(message, ...optionalParams) {
        console.log(message, ...optionalParams);
        let msg = message;

        if (optionalParams.length > 0) {
            msg += " " + optionalParams.join(" ");
        }

        msg = msg.replace(/(\x1b\[[0-9;]*m)/g, "")

        fs.appendFileSync(this.file, `${msg}\n`, "utf8");
    }
}

const log = new LOGGER();

app.use(express.static(__dirname + "/view"));

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/view/index.html");
});
app.get("/login", (req, res) => {
    res.sendFile(__dirname + "/view/login.html");
});

io.on("connection", (socket) => {
    let ip = socket.handshake.address;
    log.info("New client connected", ip);
    connected++;

    io.emit("startup", {"connected": connected, "peoples": peoples});
    socket.join("global");
    for (let i = 0; i < messages.length; i++) {
        socket.emit("message", messages[i]);
    }

    socket.on("message", (data) => {
        log.info("Message received", data);
        messages.push(data);
        io.emit("message", data);
    });

    socket.on("people", (data) => {
        log.info(ip, "is connected as", data);
        if (peoples[ip] == undefined || peoples[ip] == null) {
            peoples[ip] = data;
        }
        io.emit("startup", { connected: connected, peoples: peoples });
    });

    socket.on("group", (data) => {
        log.info(ip, "is connected in group", data);

        if (!groups[data]) {
            groups[data] = crypto.randomUUID();
        }

        socket.join(groups[data]);
    });

    // LOGIN SOCKETS
    socket.on("login-attempt", (data) => {
        log.info(ip, "is trying to login as", data);

        let isValid = true;

        Object.keys(peoples).forEach((key) => {
            if (peoples[key] == data) {
                isValid = false;
            }
        });

        if (isValid) {
            socket.emit("login", {"success": true});
            log.info("Login successful for", ip);
        } else {
            socket.emit("login", {"success": false, "message": "Username already in use"});
            log.info("Login failed for", ip);
        }
    });

    socket.on("disconnect", () => {
        log.info("Client disconnected", ip);
        connected--;
        delete peoples[ip];
        io.emit("startup", { connected: connected, peoples: peoples });
    });
});

server.listen(3000, () => {
    log.info("Server started on port 3000");
});