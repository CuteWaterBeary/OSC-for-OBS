let connected = false

window.addEventListener('DOMContentLoaded', async () => {
    const setValue = (selector, value) => {
        const element = document.querySelector(selector)
        if (element) element.value = value
    }

    const configJson = await window.electronAPI.getConfig()
    if (configJson.network.obsWebSocket) {
        setValue('#obsip', configJson.network.obsWebSocket.ip)
        setValue('#obsport', configJson.network.obsWebSocket.port)
        setValue('#obspassword', configJson.network.obsWebSocket.password)
    }

    if (configJson.network.oscIn) {
        setValue('#oscinip', configJson.network.oscIn.ip)
        setValue('#oscinport', configJson.network.oscIn.port)
    }

    if (configJson.network.oscOut) {
        setValue('#oscoutip', configJson.network.oscOut.ip)
        setValue('#oscoutport', configJson.network.oscOut.port)
    }

    for (const key in configJson.misc) {
        const iSwitch = document.querySelector(`#switch-${key}`)
        if (!iSwitch) { return }
        if (typeof(configJson.misc[key]) === 'object') {
            for (const subkey in configJson.misc[key]) {
                if (subkey === 'enabled') continue
                const input = document.querySelector(`#${key}-${subkey}`)
                if (input) input.value = configJson.misc[key][subkey]
            }
            
            if(configJson.misc[key].enabled === true) {
                const event = new MouseEvent('click', { button: -1 })
                iSwitch.dispatchEvent(event)
            }
        } else if (configJson.misc[key] === true) {
            const event = new MouseEvent('click', { button: -1 })
            iSwitch.dispatchEvent(event)
        }
    }
})

document.querySelector('#connect-button').addEventListener('click', async (event) => {
    const connectButton = event.target

    if (connected) {
        await window.electronAPI.disconnectAll()

        connected = false
        connectButton.innerText = 'Connect'
        document.querySelectorAll('.network-config input').forEach((input) => input.removeAttribute('disabled'))
    } else {
        document.querySelectorAll('.network-config input').forEach((input) => input.setAttribute('disabled', ''))
        // TODO: Do basic check here
        let obsIp = document.querySelector('#obsip').value
        let obsPort = document.querySelector('#obsport').value
        let obsPassword = document.querySelector('#obspassword').value
        let oscInIp = document.querySelector('#oscinip').value
        let oscInPort = document.querySelector('#oscinport').value
        let oscOutIp = document.querySelector('#oscoutip').value
        let oscOutPort = document.querySelector('#oscoutport').value

        if (obsIp === '') obsIp = document.querySelector('#obsip').placeholder
        if (obsPort === '') obsPort = document.querySelector('#obsport').placeholder
        if (oscInIp === '') oscInIp = document.querySelector('#oscinip').placeholder
        if (oscInPort === '') oscInPort = document.querySelector('#oscinport').placeholder
        if (oscOutIp === '') oscOutIp = document.querySelector('#oscoutip').placeholder
        if (oscOutPort === '') oscOutPort = document.querySelector('#oscoutport').placeholder

        try {
            const { result, error, at } = await window.electronAPI.connectAll({ ip: obsIp, port: obsPort, password: obsPassword }, { ip: oscInIp, port: parseInt(oscInPort, 10) }, { ip: oscOutIp, port: parseInt(oscOutPort, 10) })

            if (result) {
                if (obsPassword === '') {
                    console.warn('No password for obs-websocket')
                }

                connected = true
                connectButton.innerText = 'Disconnect'
            } else {
                console.error(`Error occurred when starting ${at}: ${error}`)
                document.querySelectorAll('.network-config input').forEach((input) => input.removeAttribute('disabled'))
            }
        } catch (e) {
            console.error('Internal error:', e)
            document.querySelectorAll('.network-config input').forEach((input) => input.removeAttribute('disabled'))
        }
    }
})

window.electronAPI.cancelConnections(async () => {
    const connectButton = document.querySelector('#connect-button')
    if (connected) {
        await window.electronAPI.disconnectAll()

        connected = false
        connectButton.innerText = 'Connect'
        document.querySelectorAll('.network-config input').forEach((input) => input.removeAttribute('disabled'))
    }
})
