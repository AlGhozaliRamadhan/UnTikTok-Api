export const chrome_app = `
if (!window.chrome) {
    Object.defineProperty(window, 'chrome', {
        writable: true, enumerable: true, configurable: false, value: {}
    })
}
if (!('app' in window.chrome)) {
    const makeError = {
        ErrorInInvocation: fn => {
            const err = new TypeError(\`Error in invocation of app.\${fn}()\`)
            return utils.stripErrorWithAnchor(err, \`at \${fn} (eval at <anonymous>\`)
        }
    }
    const APP_STATIC_DATA = JSON.parse(\`{"isInstalled":false,"InstallState":{"DISABLED":"disabled","INSTALLED":"installed","NOT_INSTALLED":"not_installed"},"RunningState":{"CANNOT_RUN":"cannot_run","READY_TO_RUN":"ready_to_run","RUNNING":"running"}}\`)
    window.chrome.app = {
        ...APP_STATIC_DATA,
        get isInstalled() { return false },
        getDetails: function getDetails() { if (arguments.length) throw makeError.ErrorInInvocation('getDetails'); return null },
        getIsInstalled: function getIsInstalled() { if (arguments.length) throw makeError.ErrorInInvocation('getIsInstalled'); return false },
        runningState: function runningState() { if (arguments.length) throw makeError.ErrorInInvocation('runningState'); return 'cannot_run' }
    }
    utils.patchToStringNested(window.chrome.app)
}
`;
