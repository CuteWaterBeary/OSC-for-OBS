let connected = false


window.addEventListener('DOMContentLoaded', async () => {
    const setValue = (selector, value) => {
        const element = document.querySelector(selector)
        if (element) element.value = value
    }

    const configJson = await window.electronAPI.getConfig()
    console.info(configJson)
    if (configJson.network.obsWebSocket) {
        setValue('#obsip', configJson.network.obsWebSocket.ip)
        setValue('#obsport', configJson.network.obsWebSocket.port)
        setValue('#obspassword', configJson.network.obsWebSocket.password)
    }
})

document.querySelector('#connect-button').addEventListener('click', async (event) => {
    const connectButton = event.target

    if (connected) {
        const { result, error } = await window.electronAPI.disconnectOBS()
        if (error) {
            console.warn('Error occurred when connecting to OBS:', error)
        }

        connected = false
        connectButton.innerText = 'Connect'
        document.querySelectorAll('.network-config input').forEach((input) => input.removeAttribute('disabled'))
    } else {
        // TODO: Do basic check here
        let obsIP = document.querySelector('#obsip').value
        let obsPort = document.querySelector('#obsport').value
        let obsPassword = document.querySelector('#obspassword').value

        if (obsIP === '') {
            obsIP = document.querySelector('#obsip').placeholder
        }

        if (obsPort === '') {
            obsPort = document.querySelector('#obsport').placeholder
        }

        const { result, error } = await window.electronAPI.connectOBS(obsIP, obsPort, obsPassword)
        if (result) {
            if (obsPassword === '') {
                console.warn('No password for obs-websocket')
            }

            connected = true
            connectButton.innerText = 'Disconnect'
            document.querySelectorAll('.network-config input').forEach((input) => input.setAttribute('disabled', ''))
        } else {
            console.error('Error occurred when connecting to OBS:', error)
        }
    }

    // if (connected) {
    //     connected = false
    //     connectButton.innerText = 'Connect'
    //     document.querySelectorAll('.network-config input').forEach((input) => input.removeAttribute('disabled'))
    // } else {
    //     connected = true
    //     connectButton.innerText = 'Disconnect'
    //     document.querySelectorAll('.network-config input').forEach((input) => input.setAttribute('disabled', ''))
    // }
})
