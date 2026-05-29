export const chrome_load_times = `
if (!window.chrome) {
    Object.defineProperty(window, 'chrome', { writable: true, enumerable: true, configurable: false, value: {} })
}
if (!('loadTimes' in window.chrome)) {
    const loadTime = Date.now() / 1000 - Math.random() * 20
    const startLoadTime = loadTime - Math.random() * 2
    const data = {
        get commitLoadTime() { return startLoadTime },
        get finishDocumentLoadTime() { return loadTime },
        get finishLoadTime() { return loadTime + Math.random() },
        get firstPaintAfterLoadTime() { return 0 },
        get firstPaintTime() { return startLoadTime + Math.random() * 2 },
        get navigationType() { return 'Other' },
        get npnNegotiatedProtocol() { return 'unknown' },
        get requestTime() { return startLoadTime - 0.01 },
        get startLoadTime() { return startLoadTime },
        get wasAlternateProtocolAvailable() { return false },
        get wasFetchedViaSpdy() { return false },
        get wasNpnNegotiated() { return false }
    }
    utils.replaceProperty(window.chrome, 'loadTimes', { value: function loadTimes() { return data } })
    utils.patchToString(window.chrome.loadTimes)
}
`;
