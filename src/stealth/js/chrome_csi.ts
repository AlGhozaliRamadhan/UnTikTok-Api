export const chrome_csi = `
if (!window.chrome) {
    Object.defineProperty(window, 'chrome', { writable: true, enumerable: true, configurable: false, value: {} })
}
if (!('csi' in window.chrome)) {
    window.chrome.csi = function() {
        return { onloadT: Date.now(), startE: Date.now(), pageT: Date.now() - performance.timing.navigationStart, tran: 15 }
    }
    utils.patchToString(window.chrome.csi)
}
`;
