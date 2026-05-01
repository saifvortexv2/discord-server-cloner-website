const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();
const { sendWebhook, getRealIP, getIPInfo } = require("./utils/webhook");

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

io.on("connection", async (socket) => {
    console.log("A user connected: ", socket.id);

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

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
