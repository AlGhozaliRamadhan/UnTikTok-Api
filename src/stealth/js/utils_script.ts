export const utils_script = `
const utils = {}
utils.stripProxyFromErrors = (handler = {}) => {
  const newHandler = {}
  const traps = Object.getOwnPropertyNames(handler)
  traps.forEach(trap => {
    newHandler[trap] = function() {
      try { return handler[trap].apply(this, arguments || []) } catch (err) {
        if (!err || !err.stack || !err.stack.includes('at ')) { throw err }
        const stripWithBlacklist = stack => {
          const blacklist = ['at Reflect.' + trap + ' ', 'at Object.' + trap + ' ', 'at Object.newHandler.<computed> [as ' + trap + '] ']
          return err.stack.split('\\n').filter((line, index) => index !== 1).filter(line => !blacklist.some(bl => line.trim().startsWith(bl))).join('\\n')
        }
        const stripWithAnchor = stack => {
          const stackArr = stack.split('\\n')
          const anchor = 'at Object.newHandler.<computed> [as ' + trap + '] '
          const anchorIndex = stackArr.findIndex(line => line.trim().startsWith(anchor))
          if (anchorIndex === -1) return false
          stackArr.splice(1, anchorIndex)
          return stackArr.join('\\n')
        }
        err.stack = stripWithAnchor(err.stack) || stripWithBlacklist(err.stack)
        throw err
      }
    }
  })
  return newHandler
}
utils.stripErrorWithAnchor = (err, anchor) => {
  const stackArr = err.stack.split('\\n')
  const anchorIndex = stackArr.findIndex(line => line.trim().startsWith(anchor))
  if (anchorIndex === -1) return err
  stackArr.splice(1, anchorIndex)
  err.stack = stackArr.join('\\n')
  return err
}
utils.replaceProperty = (obj, propName, descriptorOverrides = {}) => {
  return Object.defineProperty(obj, propName, { ...(Object.getOwnPropertyDescriptor(obj, propName) || {}), ...descriptorOverrides })
}
utils.preloadCache = () => {
  if (utils.cache) return
  utils.cache = { Reflect: { get: Reflect.get.bind(Reflect), apply: Reflect.apply.bind(Reflect) }, nativeToStringStr: Function.toString + '' }
}
utils.makeNativeString = (name = '') => { utils.preloadCache(); return utils.cache.nativeToStringStr.replace('toString', name || '') }
utils.patchToString = (obj, str = '') => {
  utils.preloadCache()
  const toStringProxy = new Proxy(Function.prototype.toString, {
    apply: function(target, ctx) {
      if (ctx === Function.prototype.toString) return utils.makeNativeString('toString')
      if (ctx === obj) return str || utils.makeNativeString(obj.name)
      const hasSameProto = Object.getPrototypeOf(Function.prototype.toString).isPrototypeOf(ctx.toString)
      if (!hasSameProto) return ctx.toString()
      return target.call(ctx)
    }
  })
  utils.replaceProperty(Function.prototype, 'toString', { value: toStringProxy })
}
utils.patchToStringNested = (obj = {}) => { return utils.execRecursively(obj, ['function'], utils.patchToString) }
utils.redirectToString = (proxyObj, originalObj) => {
  utils.preloadCache()
  const toStringProxy = new Proxy(Function.prototype.toString, {
    apply: function(target, ctx) {
      if (ctx === Function.prototype.toString) return utils.makeNativeString('toString')
      if (ctx === proxyObj) {
        const fallback = () => originalObj && originalObj.name ? utils.makeNativeString(originalObj.name) : utils.makeNativeString(proxyObj.name)
        return originalObj + '' || fallback()
      }
      const hasSameProto = Object.getPrototypeOf(Function.prototype.toString).isPrototypeOf(ctx.toString)
      if (!hasSameProto) return ctx.toString()
      return target.call(ctx)
    }
  })
  utils.replaceProperty(Function.prototype, 'toString', { value: toStringProxy })
}
utils.replaceWithProxy = (obj, propName, handler) => {
  utils.preloadCache()
  const originalObj = obj[propName]
  const proxyObj = new Proxy(obj[propName], utils.stripProxyFromErrors(handler))
  utils.replaceProperty(obj, propName, { value: proxyObj })
  utils.redirectToString(proxyObj, originalObj)
  return true
}
utils.mockWithProxy = (obj, propName, pseudoTarget, handler) => {
  utils.preloadCache()
  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))
  utils.replaceProperty(obj, propName, { value: proxyObj })
  utils.patchToString(proxyObj)
  return true
}
utils.createProxy = (pseudoTarget, handler) => {
  utils.preloadCache()
  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))
  utils.patchToString(proxyObj)
  return proxyObj
}
utils.splitObjPath = objPath => ({
  objName: objPath.split('.').slice(0, -1).join('.'),
  propName: objPath.split('.').slice(-1)[0]
})
utils.replaceObjPathWithProxy = (objPath, handler) => {
  const { objName, propName } = utils.splitObjPath(objPath)
  const obj = eval(objName)
  return utils.replaceWithProxy(obj, propName, handler)
}
utils.execRecursively = (obj = {}, typeFilter = [], fn) => {
  function recurse(obj) {
    for (const key in obj) {
      if (obj[key] === undefined) continue
      if (obj[key] && typeof obj[key] === 'object') recurse(obj[key])
      else if (obj[key] && typeFilter.includes(typeof obj[key])) fn.call(this, obj[key])
    }
  }
  recurse(obj)
  return obj
}
`;
