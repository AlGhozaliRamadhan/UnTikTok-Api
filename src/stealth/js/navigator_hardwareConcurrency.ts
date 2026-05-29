export const navigator_hardwareConcurrency = `
utils.replaceProperty(Object.getPrototypeOf(navigator), 'hardwareConcurrency', { get: () => opts.navigator_hardware_concurrency || 4 })
`;
