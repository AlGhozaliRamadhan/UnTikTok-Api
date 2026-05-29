export const navigator_vendor_script = `
utils.replaceProperty(Object.getPrototypeOf(navigator), 'vendor', { get: () => opts.navigator_vendor || 'Google Inc.' })
`;
