# Session Caching & Bot Evasion

TikTok utilizes incredibly aggressive bot detection mechanisms (like Cloudflare, heavily obfuscated JavaScript, and behavioral tracking). If you make too many requests too quickly, or if your browser lacks cookies, TikTok will return an `EmptyResponseException` and block your requests.

To mitigate this, you should **cache your session state** and reuse it.

## How it works

When you first open a Playwright session, it's a completely blank slate. TikTok views this suspiciously. However, once the browser loads TikTok, it acquires a bunch of tracking cookies, device IDs (`wid`), and `msTokens`. 

By saving this state to disk, your next script execution can load these exact same cookies. To TikTok, it simply looks like a returning user coming back to the website, completely bypassing the initial high-suspicion checks.

## Example Usage

```typescript
import { TikTokApi } from '../src';

async function cacheSession() {
  // --- RUN 1: WARMING UP THE SESSION ---
  // Create a brand new session and let it connect to TikTok
  const api = new TikTokApi();
  await api.createSessions({ numSessions: 1 });
  
  // Doing a small dummy action helps generate the necessary cookies
  await api.trending.videos(1).next();
  
  // Save the cookies and local storage to 'state.json'
  await api.saveSessionState('state.json');
  await api.closeSessions();

  
  // --- RUN 2: USING THE CACHED SESSION ---
  // On subsequent runs, load the state!
  const cachedApi = new TikTokApi();
  await cachedApi.createSessions({
    numSessions: 1,
    // Pass the saved state file into the context options
    contextOptions: { storageState: 'state.json' }
  });
  
  // You are now successfully avoiding the heaviest bot checks
  // Proceed with scraping logic...
  
  await cachedApi.closeSessions();
}

cacheSession();
```
