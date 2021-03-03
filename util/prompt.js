const readline = require('readline');

module.exports = {
    ask
};

function ask(question) {
    const prompt = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        prompt.question(question, (answer) => {
            prompt.close();
            resolve(answer);
        })
    });
}