const readline = require("readline");
const {spawnSync} = require("child_process");
const {createTmpFile} = require("./tmp");
const {unlink} = require("mz/fs");

module.exports = {
    prompt,
    inputbox
};
function prompt(question) {
    const prompt = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => 
        prompt.question(question, answer => {
            prompt.close();
            resolve(answer);
        })
    );
}

/**
 *  @BETA
 **/
async function inputbox(title, message, required=false) {
    const script = [
        `dim result`,
        `result=InputBox("${title}","${message}")`,
        `Wscript.Echo result`
    ].join("\n");
    const vbs = await createTmpFile("inputbox.vbs", script);
    let box;
    let result;
    do {
        box = spawnSync("cscript.exe", [vbs]);
        result = box.stdout ? box.stdout.toString() : false;
    } while (required && !result);
    await unlink(vbs);
    return result;
}