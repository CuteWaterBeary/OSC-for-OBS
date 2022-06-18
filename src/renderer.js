let connected = false

document.querySelector('#connect-button').addEventListener('click', (event) => {
    const connectButton = event.target
    if (connected) {
        connected = false
        connectButton.innerText = 'Connect'
        document.querySelectorAll('.network-config input').forEach((input) => input.removeAttribute('disabled'))
    } else {
        connected = true
        connectButton.innerText = 'Disconnect'
        document.querySelectorAll('.network-config input').forEach((input) => input.setAttribute('disabled', ''))
    }
})
