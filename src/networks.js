const OBSWebSocket = require('obs-websocket-js')
const { Client, Server } = require('node-osc')

module.exports = { connectOBS, disconnectOBS, connectOSC, disconnectOSC }

let obs
let oscIn
let oscOut

async function connectOBS(ip, port, password) {
    console.info('Connecting OBSWebSocket...')
    console.info(`ip: ${ip}, port: ${port}, password: ${password}`)
    if (obs) {
        console.error('OBSWebSocket already exist')
        return { result: false, error: 'OBSWebSocket already exist', at: 'OBS WebSocket' }
    }

    obs = new OBSWebSocket()
    try {
        const address = ip + ':' + port
        await obs.connect({ address: address, password: password })
    } catch (e) {
        console.error('OBSWebSocket error:', e)
        obs = null
        return { result: false, error: e.error, at: 'OBS WebSocket' }
    }

    obs.on('error', err => {
        console.error('OBSWebSocket error:', err)
    })

    console.info('Connecting OBSWebSocket...Succeeded')
    return { result: true }
}

async function disconnectOBS() {
    console.info('Disconnecting OBSWebSocket...')
    if (obs === null) {
        console.error('OBSWebSocket did not exist')
    }

    try {
        await obs.disconnect()
    } catch (e) {
        console.error('OBSWebSocket error:', e)
    }

    obs = null
    console.info('Disconnecting OBSWebSocket...Succeeded')
}

async function connectOSC(ipIn, portIn, ipOut, portOut) {
    try {
        oscIn = new Server(portIn, ipIn, () => {
            console.info('OSC server is listening')
        })

        oscIn.on('message', (message) => {
            console.info('New OSC message', message)
        })
    } catch (e) {
        console.error('Error occurred when starting OSC server:', e)
        return { result: false, error: e, at: 'OSC In' }
    }

    try {
        oscOut = new Client(ipOut, portOut)
        console.info('OSC client created')
    } catch (e) {
        console.error('Error occurred when starting OSC client:', e)
        return { result: false, error: e, at: 'OSC Out' }
    }

    return { result: true }
}

async function disconnectOSC() {
    if (oscIn) {
        try {
            oscIn.close()
        } catch (e) {
            console.error('Error occurred when stopping OSC server:', e)
        }
    }

    if (oscOut) {
        try {
            oscOut.close()
        } catch (e) {
            console.error('Error occurred when stopping OSC client:', e)
        }
    }

    oscIn = null
    oscOut = null
    console.info('OSC server/client stopped')
}