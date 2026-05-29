export const window_outerdimensions = `
try {
    if (window.outerWidth === 0) { Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth }) }
    if (window.outerHeight === 0) { Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight }) }
} catch (err) { /* noop */ }
`;
