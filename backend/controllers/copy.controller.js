const { runCloner } = require("../script/cloner");

exports.copy = async (req, res) => {
    const { token, copyId, pasteId, selectedOptions } = req.body || {};
    try {
        if (!token || !copyId || !pasteId) {
            return res.status(400).json({ success: false, message: "Missing fields" });
        }

        runCloner(token, copyId, pasteId, selectedOptions || { all: true }, (log) => {

            if (global.io) {
                global.io.emit("terminal-log", log);
            }
        }).then(() => {
            if (global.io) {
                global.io.emit("cloning-complete");
            }
        });


        return res.status(200).json({ success: true, message: "Cloning process started." });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
}