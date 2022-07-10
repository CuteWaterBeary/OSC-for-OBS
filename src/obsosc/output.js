module.exports = { processOutput }

const DEBUG = process.argv.includes('--enable-log')

async function processOutput(networks, path, args) {
    if (path[0] === undefined) {
        getOutputInfo(networks, args[0])
        return
    }

    setOutputState(networks, path, args)
}

async function getOutputList(networks) {
    try {
        const response = await networks.obs.send('ListOutputs')
        const outputList = []
        response.outputs.forEach(output => { outputList.push(output.name) })
        networks.oscOut.send('/outputList', outputList)
    } catch (e) {
        if (DEBUG) console.error('getOutputInfo -- Failed to get output list:', e)
    }
}

async function getOutputInfo(networks, output) {
    if (output === undefined) {
        getOutputList(networks)
        return
    }

    const outputPath = `/output/${output}`
    try {
        const response = await networks.obs.send('GetOutputInfo', { outputName: output })
        networks.oscOut.send(outputPath, response.outputInfo.active ? 1 : 0)
    } catch (e) {
        if (DEBUG) console.error('getOutputInfo -- Failed to get output info:', e)
    }
}

async function setOutputState(networks, path, args) {
    if (path[1]) {
        if (path[1] === 'start' && args[0] === 1) startOutput(networks, path[0])
        if (path[1] === 'stop' && args[0] === 1) stopOutput(networks, path[0])
        if (path[1] === 'toggle' && args[0] === 1) toggleOutput(networks, path[0])
        return
    }

    if (args[0] === 1) {
        startOutput(networks, path[0])
    } else {
        stopOutput(networks, path[0])
    }
}

async function startOutput(networks, output) {
    try {
        await networks.obs.send('StartOutput', { outputName: output })
    } catch (e) {
        if (DEBUG) console.error(`startOutput -- Failed to start output ${output}`, e)
    }
}

async function stopOutput(networks, output) {
    try {
        await networks.obs.send('StopOutput', { outputName: output })
    } catch (e) {
        if (DEBUG) console.error(`startOutput -- Failed to stop output ${output}`, e)
    }
}

async function toggleOutput(networks, output) {
    try {
        const response = await networks.obs.send('GetOutputInfo', { outputName: output })
        try {
            if (response.outputInfo.active === true) {
                await networks.obs.send('StopOutput', { outputName: output })
            } else {
                await networks.obs.send('StartOutput', { outputName: output })
            }
        } catch (e) {
            if (DEBUG) console.error(`toggleOutput -- Failed to toggle output ${output}`, e)
        }
    } catch (e) {
        if (DEBUG) console.error('toggleOutput -- Failed to get output info:', e)
    }
}
