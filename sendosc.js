// Test utility for sending OSC commands from the CLI
// Needs some polishing

const readline = require("readline");
const { Client } = require("node-osc");
const client = new Client("127.0.0.1", 3333);


function sendOsc(unparsed) {
    let parts = unparsed.split(" ");
    parts = parts.filter(e => e);  // Remove empty strings
    if (parts.length === 0) return;
    parts = parts.map(e => {  // Convert numbers to numbers
        if (!isNaN(e) && !isNaN(parseFloat(e))) {
            if (e.includes(".")) {
                return parseFloat(e);
            } else {
                return parseInt(e);
            }
        } else {
            return e;
        }
    });

    console.log(parts);
    client.send(...parts);
}

function repl() {
    return new Promise((resolve, reject) => {
        let rl = readline.createInterface(process.stdin, process.stdout);
        rl.setPrompt("> ");
        rl.prompt();
        rl.on("line", (line) => {
            if (line === "exit" || line === "quit" || line === "q") {
                rl.close();
                return;  // bail here, so rl.prompt() isn't called again
            }
            sendOsc(line);
            rl.prompt();
        }).on("close",() => {
            console.log("Bye!");
            resolve();
        });
    });
}

async function run() {
    try {
        await repl();
    } catch(e) {
        console.log("Error:", e);
    }
}

run();
