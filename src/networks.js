const OBSWebSocket = require('obs-websocket-js')
const { Client, Server } = require('node-osc')

module.exports = { connectOBS, disconnectOBS, connectOSC, disconnectOSC }

let obs
let oscIn
let oscOut

async function connectOBS(config) {
    console.info('Connecting OBSWebSocket...')
    console.info(`ip: ${config.ip}, port: ${config.port}, password: ${config.password}`)
    if (obs) {
        console.error('OBSWebSocket already exist')
        return { result: false, error: 'OBSWebSocket already exist', at: 'OBS WebSocket' }
    }

    obs = new OBSWebSocket()
    try {
        const address = config.ip + ':' + config.port
        await obs.connect({ address: address, password: config.password })
    } catch (e) {
        console.error('OBSWebSocket error:', e)
        obs = null
        return { result: false, error: e.error, at: 'OBS WebSocket' }
    }

    obs.on('error', err => {
        console.error('OBSWebSocket error:', err)
    })

    obs.on('ConnectionClosed', () => {
        console.info('OBSWebSocket is closed')
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

async function connectOSC(oscInConfig, oscOutConfig) {
    try {
        oscIn = new Server(oscInConfig.port, oscInConfig.ip, () => {
            console.info(`OSC server is listening to ${oscInConfig.ip}:${oscInConfig.port}`)
        })

        oscIn.on('message', (message) => {
            console.info('New OSC message', message)
        })
    } catch (e) {
        console.error('Error occurred when starting OSC server:', e)
        return { result: false, error: e, at: 'OSC In' }
    }

    try {
        oscOut = new Client(oscOutConfig.ip, oscOutConfig.port)
        console.info(`OSC client is ready to send to ${oscOutConfig.ip}:${oscOutConfig.port}`)
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