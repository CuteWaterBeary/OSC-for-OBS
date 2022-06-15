const setButton = document.querySelector('#title-button')
const titleText = document.querySelector('#title-text')
if (setButton && titleText) {
    setButton.addEventListener('click', () => { 
        const title = titleText.value
        window.electronAPI.setTitle(title)
    })
}

const fileButton = document.querySelector('#file-button')
const filePath = document.querySelector('#file-path')
if (fileButton && filePath) {
    fileButton.addEventListener('click', async () => {
        const path = await window.electronAPI.openFile()
        filePath.innerText = path
    })
}

const counter = document.querySelector('#counter')
if (counter) {
    window.electronAPI.handleCounter((event, value) => {
        const oldValue = Number(counter.innerText)
        const newValue = oldValue + value
        counter.innerText = newValue
        event.sender.send('counter-value', newValue)
    })
}
