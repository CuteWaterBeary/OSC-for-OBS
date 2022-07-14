function setSwitch() {
    const switchFunctions = {
        notifyActiveScene: (state, event) => {
            const sceneFeedback = document.querySelector('#custom-scene-feedback')
            if (state === 1) {
                sceneFeedback.classList.remove('disabled')
                if (event.button !== -1) {
                    window.electronAPI.updateMiscConfig('notifyActiveScene', true)
                }
            } else {
                sceneFeedback.classList.add('disabled')
                if (event.button !== -1) {
                    window.electronAPI.updateMiscConfig('notifyActiveScene', false)
                }
            }
        },
        useCustomPath: (state, event) => {
            const prefixInput = document.querySelector('#useCustomPath-prefix')
            const suffixInput = document.querySelector('#useCustomPath-suffix')
            if (state) {
                prefixInput.setAttribute('disabled', '')
                suffixInput.setAttribute('disabled', '')
                if (event.button !== -1) {
                    const config = {
                        enabled: true,
                        prefix: (prefixInput.value !== '') ? prefixInput.value : prefixInput.placeholder,
                        suffix: suffixInput.value
                    }
                    window.electronAPI.updateMiscConfig('useCustomPath', config)
                }
            } else {
                prefixInput.removeAttribute('disabled', '')
                suffixInput.removeAttribute('disabled', '')
                if (event.button !== -1) {
                    const config = {
                        enabled: false,
                        prefix: (prefixInput.value !== '') ? prefixInput.value : prefixInput.placeholder,
                        suffix: suffixInput.value
                    }
                    window.electronAPI.updateMiscConfig('useCustomPath', config)
                }
            }
        },
        useDbForVolume: (state, event) => {
            if (state === 1) {
                if (event.button !== -1) {
                    window.electronAPI.updateMiscConfig('useDbForVolume', true)
                }
            } else {
                if (event.button !== -1) {
                    window.electronAPI.updateMiscConfig('useDbForVolume', false)
                }
            }
        }
    }

    document.querySelectorAll('.switch').forEach((iSwitch) => {
        iSwitch.addEventListener('click', (event) => {
            for (let p = event.target.parentElement, i = 0; i < 2; p = p.parentElement, i++) {
                if (p.classList.contains('disabled')) return
            }

            const action = event.target.getAttribute('switch-action')
            if (event.target.getAttribute('value') === '0') {
                event.target.setAttribute('value', '1')
                if (switchFunctions[action]) switchFunctions[action](1, event)
            } else {
                event.target.setAttribute('value', '0')
                if (switchFunctions[action]) switchFunctions[action](0, event)
            }
        })
    })
}

setSwitch()
