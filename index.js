const {createWriteStream, createReadStream} = require("fs");
const {unlink, rmdir, exists, readdir, mkdtemp, writeFile} = require("mz/fs");
const path = require("path");
const os = require("os");
const unzipper = require("unzipper");
const EOSDownloader = require("./app/EOSDownloader");
const {spawnSync} = require("child_process");

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
	process.stdout.write(`Working directory: ${dir}\n`);
	process.stdout.write("Launching...\n");
	let vbscript = [
		`Set UAC = CreateObject("Shell.Application")`,
		`UAC.ShellExecute "${exe}", , "${dir}", "runas", 1`
	].join("\n");
	const tmpdir = await mkdtemp(path.join(os.tmpdir(), "eos-"));
	const vbs = path.join(tmpdir, "launcher.vbs");
	await writeFile(vbs, vbscript);
	let status = spawnSync("wscript.exe", [vbs]).status;
	await unlink(vbs);
	await rmdir(tmpdir);
	if (status == 0) {
		process.stdout.write("EOS launched successfully!\n");
		return 0;
	} else {
		return status ?? 1;
	}
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
