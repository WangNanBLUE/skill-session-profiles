const { execFile } = require("node:child_process");
const { join } = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

module.exports = async (context) => {
  if (context.electronPlatformName !== "darwin") return;
  const appName = `${context.packager.appInfo.productFilename}.app`;
  const infoPlist = join(context.appOutDir, appName, "Contents", "Info.plist");
  await execFileAsync("plutil", [
    "-replace",
    "NSAppTransportSecurity.NSAllowsArbitraryLoads",
    "-bool",
    "NO",
    infoPlist,
  ]);
  await execFileAsync("plutil", [
    "-replace",
    "NSAppTransportSecurity.NSAllowsLocalNetworking",
    "-bool",
    "NO",
    infoPlist,
  ]);
  try {
    await execFileAsync("plutil", [
      "-remove",
      "NSAppTransportSecurity.NSExceptionDomains",
      infoPlist,
    ]);
  } catch (error) {
    if (!String(error).includes("Could not modify plist")) throw error;
  }
};
