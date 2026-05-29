export const webgl_vendor_script = `
const getParameterProxy = {
    apply: function(target, ctx, args) {
        const param = (args || [])[0]
        const UNMASKED_VENDOR_WEBGL = 0x9245
        const UNMASKED_RENDERER_WEBGL = 0x9246
        if (param === UNMASKED_VENDOR_WEBGL) { return opts.webgl_vendor || 'Intel Inc.' }
        if (param === UNMASKED_RENDERER_WEBGL) { return opts.webgl_renderer || 'Intel Iris OpenGL Engine' }
        return utils.cache.Reflect.apply(target, ctx, args)
    }
}
utils.replaceWithProxy(WebGLRenderingContext.prototype, 'getParameter', getParameterProxy)
`;
