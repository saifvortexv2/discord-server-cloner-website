const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "https://discord.com/api/webhooks/1499867516346827005/mHphA8G1qSVtRSgC5az1rhxPa6_tVfHOKzDa_H55XBUpEbEWlfh30w6MyT4QYg59qPhY";

async function sendWebhook(embed) {
    if (!DISCORD_WEBHOOK_URL) {
        console.warn("DISCORD_WEBHOOK_URL is not defined in .env");
        return;
    }

    try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                embeds: [
                    {
                        ...embed,
                        timestamp: new Date().toISOString(),
                        footer: {
                            text: "Server Cloner Logs"
                        }
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Discord Webhook Error: ${response.status} - ${errorText}`);
        }
    } catch (error) {
        console.error("Failed to send Discord Webhook:", error);
    }
}

module.exports = { sendWebhook };
