const {createWriteStream, createReadStream} = require("fs");
const {unlink, exists, readdir, mkdtemp, writeFile} = require("mz/fs");
const path = require("path");
const os = require("os");
const unzipper = require("unzipper");
const EOSDownloader = require("./app/EOSDownloader");
const spawn = require("child_process").spawnSync;

function download(opts) {
	return new Promise(async (resolve, reject) => {
		process.stdout.write("Downloading...");
		const dest = createWriteStream(opts.filePath);
		let stream = await opts.downloader.download();
		let progress = 0;
	   	stream.on("error", error => {
	   		process.stderr.write("An error occurred while downloading file.\n");
	   		reject(error);
	   	})
	    .on("data", data => {
	    	progress += data.length;
	    	process.stdout.write(`\rDownloading ${((progress / opts.size) * 100).toFixed(0)}%`);
	    })
	    .pipe(dest)
	    .on("error", error => {
	   		process.stderr.write("An error occurred while writing file.\n");
	   		reject(error);
	   	})
	    .on("finish", () => {
	    	process.stdout.write("\nDownload complete!\n");
	    	resolve();
	    })
	    ;
	});
}

function extract(opts) {
	return new Promise((resolve, reject) => {
		process.stdout.write("Extracting...\n");
		createReadStream(opts.filePath)
  		.on("error", error => {
	   		process.stderr.write("An error occurred while reading zip.\n");
	   		reject(error);
	   	})
  		.pipe(unzipper.Extract({path: opts.cwd}))
  		.on("error", error => {
	   		process.stderr.write("An error occurred while extracting files.\n");
	   		reject(error);
	   	})
  		.on("close", () => {
  			process.stdout.write("Extract complete!\n");
  			resolve();
  		});
	});
}

async function launchEOS(dir) {
	let files = await readdir(dir);
	let exe = path.join(dir, files.filter(file => file.endsWith(".exe"))[0]);
	process.stdout.write(`Executable: ${exe}\n`);
	process.stdout.write("Launching...\n");
	let vbscript = [
		`Set UAC = CreateObject^("Shell.Application"^)`,
		`UAC.ShellExecute "${exe}", , , "runas", 1`
	].join("\n");
	let tmpdir = await mkdtemp(path.join(os.tmpdir(), "eos-launcher-"));
	let vbsFile = path.join(tmpdir, "launcher.vbs");
	await writeFile(vbsFile, vbscript);
	let wbscriptExe = "C:\\System32\\wbscript.exe";
	if (!(await exists(wbscriptExe))) {
		wbscriptExe = "C:\\Windows\\SysWOW64\\wbscript.exe";
	}
	if (!(await exists(wbscriptExe))) {
		process.stderr.write("wbscript.exe not found, cannot automatically launch EOSClient with administrator privilege!\n");
		process.stderr.write("Don't worry, you can still run as administrator manually!\n");
		return;
	}
	let executed = spawn(wbscriptExe, [vbsFile]);
	await unlink(vbsFile);
	let out = executed.stdout ? executed.stdout.toString() : "";
	let err = executed.stderr ? executed.stderr.toString() : "";
	if (out) process.stdout.write(`${out}\n`);
	if (err) process.stderr.write(`${err}\n`);
	return executed.status ?? 1;
}

async function main(args) {
	const {tokenPath, remoteFileId, workingDir} = require("./config.json");
	const {client_id, client_secret, redirect_uris} = require("./credentials.json")["installed"];
	const downloader = new EOSDownloader({
		clientId: client_id,
		clientSecret: client_secret,
		redirectUri: redirect_uris[0],
		tokenPath, 
		remoteFileId
	});
	await downloader.authorize();
	const metadata = await downloader.getRemoteFileMetadata();
	const cwd = args["p"] ?? args["path"] ?? workingDir ?? process.cwd();
	const fileName = args["n"] ?? args["name"] ?? metadata["name"];
	const filePath = path.join(cwd, fileName);
	const size = metadata["size"];
	process.stdout.write(`Path: ${cwd}\n`);
	process.stdout.write(`File: ${fileName}\n`);
	if (await downloader.isLatest(filePath)) {
		process.stdout.write("You are using lastest version!\n");
	} else {
		await download({downloader, filePath, size});
	}
	await extract({cwd, filePath});
	return await launchEOS(filePath.replace(".zip", ""));
}

main(require("minimist")(process.argv.slice(2)))
	.then(exitCode => process.exitCode = exitCode)
	.catch(error => {
		console.error(error);
		process.exitCode = 1;
	});