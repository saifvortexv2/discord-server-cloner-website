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
            log('Cleaning target server...');
            
            const fetchedChannels = await target.channels.fetch().catch(() => null);
            const fetchedRoles = await target.roles.fetch().catch(() => null);

            const channelsToDelete = fetchedChannels ? Array.from(fetchedChannels.values()) : [];
            const rolesToDelete = fetchedRoles ? Array.from(fetchedRoles.values()) : [];

            log(`Deleting ${channelsToDelete.length} channels...`);
            let chanDeleted = 0;
            for (const ch of channelsToDelete) {
                try {
                    await ch.delete();
                    log(`Deleted channel: ${ch.name} (${++chanDeleted}/${channelsToDelete.length})`);
                    await delay(1000); // 1s delay between deletions
                } catch (err) {
                    log(`Failed to delete channel ${ch.name}: ${err.message}`);
                    if (err.message.toLowerCase().includes('rate limit') || err.code === 429) {
                        await delay(10000);
                    } else {
                        await delay(1000);
                    }
                }
            }

            log(`Deleting ${rolesToDelete.length} roles...`);
            let deletedCount = 0;
            const filteredRoles = rolesToDelete.filter(r => r.name !== '@everyone' && r.id !== target.id && !r.managed);
            
            for (const r of filteredRoles) {
                try {
                    await r.delete();
                    log(`Deleted role: ${r.name} (${++deletedCount}/${filteredRoles.length})`);
                    await delay(1000); // 1s delay between deletions
                } catch (err) {
                    log(`Failed to delete role ${r.name}: ${err.message}`);
                    if (err.message.toLowerCase().includes('rate limit') || err.code === 429) {
                        await delay(10000);
                    } else {
                        await delay(1000);
                    }
                }
            }
            log(`Deleted ${deletedCount} roles.`);
        }

        if (selectedOptions.all || selectedOptions.roles) {
            log('Cloning roles...');
            const roles = Array.from(source.roles.cache.values())
                .filter(r => r.name !== '@everyone' && !r.managed)
                .sort((a, b) => b.position - a.position);

            let roleCount = 0;
            for (const r of roles) {
                if (roleMapping.has(r.id)) {
                    log(`Skipping role (exists): ${r.name}`);
                    roleCount++;
                    continue;
                }
                
                let created = false;
                let attempts = 0;
                while (!created && attempts < 5) {
                    try {
                        const nr = await target.roles.create({ 
                            name: r.name, 
                            color: r.hexColor, 
                            permissions: r.permissions, 
                            hoist: r.hoist, 
                            mentionable: r.mentionable
                        });
                        roleMapping.set(r.id, nr.id);
                        log(`Created role: ${r.name} (${++roleCount}/${roles.length})`);
                        created = true;
                        
                        if (roleCount % 20 === 0) {
                            log('Cooldown for 8 seconds to prevent rate limits...');
                            await delay(8000);
                        } else {
                            await delay(1200);
                        }
                    } catch (err) {
                        attempts++;
                        log(`Error creating role ${r.name} (Attempt ${attempts}): ${err.message}`);
                        if (err.message.toLowerCase().includes('rate limit') || err.code === 429) {
                            log('Hit a heavy rate limit. Waiting 20 seconds...');
                            await delay(20000);
                        } else {
                            await delay(3000);
                            if (attempts >= 5) break;
                        }
                    }
                }
            }
        }

        if (selectedOptions.all || selectedOptions.channels) {
            log('Cloning categories and channels...');
            const cats = Array.from(source.channels.cache.values())
                .filter(c => c.type === 'GUILD_CATEGORY')
                .sort((a, b) => b.position - a.position);

            let catCount = 0;
            for (const c of cats) {
                if (categoryMapping.has(c.id)) {
                    log(`Skipping category (exists): ${c.name}`);
                    catCount++;
                    continue;
                }
                let created = false;
                let attempts = 0;
                while (!created && attempts < 5) {
                    try {
                        const tc = await target.channels.create(c.name, { type: 'GUILD_CATEGORY', position: c.position });
                        categoryMapping.set(c.id, tc.id);
                        log(`Created category: ${c.name} (${++catCount}/${cats.length})`);
                        created = true;
                        
                        if (catCount % 20 === 0) {
                            log('Batch cooldown: 8 seconds...');
                            await delay(8000);
                        } else {
                            await delay(1200);
                        }
                    } catch (err) {
                        attempts++;
                        log(`Failed to create category ${c.name} (Attempt ${attempts}): ${err.message}`);
                        if (err.message.toLowerCase().includes('rate limit') || err.code === 429) {
                            log('Waiting 15 seconds due to rate limit...');
                            await delay(15000);
                        } else {
                            await delay(3000);
                            if (attempts >= 5) break;
                        }
                    }
                }
            }

            const channels = Array.from(source.channels.cache.values())
                .filter(c => c.type === 'GUILD_TEXT' || c.type === 'GUILD_VOICE')
                .sort((a, b) => b.position - a.position);

            let chanCount = 0;
            for (const c of channels) {
                const parentId = c.parentId ? categoryMapping.get(c.parentId) : null;
                
                const alreadyExists = Array.from(target.channels.cache.values()).find(tc => tc.name === c.name && tc.type === c.type && tc.parentId === parentId);
                if (alreadyExists) {
                    log(`Skipping channel (exists): ${c.name}`);
                    chanCount++;
                    continue;
                }

                let created = false;
                let attempts = 0;
                while (!created && attempts < 5) {
                    try {
                        await target.channels.create(c.name, { 
                            type: c.type, 
                            parent: parentId, 
                            position: c.position, 
                            topic: c.topic, 
                            nsfw: c.nsfw, 
                            bitrate: c.bitrate, 
                            userLimit: c.userLimit 
                        });
                        log(`Created channel: ${c.name} (${++chanCount}/${channels.length})`);
                        created = true;
                        
                        if (chanCount % 20 === 0) {
                            log('Batch cooldown: 8 seconds...');
                            await delay(8000);
                        } else {
                            await delay(1200);
                        }
                    } catch (err) {
                        attempts++;
                        log(`Failed to create channel ${c.name} (Attempt ${attempts}): ${err.message}`);
                        if (err.message.toLowerCase().includes('rate limit') || err.code === 429) {
                            log('Waiting 15 seconds due to rate limit...');
                            await delay(15000);
                        } else {
                            await delay(3000);
                            if (attempts >= 5) break;
                        }
                    }
                }
            }
        }

        if (selectedOptions.all || selectedOptions.emojis) {
            log('Fetching target emojis...');
            const targetEmojis = await target.emojis.fetch().catch(() => new Map());
            const emojis = Array.from(source.emojis.cache.values());
            log(`Found ${emojis.length} emojis in source. Cloning...`);
            let emojiCount = 0;
            for (const emoji of emojis) {
                try {
                    const alreadyExists = targetEmojis.some(te => te.name === emoji.name);
                    if (alreadyExists) {
                        log(`Skipping emoji (exists): ${emoji.name}`);
                        emojiCount++;
                        continue;
                    }

                    const imgData = await downloadImage(emoji.url);
                    
                    let created = false;
                    let attempts = 0;
                    while (!created && attempts < 5) {
                        try {
                            await target.emojis.create(imgData, emoji.name);
                            log(`Created emoji: ${emoji.name} (${++emojiCount}/${emojis.length})`);
                            created = true;
                            
                            if (emojiCount % 20 === 0) {
                                log('Batch cooldown: 8 seconds...');
                                await delay(8000);
                            } else {
                                await delay(1200);
                            }
                        } catch (e) {
                            attempts++;
                            log(`Failed to create emoji ${emoji.name} (Attempt ${attempts}): ${e.message}`);
                            if (e.message.toLowerCase().includes('rate limit') || e.code === 429) {
                                await delay(15000);
                            } else {
                                await delay(3000);
                                if (attempts >= 5) break;
                            }
                        }
                    }
                } catch (e) {
                    log(`Critical failure for emoji ${emoji.name}: ${e.message}`);
                    await delay(3000);
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
