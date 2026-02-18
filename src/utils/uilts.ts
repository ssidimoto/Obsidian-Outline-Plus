    //write in debug.txt content from log. Open a file and write in it. add a /n at the end
export function writeLog(log: string) {
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(__dirname, 'debug.txt');
    fs.appendFile(logPath, log + '\n', (err: any) => {
        if (err) {
            console.error('Error writing to log file:', err);
        }
    });
}
