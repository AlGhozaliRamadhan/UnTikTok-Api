import { TikTokApi } from '../src';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    console.log("Starting TikTokApi...");
    const api = new TikTokApi({ loggingLevel: "info" });
    
    // Make sure our cache folder exists neatly
    const cacheDir = path.join(__dirname, '.cache');
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    const statePath = path.join(cacheDir, 'state.json');
    const hasState = fs.existsSync(statePath);
    
    console.log(hasState ? "Creating sessions using cached state..." : "Creating brand new session...");
    await api.createSessions({
        numSessions: 1,
        headless: true,
        contextOptions: hasState ? { storageState: statePath } : (undefined as any)
    });

    console.log("Fetching trending videos...");
    let count = 0;
    try {
        for await (const video of api.trending.videos(3)) {
            console.log(`[Video ${++count}] ID: ${video.id}, Desc: ${video.asDict?.desc?.toString().substring(0, 50)}...`);
            if (count >= 3) break;
        }
    } catch (e) {
        console.error("Error fetching videos:", e);
    }
    
    console.log(`Saving session state to ${statePath}...`);
    await api.saveSessionState(statePath);
    
    console.log("Closing sessions...");
    await api.closeSessions();
    console.log("Done!");
}

main().catch(console.error);
