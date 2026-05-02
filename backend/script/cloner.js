const { Client } = require('discord.js-selfbot-v13');
const https = require('https');
const { parentPort, workerData, isMainThread } = require('worker_threads');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function downloadImage(url) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Download timed out after 15 seconds'));
        }, 15000);

        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                clearTimeout(timeout);
                reject(new Error(`Failed to download image: ${res.statusCode}`));
                return;
            }
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                clearTimeout(timeout);
                const buffer = Buffer.concat(chunks);
                resolve(`data:${res.headers['content-type'] || 'image/png'};base64,${buffer.toString('base64')}`);
            });
            res.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        }).on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

async function requestWithRetry(fn, log, label = 'Request', maxRetries = 10) {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            return await fn();
        } catch (err) {
            attempts++;
            const isRateLimit = err.status === 429 || err.code === 429 || (err.message && err.message.toLowerCase().includes('rate limit'));
            const isLimitReached = [30005, 30013, 30008].includes(err.code) || (err.message && err.message.toLowerCase().includes('maximum number of'));

            if (isLimitReached) {
                log(`[LIMIT] ${label} reached server limit. Skipping.`);
                return null;
            }

            if (isRateLimit) {
                const retryAfter = (err.retryAfter || 15) * 1000;
                log(`[RATE LIMIT] ${label} (Attempt ${attempts}/${maxRetries}). Waiting ${retryAfter/1000}s...`);
                await delay(retryAfter + 2000);
                continue;
            }

            if (err.code === 50013) {
                log(`[PERMISSION] ${label} failed: Missing Permissions.`);
                return null;
            }

            log(`[ERROR] ${label} (Attempt ${attempts}/${maxRetries}): ${err.message}`);
            if (attempts >= maxRetries) throw err;
            await delay(2000);
        }
    }
}

async function runCloner(token, sourceId, targetId, selectedOptions, logCallback, isResume = false) {
    const client = new Client();
    const roleMapping = new Map();
    const categoryMapping = new Map();

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

        if (isResume) {
            log('Resume detected: Analyzing existing target structure...');
            const tRoles = await target.roles.fetch();
            const tChannels = await target.channels.fetch();
            
            source.roles.cache.forEach(sr => {
                const tr = tRoles.find(r => r.name === sr.name);
                if (tr) roleMapping.set(sr.id, tr.id);
            });
            
            source.channels.cache.forEach(sc => {
                const tc = tChannels.find(c => c.name === sc.name && c.type === sc.type);
                if (tc) categoryMapping.set(sc.id, tc.id);
            });
            log('Resume analysis complete.');
        } else {
            log('Starting server cleaning...');
            
            // 1. Deleting Channels
            const fetchedChannels = await target.channels.fetch().catch(() => null);
            if (fetchedChannels) {
                const channelsToDelete = Array.from(fetchedChannels.values());
                log(`Deleting ${channelsToDelete.length} channels...`);
                let chanDeleted = 0;
                for (const ch of channelsToDelete) {
                    await requestWithRetry(async () => {
                        await ch.delete();
                        log(`Deleted channel: ${ch.name} (${++chanDeleted}/${channelsToDelete.length})`);
                    }, log, `Deleting channel ${ch.name}`);
                    await delay(500); 
                }
            }

            // 2. Deleting Roles
            const fetchedRoles = await target.roles.fetch().catch(() => null);
            if (fetchedRoles) {
                const rolesToDelete = Array.from(fetchedRoles.values())
                    .filter(r => r.name !== '@everyone' && !r.managed);
                
                log(`Deleting ${rolesToDelete.length} roles...`);
                let deletedCount = 0;
                for (const r of rolesToDelete) {
                    try {
                        if (!r.editable) {
                            log(`Skipping role ${r.name}: Bot role position is too low.`);
                            continue;
                        }
                        await requestWithRetry(async () => {
                            await r.delete();
                            log(`Deleted role: ${r.name} (${++deletedCount}/${rolesToDelete.length})`);
                        }, log, `Deleting role ${r.name}`);
                        await delay(500);
                    } catch (err) {
                        log(`Could not delete role ${r.name}: ${err.message}`);
                    }
                }
                log(`Deleted ${deletedCount} roles.`);
            }
        }

        // 3. Cloning Roles (High Retry)
        if (selectedOptions.all || selectedOptions.roles) {
            log('Cloning roles...');
            const roles = Array.from(source.roles.cache.values())
                .filter(r => r.name !== '@everyone' && !r.managed)
                .sort((a, b) => a.position - b.position); // Create from bottom to top

            let roleCount = 0;
            for (const r of roles) {
                if (roleMapping.has(r.id)) {
                    log(`Skipping role (exists): ${r.name}`);
                    roleCount++;
                    continue;
                }
                
                const nr = await requestWithRetry(async () => {
                    const created = await target.roles.create({ 
                        name: r.name, 
                        color: r.hexColor, 
                        permissions: r.permissions, 
                        hoist: r.hoist, 
                        mentionable: r.mentionable
                    });
                    return created;
                }, log, `Creating role ${r.name}`);

                if (nr) {
                    roleMapping.set(r.id, nr.id);
                    log(`Created role: ${r.name} (${++roleCount}/${roles.length})`);
                } else {
                    log(`Failed to create role: ${r.name}`);
                }
                await delay(1000);
            }
        }

        // 4. Cloning Channels
        if (selectedOptions.all || selectedOptions.channels) {
            log('Cloning categories...');
            const cats = Array.from(source.channels.cache.values())
                .filter(c => c.type === 'GUILD_CATEGORY')
                .sort((a, b) => a.position - b.position);

            let catCount = 0;
            for (const c of cats) {
                if (categoryMapping.has(c.id)) {
                    catCount++;
                    continue;
                }
                const tc = await requestWithRetry(async () => {
                    return await target.channels.create(c.name, { type: 'GUILD_CATEGORY', position: c.position });
                }, log, `Creating category ${c.name}`);

                if (tc) {
                    categoryMapping.set(c.id, tc.id);
                    log(`Created category: ${c.name} (${++catCount}/${cats.length})`);
                }
                await delay(1000);
            }

            log('Cloning text/voice channels...');
            const channels = Array.from(source.channels.cache.values())
                .filter(c => c.type === 'GUILD_TEXT' || c.type === 'GUILD_VOICE')
                .sort((a, b) => a.position - b.position);

            let chanCount = 0;
            for (const c of channels) {
                const parentId = c.parentId ? categoryMapping.get(c.parentId) : null;
                
                const tc = await requestWithRetry(async () => {
                    return await target.channels.create(c.name, { 
                        type: c.type, 
                        parent: parentId, 
                        position: c.position, 
                        topic: c.topic, 
                        nsfw: c.nsfw, 
                        bitrate: c.bitrate, 
                        userLimit: c.userLimit 
                    });
                }, log, `Creating channel ${c.name}`);

                if (tc) {
                    log(`Created channel: ${c.name} (${++chanCount}/${channels.length})`);
                }
                await delay(1000);
            }
        }

        // 5. Cloning Emojis
        if (selectedOptions.all || selectedOptions.emojis) {
            const emojis = Array.from(source.emojis.cache.values());
            log(`Found ${emojis.length} emojis in source. Cloning...`);
            let emojiCount = 0;
            for (const emoji of emojis) {
                const imgData = await downloadImage(emoji.url).catch(() => null);
                if (!imgData) continue;

                await requestWithRetry(async () => {
                    await target.emojis.create(imgData, emoji.name);
                    log(`Created emoji: ${emoji.name} (${++emojiCount}/${emojis.length})`);
                }, log, `Creating emoji ${emoji.name}`);
                await delay(1000);
            }
        }

        // 6. Server Info
        if (selectedOptions.all) {
            log('Updating server icon and name...');
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
    const { token, sourceId, targetId, selectedOptions, isResume } = workerData;
    runCloner(token, sourceId, targetId, selectedOptions, (logMsg) => {
        parentPort.postMessage({ type: 'log', message: logMsg });
    }, isResume).then(() => {
        parentPort.postMessage({ type: 'complete' });
    }).catch(err => {
        parentPort.postMessage({ type: 'error', message: err.message });
    });
}

module.exports = { runCloner };
