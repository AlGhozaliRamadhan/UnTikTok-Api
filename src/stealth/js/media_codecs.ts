export const media_codecs = `
const makeCanPlayType = (supported, fn) => {
    utils.replaceWithProxy(HTMLMediaElement.prototype, 'canPlayType', {
        apply: function(target, ctx, args) {
            const type = (args || [])[0]
            const result = utils.cache.Reflect.apply(target, ctx, args)
            if (type === supported) { return 'probably' }
            return result
        }
    })
}
makeCanPlayType('video/ogg; codecs="theora"', fn => fn)
`;
