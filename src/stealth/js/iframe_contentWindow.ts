export const iframe_contentWindow = `
try {
    const getContentWindowProxy = {
        apply: function(target, ctx, args) {
            const iframe = args[0]
            if (!iframe || iframe.nodeName !== 'IFRAME') { return utils.cache.Reflect.apply(target, ctx, args) }
            const win = utils.cache.Reflect.apply(target, ctx, args)
            win.Object = window.Object
            win.Reflect = window.Reflect
            return win
        }
    }
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get() {
            return new Proxy(HTMLIFrameElement.prototype.contentWindow, getContentWindowProxy)
        }
    })
} catch (err) { /* noop */ }
`;
