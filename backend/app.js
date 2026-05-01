const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(express.json());
app.use(cors({ origin: "http://localhost:3000" }));

global.io = io;

const copyRoute = require("./routes/copy.route");
app.use("/api/copy", copyRoute);

io.on("connection", (socket) => {
    console.log("A user connected: ", socket.id);
    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
