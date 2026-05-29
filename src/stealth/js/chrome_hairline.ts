export const chrome_hairline = `
const canvasContext = document.createElement('canvas').getContext('webgl')
if (canvasContext) {
    const nativeGetParameter = WebGLRenderingContext.prototype.getParameter
    utils.replaceWithProxy(WebGLRenderingContext.prototype, 'getParameter', {
        apply: function(target, ctx, args) {
            const param = (args || [])[0]
            if (param === 37446) { return 0 }
            return utils.cache.Reflect.apply(target, ctx, args)
        }
    })
}
`;
