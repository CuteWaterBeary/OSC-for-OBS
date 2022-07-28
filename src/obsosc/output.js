module.exports = { processOutput }

const DEBUG = process.argv.includes('--enable-log')

async function processOutput(networks, path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getOutputList(networks)
            return
        }

        getOutputStatus(networks, args[0])
        return
    }

    if (path[1]) {
        if (path[1] === 'start') {
            if (args[0] === 1) {
                startOutput(networks, path[0])
            } else if (args[0] === 0) {
                stopOutput(networks, path[0])
            }
        } else if (path[1] === 'stop' && args[0] === 1) {
            stopOutput(networks, path[0])
        } else if (path[1] === 'toggle' && args[0] === 1) {
            toggleOutput(networks, path[0])
        }
    } else {
        if (args[0] === undefined) {
            getOutputStatus(networks, path[0])
            return
        }

        if (args[0] === 1) {
            startOutput(networks, path[0])
        } else if (args[0] === 0) {
            stopOutput(networks, path[0])
        }
    }
}

// Note: GetOutputList response: { outputs: [GetOutputStatus response] }
async function getOutputList(networks) {
    const outputListPath = '/output'
    try {
        const {outputs} = await networks.obs.call('GetOutputList')
        const outputList = outputs.flatMap(output => output.outputName)
        networks.oscOut.send(outputListPath, outputList)
    } catch (e) {
        if (DEBUG) console.error('getOutputList -- Failed to get output list:', e)
    }
}


// TODO: Add more output option (outputReconnecting, outputDuration, etc.)
async function getOutputStatus(networks, outputName) {
    if (outputName === undefined) {
        getOutputList(networks)
        return
    }

    const outputPath = `/output/${outputName}`
    try {
        const { outputActive } = await networks.obs.call('GetOutputStatus', { outputName })
        networks.oscOut.send(outputPath, outputActive ? 1 : 0)
    } catch (e) {
        if (DEBUG) console.error('getOutputInfo -- Failed to get output info:', e)
    }
}

async function startOutput(networks, outputName) {
    try {
        await networks.obs.call('StartOutput', { outputName })
    } catch (e) {
        if (DEBUG) console.error(`startOutput -- Failed to start output ${outputName}:`, e)
    }
}

async function stopOutput(networks, outputName) {
    try {
        await networks.obs.call('StopOutput', { outputName })
    } catch (e) {
        if (DEBUG) console.error(`startOutput -- Failed to stop output ${outputName}:`, e)
    }
}

async function toggleOutput(networks, outputName) {
    try {
        await networks.obs.call('ToggleOutput', { outputName })
    } catch (e) {
        if (DEBUG) console.error(`toggleOutput -- Failed to toggle state of output ${outputName}:`, e)
    }
}
