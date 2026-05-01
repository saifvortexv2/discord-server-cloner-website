const { Client } = require('discord.js-selfbot-v13');
const https = require('https');
const { parentPort, workerData, isMainThread } = require('worker_threads');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
        await client.login(token);
        log(`Logged in as ${client.user.tag}`);

        const source = await client.guilds.fetch(sourceId).catch(() => null);
        const target = await client.guilds.fetch(targetId).catch(() => null);

        if (!source || !target) {
            log('Server not found!');
            client.destroy();
            return;
        }

        await source.roles.fetch();
        await source.channels.fetch();
        await source.emojis.fetch();

        log(`Cloning: ${source.name} -> ${target.name}`);

        log('Cleaning target server...');
        
        const fetchedChannels = await target.channels.fetch().catch(() => null);
        const fetchedRoles = await target.roles.fetch().catch(() => null);

        const channelsToDelete = fetchedChannels ? Array.from(fetchedChannels.values()) : [];
        const rolesToDelete = fetchedRoles ? Array.from(fetchedRoles.values()) : [];

        log(`Deleting ${channelsToDelete.length} channels...`);
        for (const ch of channelsToDelete) {
            try {
                await ch.delete();
                await delay(500);
            } catch (err) {
                log(`Failed to delete channel ${ch.name}: ${err.message}`);
            }
        }

        log(`Deleting ${rolesToDelete.length} roles...`);
        let deletedCount = 0;
        for (const r of rolesToDelete) {
            if (r.name !== '@everyone' && r.id !== target.id && !r.managed) {
                try {
                    await r.delete();
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
            const roles = Array.from(source.roles.cache.values())
                .filter(r => r.name !== '@everyone' && !r.managed)
                .sort((a, b) => b.position - a.position);

            for (const r of roles) {
                try {
                    const nr = await target.roles.create({ 
                        name: r.name, 
                        color: r.hexColor, 
                        permissions: r.permissions, 
                        hoist: r.hoist, 
                        mentionable: r.mentionable 
                    });
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
            const cats = Array.from(source.channels.cache.values())
                .filter(c => c.type === 'GUILD_CATEGORY')
                .sort((a, b) => b.position - a.position);

            for (const c of cats) {
                try {
                    await target.channels.create(c.name, { type: 'GUILD_CATEGORY', position: c.position });
                    log(`Created category: ${c.name}`);
                    await delay(800);
                } catch (err) {
                    log(`Failed to create category ${c.name}: ${err.message}`);
                    await delay(2000);
                }
            }

            const channels = Array.from(source.channels.cache.values())
                .filter(c => c.type === 'GUILD_TEXT' || c.type === 'GUILD_VOICE')
                .sort((a, b) => b.position - a.position);

            for (const c of channels) {
                try {
                    const targetCats = await target.channels.fetch().then(cs => cs.filter(x => x.type === 'GUILD_CATEGORY'));
                    const parent = c.parent ? targetCats.find(p => p.name === c.parent.name) : null;
                    
                    await target.channels.create(c.name, { 
                        type: c.type, 
                        parent: parent?.id, 
                        position: c.position, 
                        topic: c.topic, 
                        nsfw: c.nsfw, 
                        bitrate: c.bitrate, 
                        userLimit: c.userLimit 
                    });
                    log(`Created channel: ${c.name}`);
                    await delay(800);
                } catch (err) {
                    log(`Failed to create channel ${c.name}: ${err.message}`);
                    await delay(2000);
                }
            }
        }

        if (selectedOptions.all || selectedOptions.emojis) {
            const emojis = Array.from(source.emojis.cache.values());
            log(`Found ${emojis.length} emojis. Cloning...`);
            for (const emoji of emojis) {
                try {
                    await target.emojis.create(emoji.url, emoji.name);
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
                    await target.setIcon(img);
                }
                await target.setName(source.name);
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

