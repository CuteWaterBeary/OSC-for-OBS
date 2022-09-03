const DEBUG = process.argv.includes('--enable-log')
const TEST = process.argv.includes('--unit-test')

if (TEST) {
    module.exports = { processOutput, getOutputList, getOutputStatus, startOutput, stopOutput, toggleOutput }
} else {
    module.exports = { processOutput }
}


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
async function getOutputList(networks, sendOSC = true) {
    const outputListPath = '/output'
    try {
        const { outputs } = await networks.obs.call('GetOutputList')
        if (sendOSC) {
            try {
                networks.oscOut.send(outputListPath, outputs.flatMap(output => output.outputName))
            } catch (e) {
                if (DEBUG) console.error('getOutputList -- Failed to send output list:', e)
            }
        }

        return outputs
    } catch (e) {
        if (DEBUG) console.error('getOutputList -- Failed to get output list:', e)
    }
}


// TODO: Add more output option (outputReconnecting, outputDuration, etc.)
async function getOutputStatus(networks, outputName, sendOSC = true) {
    if (outputName === undefined) {
        if (DEBUG) console.error('getOutputInfo -- Output name not specified')
        return
    }

    const outputPath = `/output/${outputName}`
    try {
        const { outputActive } = await networks.obs.call('GetOutputStatus', { outputName })
        if (sendOSC) {
            try {
                networks.oscOut.send(outputPath, outputActive ? 1 : 0)
            } catch (e) {
                if (DEBUG) console.error('getOutputInfo -- Failed to send output info:', e)
            }
        }

        return outputActive
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
