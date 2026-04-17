function validateArgs(args, required) {
    if (!args) {
        throw new Error("STRICT FAIL: Missing arguments object.");
    }
    for (const key of required) {
        if (!args[key] || args[key] === "null" || args[key] === "") {
            throw new Error(`STRICT FAIL: Mandatory parameter '${key}' is missing or null.`);
        }
    }
}

module.exports = { validateArgs };
