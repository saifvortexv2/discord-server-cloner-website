const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();
const { sendWebhook, getRealIP, getIPInfo } = require("./utils/webhook");

const app = express();
app.set('trust proxy', 1);
const allowedOrigins = ["https://clone.saifx.xyz", "http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"];

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(express.json());
app.use(cors({ origin: allowedOrigins }));

global.io = io;

const copyRoute = require("./routes/copy.route");
app.use("/api/copy", copyRoute);

io.on("connection", (socket) => {
    console.log("A user connected: ", socket.id);

    socket.on("visitor-ready", async () => {
        const ip = getRealIP(socket);
        const geo = await getIPInfo(ip);
        const time = new Date().toLocaleString('en-GB', { timeZone: 'UTC' }).replace(',', '');

        const content = `**🎉 New Visitor!!**
**Time:** ${time}
**IP:** ${ip.replace(/^::ffff:/, '')}
**Country:** ${geo?.country || "Unknown"}
**Region / Province:** ${geo?.regionName || "Unknown"}
**City:** ${geo?.city || "Unknown"}`;

        sendWebhook({ content });
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
