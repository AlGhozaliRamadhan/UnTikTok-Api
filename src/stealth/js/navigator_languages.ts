export const navigator_languages = `
utils.replaceProperty(Object.getPrototypeOf(navigator), 'languages', { get: () => opts.languages || ['en-US', 'en'] })
`;
