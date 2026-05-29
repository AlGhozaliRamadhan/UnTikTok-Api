export const navigator_userAgent_script = `
if (opts.navigator_user_agent) {
    utils.replaceProperty(Object.getPrototypeOf(navigator), 'userAgent', { get: () => opts.navigator_user_agent })
}
`;
