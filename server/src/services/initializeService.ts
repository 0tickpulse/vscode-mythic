export default () => ({
    capabilities: {
        hoverProvider: true,
        completionProvider: {
            resolveProvider: true,
            triggerCharacters: ["@", "?", "~"],
        },
    },
});
