function setSwitch() {
    const basicSwitch = (configName, state, event) => {
        if (state === 1) {
            if (event.button !== -1) {
                window.electronAPI.updateMiscConfig(configName, true)
            }
        } else {
            if (event.button !== -1) {
                window.electronAPI.updateMiscConfig(configName, false)
            }
        }
    }

    const switchFunctions = {
        notifyActiveScene: (state, event) => {
            basicSwitch('notifyActiveScene', state, event)
        },
        notifySceneInputs: (state, event) => {
            basicSwitch('notifySceneInputs', state, event)
        },
        notifySceneItems: (state, event) => {
            basicSwitch('notifySceneItems', state, event)
        },
        notifyVolumeChange: (state, event) => {
            basicSwitch('notifyVolumeChange', state, event)
        },
        notifyMuteState: (state, event) => {
            basicSwitch('notifyMuteState', state, event)
        },
        notifyVirtualCamState: (state, event) => {
            basicSwitch('notifyVirtualCamState', state, event)
        },
        notifyRecordingState: (state, event) => {
            basicSwitch('notifyRecordingState', state, event)
        },
        notifyStreamingState: (state, event) => {
            basicSwitch('notifyStreamingState', state, event)
        },
        notifyStudioModeState: (state, event) => {
            basicSwitch('notifyStudioModeState', state, event)
        },
        notifyStudioPreviewScene: (state, event) => {
            basicSwitch('notifyStudioPreviewScene', state, event)
        },
        notifyCurrentProfile: (state, event) => {
            basicSwitch('notifyCurrentProfile', state, event)
        },
        notifyCurrentSceneCollection: (state, event) => {
            basicSwitch('notifyCurrentSceneCollection', state, event)
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
        enableVolumeDbOutput: (state, event) => {
            basicSwitch('enableVolumeDbOutput', state, event)
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
