const fs = require('fs');
const path = require('path');

function logTime(msg) {
  const now = new Date();
  const time = now.toISOString().split('T')[1].split('Z')[0];
  console.error(`[${time}] ${msg}`);
  return now.getTime();
}

async function saveDebug(page, name) {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const base = `/home/ubuntu/.hermes/debug/${ts}_${name}`;
    await page.screenshot({ path: `${base}.png` }).catch(() => {});
    const content = await page.content().catch(() => "Failed to get content");
    fs.writeFileSync(`${base}.html`, content);
    logTime(`[DEBUG] Evidence saved: ${name} at ${base}`);
    return base;
  } catch (e) {
    return "debug_save_failed";
  }
}

module.exports = { logTime, saveDebug };
