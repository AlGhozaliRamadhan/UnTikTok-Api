import { TikTokApi } from '../src';
import * as fs from 'fs';
import * as path from 'path';

async function testPopularVideo() {
    console.log("Starting TikTokApi...");
    const api = new TikTokApi({ loggingLevel: "info" });
    
    // Try to use cached state to get better trending results
    const statePath = path.join(__dirname, '../examples/.cache/state.json');
    const hasState = fs.existsSync(statePath);
    
    await api.createSessions({
        numSessions: 1,
        headless: true,
        contextOptions: hasState ? { storageState: statePath } : undefined
    });

    try {
        console.log("Fetching a popular video from the trending feed...");
        let popularVideo = null;
        for await (const video of api.trending.videos(1)) {
            popularVideo = video;
            break; // Just grab the first one
        }

        if (!popularVideo) {
            console.error("Could not find any trending videos.");
            return;
        }

        console.log(`Found Video ID: ${popularVideo.id}`);
        console.log(`Description: ${popularVideo.asDict?.desc?.toString().substring(0, 50)}...`);
        // TikTok's CDNs heavily block Axios/Node.js from downloading MP4s directly due to TLS fingerprinting.
        // Instead, we will grab the raw video URL and open it in your real browser!
        const videoData = popularVideo.asDict?.video as any;
        const playUrl = videoData?.playAddr ?? videoData?.downloadAddr;
        
        if (playUrl) {
            console.log(`Video URL: ${playUrl}`);
            const { execSync } = require('child_process');
            console.log("Opening video in your browser...");
            // Use 'start' to open the URL in the default browser on Windows
            execSync(`start "" "${playUrl}"`);
        } else {
            console.error("Could not find a playAddr or downloadAddr for this video.");
        }
    } catch (e) {
        console.error("Error during execution:", e);
    } finally {
        await api.closeSessions();
    }
}

testPopularVideo().catch(console.error);
