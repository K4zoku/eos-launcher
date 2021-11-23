#!/usr/bin/env node

const {createWriteStream, createReadStream} = require("fs");
const {rmdir, exists, readdir} = require("mz/fs");
const {join} = require("path");
const {Extract} = require("unzipper");
const {spawnSync} = require("child_process");
const GDDownloader = require("./app/GDDownloader");
const {runAsAdministrator} = require("./util/launcher");

function download(opts) {
	return new Promise(async (resolve, reject) => {
		process.stdout.write("Downloading...");
		const dest = createWriteStream(opts.filePath);
		const stream = await opts.downloader.download();
		let downloaded = 0;
	   	stream.on("error", error => {
	   		process.stderr.write("An error occurred while downloading file.\n");
	   		reject(error);
	   	})
	    .on("data", data => {
	    	downloaded += data.length;
	    	process.stdout.write(`\rDownloading ${((downloaded / opts.size) * 100).toFixed(0)}%`);
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
  		.pipe(Extract({path: opts.cwd}))
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
	const files = await readdir(dir);
	const exe = join(dir, files.filter(file => file.endsWith(".exe"))[0]);
	process.stdout.write(`Executable: ${exe}\n`);
	process.stdout.write(`Working directory: ${dir}\n`);
	process.stdout.write("Launching...\n");
	const proc = await runAsAdministrator(exe, dir);
	const status = proc.status ?? 1;
	if (status == 0) {
		process.stdout.write("EOS launched successfully!\n");
	} else {
		process.stdout.write("Failed to launch!\n");
	}
	return status;
}

async function main(args) {
	const {tokenPath, remoteFileId, workingDir} = require("./config.json");
	const {client_id, client_secret, redirect_uris} = require("./credentials.json")["installed"];
	const downloader = new GDDownloader({
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
	const filePath = join(cwd, fileName);
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

main(process.args = require("minimist")(process.argv.slice(2)))
	.then(exitCode => process.exitCode = exitCode)
	.catch(error => {
		console.error(error);
		process.exitCode = 1;
	});