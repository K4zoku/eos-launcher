const {readFile, writeFile} = require("mz/fs");

module.exports = class TokenSerializer {
	#filepath;

	constructor(filepath) {
		this.#filepath = filepath;
	}

	load() {
		return readFile(this.#filepath).then(data => JSON.parse(data.toString()));
	}

	save(token) {
		return writeFile(this.#filepath, JSON.stringify(token));
	}
}