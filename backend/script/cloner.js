const { Client } = require('discord.js-selfbot-v13');
const https = require('https');
const { parentPort, workerData, isMainThread } = require('worker_threads');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function withTimeout(promise, timeoutMs = 30000) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

async function downloadImage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve(`data:${res.headers['content-type'] || 'image/png'};base64,${buffer.toString('base64')}`);
            });
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function runCloner(token, sourceId, targetId, selectedOptions, logCallback) {
    const client = new Client();
    const roleMapping = new Map();

    const log = (msg) => {
        console.log(msg);
        if (logCallback) logCallback(msg);
    };

    try {
        await withTimeout(client.login(token), 15000);
        log(`Logged in as ${client.user.tag}`);

        const source = await withTimeout(client.guilds.fetch(sourceId), 10000).catch(() => null);
        const target = await withTimeout(client.guilds.fetch(targetId), 10000).catch(() => null);

        if (!source || !target) {
            log('Server not found!');
            client.destroy();
            return;
        }

        log(`Cloning: ${source.name} -> ${target.name}`);

        log('Cleaning target server...');
        
        const fetchedChannels = await withTimeout(target.channels.fetch(), 10000).catch(() => []);
        const fetchedRoles = await withTimeout(target.roles.fetch(), 10000).catch(() => []);

        log(`Deleting ${fetchedChannels.size || 0} channels...`);
        for (const [, ch] of fetchedChannels) {
            try {
                await withTimeout(ch.delete(), 10000);
                await delay(500);
            } catch (err) {
                log(`Failed to delete channel ${ch.name}: ${err.message}`);
            }
        }

        log(`Deleting ${fetchedRoles.size || 0} roles...`);
        let deletedCount = 0;
        for (const [, r] of fetchedRoles) {
            if (r.name !== '@everyone' && !r.managed) {
                try {
                    await withTimeout(r.delete(), 10000);
                    deletedCount++;
                    await delay(500);
                } catch (err) {
                    log(`Failed to delete role ${r.name}: ${err.message}`);
                }
            }
        }
        log(`Deleted ${deletedCount} roles.`);

        if (selectedOptions.all || selectedOptions.roles) {
            log('Cloning roles...');
            const roles = source.roles.cache.filter(r => r.name !== '@everyone').sort((a, b) => b.position - a.position);
            for (const [, r] of roles) {
                try {
                    const nr = await withTimeout(target.roles.create({ 
                        name: r.name, 
                        color: r.hexColor, 
                        permissions: r.permissions, 
                        hoist: r.hoist, 
                        mentionable: r.mentionable 
                    }), 15000);
                    roleMapping.set(r.id, nr.id);
                    log(`Created role: ${r.name}`);
                    await delay(800);
                } catch (err) {
                    log(`Failed to create role ${r.name}: ${err.message}`);
                    await delay(2000);
                }
            }
        }

        if (selectedOptions.all || selectedOptions.channels) {
            log('Cloning categories and channels...');
            const cats = source.channels.cache.filter(c => c.type === 'GUILD_CATEGORY').sort((a, b) => a.position - b.position);
            for (const [, c] of cats) {
                try {
                    await withTimeout(target.channels.create(c.name, { type: 'GUILD_CATEGORY', position: c.position }), 15000);
                    log(`Created category: ${c.name}`);
                    await delay(800);
                } catch (err) {
                    log(`Failed to create category ${c.name}: ${err.message}`);
                    await delay(2000);
                }
            }

            const channels = source.channels.cache.filter(c => c.type === 'GUILD_TEXT' || c.type === 'GUILD_VOICE').sort((a, b) => a.position - b.position);
            for (const [, c] of channels) {
                try {
                    const parent = c.parent ? target.channels.cache.find(p => p.name === c.parent.name && p.type === 'GUILD_CATEGORY') : null;
                    await withTimeout(target.channels.create(c.name, { 
                        type: c.type, 
                        parent: parent?.id, 
                        position: c.position, 
                        topic: c.topic, 
                        nsfw: c.nsfw, 
                        bitrate: c.bitrate, 
                        userLimit: c.userLimit 
                    }), 15000);
                    log(`Created channel: ${c.name}`);
                    await delay(800);
                } catch (err) {
                    log(`Failed to create channel ${c.name}: ${err.message}`);
                    await delay(2000);
                }
            }
        }

        if (selectedOptions.all || selectedOptions.emojis) {
            const emojis = source.emojis.cache;
            log(`Found ${emojis.size} emojis. Cloning...`);
            for (const [, emoji] of emojis) {
                try {
                    await withTimeout(target.emojis.create(emoji.url, emoji.name), 20000);
                    log(`Created emoji: ${emoji.name}`);
                    await delay(800);
                } catch (e) {
                    log(`Failed to create emoji ${emoji.name}: ${e.message}`);
                    await delay(2000);
                }
            }
        }

        if (selectedOptions.all) {
            log('Cloning server icon and name...');
            try {
                if (source.iconURL()) {
                    const img = await downloadImage(source.iconURL({ format: 'png', size: 1024 }));
                    await withTimeout(target.setIcon(img), 20000);
                }
                await withTimeout(target.setName(source.name), 10000);
            } catch (err) {
                log(`Failed to update server info: ${err.message}`);
            }
        }

        log('Cloning process completed successfully!');
    } catch (e) {
        log(`Fatal Error: ${e.message}`);
    } finally {
        client.destroy();
    }
}

if (!isMainThread && parentPort) {
    const { token, sourceId, targetId, selectedOptions } = workerData;
    runCloner(token, sourceId, targetId, selectedOptions, (logMsg) => {
        parentPort.postMessage({ type: 'log', message: logMsg });
    }).then(() => {
        parentPort.postMessage({ type: 'complete' });
    }).catch(err => {
        parentPort.postMessage({ type: 'error', message: err.message });
    });
}

module.exports = { runCloner };

