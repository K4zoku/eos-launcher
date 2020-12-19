const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const md5File = require('md5-file');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly', 'https://www.googleapis.com/auth/drive.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

module.exports = {
    load
}

function load() {
// Load client secrets from a local file.
    fs.readFile('credentials.json', (err, content) => {
        if (err) return console.log('Error loading client secret file:', err);
        // Authorize a client with credentials, then call the Google Drive API.
        authorize(JSON.parse(content.toString()), checkCurrent);
    });
}


function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials['installed'];
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getAccessToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token.toString()));
        callback(oAuth2Client);
    });
}

function getAccessToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const open = require('open');
    open(authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

const fileId = '15orxKbmGm4foV5Lpc0RYnz9Imvp3IbWF';

function checkCurrent(auth) {
    const drive = google.drive({version: 'v3', auth});
    drive.files.get({
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fileId: fileId,
        fields: 'size, md5Checksum'
    }).then(({data}) => {
        const md5 = data['md5Checksum'];
        const size = data['size'];
        md5File('./EOS-Client.zip')
            .then(hash => {
                return hash === md5;
            }).then(matched => {
            if (matched) console.log("Congratulation, you are using latest version!");
            else {
                console.log("You are using old version, performing download new version...");
                downloadEos(drive, size);
            }
        });
    }).catch(console.error);
}

function downloadEos(drive, size) {
    drive.files.get({
        alt: "media",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fileId: fileId,
    }, {responseType: "stream",})
        .then(res => {
            return new Promise((resolve, reject) => {
                const filePath = './EOS-Client.zip';
                console.log(`Downloading to ${filePath}`);
                const dest = fs.createWriteStream(filePath);
                let progress = 0;
                res.data
                    .on('end', () => {
                        console.log('\nDone downloading file.');
                        resolve(filePath);
                    })
                    .on('error', err => {
                        console.error('Error downloading file.');
                        reject(err);
                    })
                    .on('data', d => {
                        progress += d.length;
                        const percent = ((progress / size) * 100).toFixed(2);
                        if (process.stdout.isTTY) {
                            process.stdout.clearLine();
                            process.stdout.cursorTo(0);
                            process.stdout.write(`Downloaded ${percent}%`);
                        }
                    })
                    .pipe(dest);
            });
        });
}