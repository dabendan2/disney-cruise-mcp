let navigationLock = Promise.resolve();

async function withLock(fn) {
    const result = navigationLock.then(async () => { return await fn(); });
    navigationLock = result.catch(() => {});
    return result;
}

module.exports = { withLock };
