import { TikTokApi } from "../src";

async function testPinned() {
  const api = new TikTokApi();
  await api.createSessions({
    numSessions: 1,
    sleepAfter: 3,
    browser: "chromium",
  });

  const user = api.user({ username: "mrbeast" });
  const firstVid = await user.videos(1).next();
  if (!firstVid.done) {
    const rawData = firstVid.value.asDict ?? {};
    const strData = JSON.stringify(rawData).toLowerCase();
    if (strData.includes("pin")) {
      const matchKeys: string[] = [];
      const traverse = (obj: any, path: string) => {
        for (const k in obj) {
          if (k.toLowerCase().includes("pin")) matchKeys.push(`${path}.${k}`);
          if (typeof obj[k] === "object" && obj[k] !== null) {
            traverse(obj[k], `${path}.${k}`);
          }
        }
      };
      traverse(rawData, "root");
      console.log(`Mrbeast first video has pin keys:`, matchKeys.join(", "));
    } else {
        console.log("No pin found in first video of Mrbeast.");
    }
  }

  await api.closeSessions();
}

testPinned().catch(console.error);
