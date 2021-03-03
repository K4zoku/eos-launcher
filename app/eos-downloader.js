const fs = require('fs');
const open = require('open');
const md5File = require('md5-file');
const { google } = require('googleapis');
const { ask } = require('../util/prompt.js');
const { readFile, writeFile, exists } = require('../util/fs-promises.js');

const { TOKEN_FILE_PATH, LOCAL_FILE_PATH, REMOTE_FILE_ID, SCOPES } = require('../config.json');

module.exports = { runApp }

function runApp(args = []) {
    authorize()
    .then(client => checkForUpdate(client))
    .catch(err => console.error(err.message));
}


function authorize() {
    const {client_secret, client_id, redirect_uris} = require('../credentials.json')['installed'];
    const client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    return exists(TOKEN_FILE_PATH)
    .then(exists => {
        if (exists) return loadToken();
        else {
            let p = requestNewToken(client);
            p.then(token => saveToken(token));
            return p;
        }
    })
    .then(token => {
        client.setCredentials(token);
        return client;
    });
}

function requestNewToken(client) {
    const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    open(authUrl);
    return ask('Enter the code you get from that page here: ')
    .then(code => getToken(client, code));
}

function getToken(client, code) {
    return client.getTokenAsync({code: code}).then(r => r.tokens);
}

function saveToken(token) {
    return writeFile(TOKEN_FILE_PATH, JSON.stringify(token));
}

function loadToken() {
    return readFile(TOKEN_FILE_PATH).then(data => JSON.parse(data.toString()));
}

function checkForUpdate(client) {
    const driveOpts = {
        version: 'v3', 
        auth: client
    };

    const getOpts = {
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fileId: REMOTE_FILE_ID,
        fields: 'size, md5Checksum'
    };
    const drive = google.drive(driveOpts);

    return drive.files
    .get(getOpts)
    .then(({data}) => {
        const md5 = data['md5Checksum'];
        const size = data['size'];
        const filepath = './EOS-Client.zip';
        exists(filepath)
        .then(exists => {
            if (exists) {
                return md5File(filepath)
                    .then(hash => {
                    if (hash === md5) {
                        console.log("Congratulation, you are using latest version!");
                        return true;
                    } else {
                        console.log("You are using old version, performing download new version...");
                        return downloadEos(drive, size);
                    }
                });
            } else {
                console.log("EOS-Client not exists, downloading new one...");
                return downloadEos(drive, size);
            }
        });
    });
}

function downloadEos(drive, size) {

    const getOpts = {
        alt: "media",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fileId: REMOTE_FILE_ID
    };

    const resOpts = {
        responseType: "stream"
    }

    return drive.files
    .get(getOpts, resOpts)
    .then(res => 
        new Promise((resolve, reject) => {
            console.log(`Downloading to ${LOCAL_FILE_PATH}`);
            const dest = fs.createWriteStream(LOCAL_FILE_PATH);
            let progress = 0;
            res.data
            .on('end', () => {
                console.log('\nDone downloading file.');
                resolve(LOCAL_FILE_PATH);
            })
            .on('error', err => {
                console.error('Error downloading file.');
                reject(err);
            })
            .on('data', d => {
                progress += d.length;
                const percent = ((progress / size) * 100).toFixed(0);
                if (process.stdout.isTTY) {
                    process.stdout.clearLine();
                    process.stdout.cursorTo(0);
                    process.stdout.write(`Downloaded ${percent}%`);
                }
            })
            .pipe(dest);
        })
    );
}
