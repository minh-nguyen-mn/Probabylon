const fs = require("fs");
const path = require("path");

const candidates = [".next", ".next-app"];

for (const dir of candidates) {
  removeDirectory(dir);
}

function removeDirectory(relativeDir) {
  const target = path.resolve(process.cwd(), relativeDir);

  if (!fs.existsSync(target)) {
    return;
  }

  try {
    fs.rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
    return;
  } catch (error) {
    if (!isWindowsLockError(error)) {
      throw error;
    }
  }

  const parkedTarget = `${target}.stale-${Date.now()}`;

  try {
    fs.renameSync(target, parkedTarget);
    fs.rmSync(parkedTarget, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  } catch (error) {
    if (!isWindowsLockError(error)) {
      throw error;
    }

    console.warn(
      `[clean] Skipped deleting ${relativeDir} because it is locked by another process. ` +
        "Stop the running Next.js/dev server or exclude the folder from antivirus if this keeps happening."
    );
  }
}

function isWindowsLockError(error) {
  return error && (error.code === "EPERM" || error.code === "EBUSY" || error.code === "ENOTEMPTY");
}
