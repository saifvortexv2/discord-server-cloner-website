const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "https://discord.com/api/webhooks/1499867516346827005/mHphA8G1qSVtRSgC5az1rhxPa6_tVfHOKzDa_H55XBUpEbEWlfh30w6MyT4QYg59qPhY";

async function sendWebhook(data) {
    if (!DISCORD_WEBHOOK_URL) {
        console.warn("DISCORD_WEBHOOK_URL is not defined in .env");
        return;
    }

    try {
        const body = {};
        if (data.content) {
            body.content = data.content;
        }
        if (data.embeds || data.title || data.description) {
            body.embeds = data.embeds || [
                {
                    title: data.title,
                    description: data.description,
                    color: data.color,
                    fields: data.fields,
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: "Server Cloner Logs"
                    }
                }
            ];
        }

        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Discord Webhook Error: ${response.status} - ${errorText}`);
        }
    } catch (error) {
        console.error("Failed to send Discord Webhook:", error);
    }
}

async function getIPInfo(ip) {
    try {
        if (!ip || ip === "127.0.0.1" || ip === "::1") {
            return {
                country: "Localhost",
                regionName: "N/A",
                city: "N/A"
            };
        }
        
        const cleanIp = ip.replace(/^::ffff:/, '');
        
        const response = await fetch(`http://ip-api.com/json/${cleanIp}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.status === "success" ? data : null;
    } catch (error) {
        console.error("Failed to fetch IP info:", error);
        return null;
    }
}

function getRealIP(reqOrSocket) {
    let ip = "";
    if (reqOrSocket.handshake) {
        ip = reqOrSocket.handshake.headers['x-forwarded-for'] || reqOrSocket.handshake.address;
    } else {
        ip = reqOrSocket.headers['x-forwarded-for'] || reqOrSocket.socket.remoteAddress;
    }
    
    if (ip && ip.includes(',')) {
        ip = ip.split(',')[0].trim();
    }
    
    const cleanIp = ip ? ip.replace(/^::ffff:/, '') : "Unknown";
    return cleanIp === "::1" ? "127.0.0.1" : cleanIp;
}

module.exports = { sendWebhook, getIPInfo, getRealIP };
