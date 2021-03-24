module.exports = {
    extends: ["airbnb-typescript/base", "prettier"],
    plugins: ["prettier"],
    rules: {
        "prettier/prettier": ["error"],
        "no-use-before-define": "off",
        "@typescript-eslint/no-use-before-define": "off",
    },
    parserOptions: {
        project: ["./tsconfig.json"],
    },
};
