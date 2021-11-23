const {writeFile} = require("mz/fs");
const {join} = require("path");
const {tmpdir} = require("os");

module.exports = {
	createTmpFile
};

async function createTmpFile(name, content) {
	const tmp = tmpdir();
	const file = join(tmp, "eos-" + name);
	if (content) await writeFile(file, content);
	return file;
}