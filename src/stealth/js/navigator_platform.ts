export const navigator_platform = `
if (opts.navigator_platform) {
    utils.replaceProperty(Object.getPrototypeOf(navigator), 'platform', { get: () => opts.navigator_platform })
}
`;
