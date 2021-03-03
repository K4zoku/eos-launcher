const fs = require('fs');

module.exports = {
	readFile, writeFile, exists
}

function readFile(filename) {
	return new Promise((resolve, reject) => {
		fs.readFile(filename, (err, data) => {
			if (err) reject(err);
			else resolve(data);
		});
	});
}

function writeFile(filename, data) {
	return new Promise((resolve, reject) => {
		fs.writeFile(filename, data.toString(), { flag: 'wx' }, (err) => {
			if (err) reject(err);
			else resolve(true);
		})
	});
}

function exists(filename) {
	return new Promise((resolve, reject) => {
		fs.access(filename, fs.F_OK, (err) => {
			if (err) resolve(false);
			else resolve(true);
		});
	});
}