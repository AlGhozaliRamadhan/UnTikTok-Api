import { TikTokApi } from './src/index';

async function test() {
    console.log("Starting TikTok API Test...");
    const api = new TikTokApi();
    console.log("Creating sessions...");
    await api.createSessions({
        numSessions: 1,
        headless: true,
        sleepAfter: 3
    });

    console.log("Fetching trending videos...");
    let count = 0;
    try {
        for await (const video of api.trending.videos(2)) {
            console.log(`[SUCCESS] Found Video: ${video.id}`);
            console.log(`[SUCCESS] Video Author: ${video.author?.username}`);
            count++;
            if (count >= 2) break;
        }
        if (count === 0) {
            console.log("[WARNING] No videos found. Might need msToken or proxy.");
        } else {
            console.log("[SUCCESS] Test passed successfully!");
        }
    } catch (e) {
        console.error("[ERROR] Failed to fetch videos:", e);
    } finally {
        await api.closeSessions();
    }
}

test();
