const {createTmpFile} = require("./tmp");
const {unlink} = require("mz/fs");
const {spawnSync} = require("child_process");

module.exports = {
	runAsAdministrator
}

async function runAsAdministrator(exeFile, workingDir) {
	const launchScript = [
		`Set UAC = CreateObject("Shell.Application")`,
		`UAC.ShellExecute "${exeFile}", , "${workingDir}", "runas", 1`,
	].join("\n");
	const launcher = await createTmpFile("runasadmin.vbs", launchScript);
	const child = spawnSync("cscript.exe", [launcher]);
	await unlink(launcher);
	return child;
}