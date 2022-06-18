function setSwitch() {
    const switchFunctions = {
        testButton: (state) => {
            const sceneFeedback = document.querySelector('#scene-feedback')
            if (state === 1) {
                sceneFeedback.classList.remove('disabled')
            } else {
                sceneFeedback.classList.add('disabled')
            }
        },
        testButton2: (state) => {
            document.querySelectorAll('#scene-feedback-path input').forEach((input) => {
                if (state) {
                    input.setAttribute('disabled', '')
                } else {
                    input.removeAttribute('disabled')
                }
            })
        },
    }

    document.querySelectorAll('.switch').forEach((iSwitch) => {
        iSwitch.addEventListener('click', (event) => {
            for (let p = event.target.parentElement, i = 0; i < 2; p = p.parentElement, i++) {
                if (p.classList.contains('disabled')) return
            }

            const action = event.target.getAttribute('switch-action')
            if (event.target.getAttribute('value') === '0') {
                event.target.setAttribute('value', '1')
                if (switchFunctions[action]) switchFunctions[action](1, event.target)
            } else {
                event.target.setAttribute('value', '0')
                if (switchFunctions[action]) switchFunctions[action](0, event.target)
            }
        })
    })
}

setSwitch()

