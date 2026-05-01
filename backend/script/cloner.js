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

        log(`Cloning: ${source.name} -> ${target.name}`);

        log('Cleaning target server...');
        
        const fetchedChannels = await target.channels.fetch();
        const fetchedRoles = await target.roles.fetch();

        log(`Deleting ${fetchedChannels.size} channels...`);
        for (const [, ch] of fetchedChannels) {
            await ch.delete().catch((err) => log(`Failed to delete channel ${ch.name}: ${err.message}`));
            await delay(500);
        }

        log(`Deleting ${fetchedRoles.size} roles...`);
        let deletedCount = 0;
        for (const [, r] of fetchedRoles) {
            if (r.name !== '@everyone' && !r.managed) {
                await r.delete().catch((err) => log(`Failed to delete role ${r.name}: ${err.message}`));
                deletedCount++;
                await delay(500);
            }
        }
        log(`Successfully requested deletion of ${deletedCount} roles.`);

        if (selectedOptions.all || selectedOptions.roles) {
            log('Cloning roles...');
            const roles = source.roles.cache.filter(r => r.name !== '@everyone').sort((a, b) => b.position - a.position);
            for (const [, r] of roles) {
                const nr = await target.roles.create({ 
                    name: r.name, 
                    color: r.hexColor, 
                    permissions: r.permissions, 
                    hoist: r.hoist, 
                    mentionable: r.mentionable 
                });
                roleMapping.set(r.id, nr.id);
                log(`Created role: ${r.name}`);
                await delay(200);
            }
        }

        if (selectedOptions.all || selectedOptions.channels) {
            log('Cloning categories and channels...');
            const cats = source.channels.cache.filter(c => c.type === 'GUILD_CATEGORY').sort((a, b) => a.position - b.position);
            for (const [, c] of cats) {
                await target.channels.create(c.name, { type: 'GUILD_CATEGORY', position: c.position });
                log(`Created category: ${c.name}`);
                await delay(200);
            }

            const channels = source.channels.cache.filter(c => c.type === 'GUILD_TEXT' || c.type === 'GUILD_VOICE').sort((a, b) => a.position - b.position);
            for (const [, c] of channels) {
                const parent = c.parent ? target.channels.cache.find(p => p.name === c.parent.name && p.type === 'GUILD_CATEGORY') : null;
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
                await delay(200);
            }
        }

        if (selectedOptions.all || selectedOptions.emojis) {
            const emojis = source.emojis.cache;
            log(`Found ${emojis.size} emojis. Cloning...`);
            for (const [, emoji] of emojis) {
                await target.emojis.create(emoji.url, emoji.name).catch(e => log(`Failed to create emoji ${emoji.name}: ${e.message}`));
                log(`Created emoji: ${emoji.name}`);
                await delay(200);
            }
        }

        if (selectedOptions.all) {
            log('Cloning server icon and name...');
            if (source.iconURL()) await target.setIcon(await downloadImage(source.iconURL({ format: 'png', size: 1024 }))).catch(() => {});
            await target.setName(source.name);
        }

        log('Cloning process completed successfully!');
    } catch (e) {
        log(`Error: ${e.message}`);
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

