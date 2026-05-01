const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();
const { sendWebhook } = require("./utils/webhook");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "https://clone.saifx.xyz",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(express.json());
app.use(cors({ origin: "https://clone.saifx.xyz" }));

global.io = io;

const copyRoute = require("./routes/copy.route");
app.use("/api/copy", copyRoute);

io.on("connection", (socket) => {
    console.log("A user connected: ", socket.id);

    sendWebhook({
        title: "🌐 New Site Visit",
        description: "A user has connected to the web dashboard.",
        color: 0x3498db,
        fields: [
            { name: "Socket ID", value: socket.id, inline: true },
            { name: "IP Address", value: socket.handshake.address, inline: true }
        ]
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
