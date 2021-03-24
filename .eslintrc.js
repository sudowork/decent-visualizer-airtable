module.exports = {
    extends: ["airbnb-typescript/base", "prettier"],
    plugins: ["prettier"],
    rules: {
        "prettier/prettier": ["error"],
    },
    parserOptions: {
        project: ["./tsconfig.json"],
    },
};
