export const generate_magic_arrays = `
function generateMagicArray(dataArray = [], proto = MimeTypeArray.prototype, itemProto = MimeType.prototype, itemMainProp = 'type') {
    const arr = []
    arr.__proto__ = proto
    for (const item of dataArray) {
        const obj = {}
        obj.__proto__ = itemProto
        for (const [key, value] of Object.entries(item)) {
            if (!key.startsWith('__')) { obj[key] = value }
        }
        Object.defineProperty(obj, itemMainProp, { configurable: true, enumerable: true, get: () => item[itemMainProp] })
        arr.push(obj)
        arr[item[itemMainProp]] = obj
    }
    const proxy = new Proxy(arr, {
        get(target, key) {
            if (key === 'length') { return target.length }
            if (key === Symbol.toStringTag) { return Object.getPrototypeOf(target)[Symbol.toStringTag] }
            if (key in target) { return target[key] }
            return undefined
        }
    })
    return proxy
}
`;
