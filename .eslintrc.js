module.exports = {
    "env": {
        "commonjs": true,
        "es2021": true,
        "node": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 12
    },
    "rules": {
        "indent": [
            "error",
            4
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "double"
        ],
        "semi": [
            "error",
            "always"
        ],
        "no-var": 2,
        "spaced-comment": [
            "error",
            "always",
            { "exceptions": ["-", "#"] }
        ],
        "space-before-function-paren": [
            "error",
            "never"
        ],
        "arrow-spacing": ["error", {"before": true, "after": true}]
    }
};
