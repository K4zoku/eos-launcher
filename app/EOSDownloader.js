const open = require("open");
const md5 = require("md5-file");
const {google} = require("googleapis");
const {prompt} = require("../util/prompt.js");
const {exists} = require("mz/fs");
const TokenSerializer = require("./TokenSerializer");

module.exports = class EOSDownloader {
	#client;
	#drive;
	#tokenPath;
	#remoteFileId;
	#metadata;

	constructor(opts) {
		this.#client = new google.auth.OAuth2(opts.clientId, opts.clientSecret, opts.redirectUri);
		this.#tokenPath = opts.tokenPath;
		this.#remoteFileId = opts.remoteFileId;
		this.#metadata = null;
	}

	async authorize() {
		let token;
		const serializer = new TokenSerializer(this.#tokenPath);
		if (await exists(this.#tokenPath)) {
			token = await serializer.load();
		} else {
			let authUrl = this.#client.generateAuthUrl({
        		access_type: "offline",
        		scope: [ 
        			"https://www.googleapis.com/auth/drive.readonly",
        			"https://www.googleapis.com/auth/drive.metadata.readonly"
        		],
    		});
    		process.stdout.write(`Authorize this app by visiting this url: ${authUrl}\n`);
    		open(authUrl);
    		const code = await prompt("Enter the code you get from that page here: ");
    		token = await this.#client.getTokenAsync({code}).then(result => result.tokens);
    		await serializer.save(token);
		}
		this.#client.setCredentials(token);
		this.#drive = google.drive({
	    	version: "v3",
	    	auth: this.#client
	    });
	}

	/**
	 * @return {Promise<boolean>} true if using latest version or else false
	 **/
	async isLatest(filePath) {
		process.stdout.write("Checking for update...\n");
		if (!(await exists(filePath))) return false;
	    const remoteFileMd5 = (await this.getRemoteFileMetadata())["md5Checksum"];
	    const localFileMd5 = await md5(filePath);
	    return remoteFileMd5 == localFileMd5;
	}

	/**
	 * @return {Promise<ReadableStream>}
	 **/
	async download() {
		return (await this.#drive.files.get({
			alt: "media",
    		supportsAllDrives: true,
    		includeItemsFromAllDrives: true,
    		fileId: this.#remoteFileId
		}, {
			responseType: "stream"
		}))["data"];
	}

	async getRemoteFileMetadata() {
		if (this.#metadata == null) {
			this.#metadata = (await this.#drive.files.get({
		    	supportsAllDrives: true,
		        includeItemsFromAllDrives: true,
		        fileId: this.#remoteFileId,
		        fields: "name, size, md5Checksum"
	    	}))["data"];
		}
	    return this.#metadata;
	}
}