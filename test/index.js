// const assert = require('assert')
const should = require('chai').should()

const { open } = require('fs/promises')
const OBSWebSocket = require('obs-websocket-js').default

const _audio = require('../src/obsosc/audio')
const _input = require('../src/obsosc/input')
const _output = require('../src/obsosc/output')
const _profile = require('../src/obsosc/profile')
const _recording = require('../src/obsosc/recording')

const _scene = require('../src/obsosc/scene')
const { parseSettingsPath, mergeSettings } = require('../src/obsosc/utils')

const delay = function (time) {
    return new Promise(resolve => {
        setTimeout(resolve, time);
    })
}
const testConfigPath = './test/config.json'
const configText = `You need to have a config.json in test folder with following structure:
        {
            "ip": "your obs-websocket's ip (normally localhost or 127.0.0.1)"
            "port": "your obs-websocket's port (normally 4455)"
            "password": "your obs-websocket's password"
        }`

const obs = new OBSWebSocket()
const oscOut = {
    outputs: [],
    send: function (address, ...data) {
        // Note: Unwrap single-data output just for convenience
        if (data.length < 2) {
            data = data[0]
        }
        this.outputs.push({ address, data })
    },
    reset: function () {
        this.outputs = []
    }
}

const miscConfig = {
    enableVolumeDbOutput: true
}

const networks = {
    obs, oscOut, miscConfig, reset: function () {
        this.oscOut.reset()
    }
}

async function loadJSON(jsonPath) {
    let fileHandle
    let jsonString
    try {
        fileHandle = await open(jsonPath, 'r')
        jsonString = await fileHandle.readFile('utf-8')
        try {
            jsonData = JSON.parse(jsonString)
            if (typeof (jsonData) !== 'object') {
                throw 'Invalid JSON'
            }
            return jsonData
        } catch (e) {
            throw 'Failed to parse JSON'
        }
    } catch (e) {
        throw 'Error occurred when reading JSON:' + e.message
    } finally {
        await fileHandle?.close()
    }
}

describe('Config check', function () {
    it(configText, async function () {
        const configJson = await loadJSON(testConfigPath)
        should.exist(configJson.ip, 'IP not exit')
        should.exist(configJson.port, 'Port not exist')
        should.exist(configJson.password, 'Password not exits')
        configJson.ip.should.be.a('string', 'IP should be a string')
        configJson.port.should.be.a('string', 'Port should be a string')
        configJson.password.should.be.a('string', 'Password should be a string')
    })
})

describe('OBSOSC modules', function () {
    before(async function () {
        const configJson = await loadJSON(testConfigPath)
        try {
            const address = 'ws://' + configJson.ip + ':' + configJson.port
            await obs.connect(address, configJson.password, { rpcVersion: 1 })
        } catch (e) {
            throw e
        }
    })

    beforeEach('Reset networks', function () {
        networks.reset()
    })

    describe('Audio', function () {
        describe('getAudioInputList', function () {
            it('should get a list of input name', async function () {
                const audioInputList = await _audio.getAudioInputList(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/audio', 'Wrong OSC address')
                output.data.should.be.an('Array', 'Wrong OSC output format')
                output.data[0].should.be.a('string', 'Wrong OSC output type')
                audioInputList.should.be.an('Array')
                audioInputList[0].should.be.an('object').that.has.all.keys(['inputKind', 'inputName', 'unversionedInputKind'])
            })
        })

        describe('updateAudioInputKindList', function () {
            it('should updata audio input kind list (would not check)', async function () {
                await _audio.updateAudioInputKindList(networks)
            })
        })

        describe('getInputVolume', function () {
            it('should get volume of an input in mul', async function () {
                const { inputVolumeMul } = await _audio.getInputVolume(networks, 'Audio Input Capture')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/audio/Audio Input Capture/volume', 'Wrong OSC address')
                output.data.should.be.a('number', 'Wrong OSC output type')
                output.data.should.be.within(0, 1)
                output.data.should.be.equal(inputVolumeMul)
            })

            it('should get volume of an input in dB', async function () {
                const { inputVolumeDb } = await _audio.getInputVolume(networks, 'Audio Input Capture', true)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/audio/Audio Input Capture/volumeDb', 'Wrong OSC address')
                output.data.should.be.a('number', 'Wrong OSC output type')
                output.data.should.be.within(-100, 0)
                output.data.should.be.equal(inputVolumeDb)
            })
        })

        describe('setInputVolume', function () {
            it('should able to set input volume in mul', async function () {
                await _audio.setInputVolume(networks, 'Audio Input Capture', 0)
                const { inputVolumeMul, inputVolumeDb } = await _audio.getInputVolume(networks, 'Audio Input Capture')
                inputVolumeMul.should.be.equal(0)
                inputVolumeDb.should.be.equal(-100)
            })

            it('should able to set input volume in dB', async function () {
                await _audio.setInputVolume(networks, 'Audio Input Capture', 0, true)
                const { inputVolumeMul, inputVolumeDb } = await _audio.getInputVolume(networks, 'Audio Input Capture')
                inputVolumeMul.should.be.equal(1)
                inputVolumeDb.should.be.equal(0)
            })
        })

        describe('getInputMute', function () {
            it('should get mute state of a inupt', async function () {
                const mute = await _audio.getInputMute(networks, 'Audio Input Capture')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/audio/Audio Input Capture/mute', 'Wrong OSC address')
                output.data.should.be.a('number', 'Wrong OSC output type').and.oneOf([0, 1], 'Wrong OSC output data')
                mute.should.be.a('boolean')
            })
        })

        describe('setInputMute', function () {
            it('should be able to mute an input', async function () {
                await _audio.setInputMute(networks, 'Audio Input Capture', 1)
                const mute = await _audio.getInputMute(networks, 'Audio Input Capture')
                mute.should.be.true
            })

            it('should be able to unmute an input', async function () {
                await _audio.setInputMute(networks, 'Audio Input Capture', 0)
                const mute = await _audio.getInputMute(networks, 'Audio Input Capture')
                mute.should.be.false
            })
        })

        describe('getSpecialInputs', function () {
            it('should get special inputs', async () => {
                const specialInputList = await _audio.getSpecialInputs(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/specialAudio', 'Wrong OSC address')
                output.data.should.be.an('Array', 'Wrong OSC output format')
                specialInputList.should.be.an('Array')
            })
        })

        describe('getSceneAudioInputList', function () {
            it('should get all audio inputs in a scene', async () => {
                const sceneAudioInputs = await _audio.getSceneAudioInputList(networks, 'Test Scene 3')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/sceneAudio', 'Wrong OSC address')
                output.data.should.be.an('Array', 'Wrong OSC output format')
                output.data[0].should.be.a('string', 'Wrong OSC output type')
                sceneAudioInputs.should.be.an('Array')
            })

            it('should get all audio inputs in current scene', async () => {
                const currentSceneAudioInputs = await _audio.getSceneAudioInputList(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/sceneAudio', 'Wrong OSC address')
                output.data.should.be.an('Array', 'Wrong OSC output format')
                currentSceneAudioInputs.should.be.an('Array')

                const sceneAudioInputs = await _audio.getSceneAudioInputList(networks, 'Test Scene 3')
                sceneAudioInputs.should.be.an('Array')
                currentSceneAudioInputs.should.have.lengthOf(sceneAudioInputs.length - 2) // Excluding Audio Input Capture and Browser
            })
        })

        describe('sendSceneAudioInputFeedback', function () {
            it('should send scene audio input list through OSC', async function () {
                await _audio.sendSceneAudioInputFeedback(networks, 'Test Scene 3')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/sceneAudio', 'Wrong OSC address')
                output.data.should.be.an('Array', 'Wrong OSC output format')
                output.data[0].should.be.a('string', 'Wrong OSC output type')
            })
        })

        describe('sendAudioInputVolumeFeedback', function () {
            it('should send an input\'s volume in mul through OSC', async function () {
                networks.miscConfig.enableVolumeDbOutput = false
                await _audio.sendAudioInputVolumeFeedback(networks, 'Audio Input Capture', 0, -100)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/audio/Audio Input Capture/volume', 'Wrong OSC address')
                output.data.should.be.equal(0, 'Wrong OSC output data')
            })

            it('should send an input\'s volume in both mul and dB through OSC', async function () {
                networks.miscConfig.enableVolumeDbOutput = true
                await _audio.sendAudioInputVolumeFeedback(networks, 'Audio Input Capture', 0, -100)
                networks.oscOut.outputs.should.have.lengthOf(2, `Too ${networks.oscOut.outputs.length < 2 ? 'little' : 'many'} OSC output`)

                networks.oscOut.outputs[0].address.should.be.equal('/audio/Audio Input Capture/volume', 'Wrong OSC address')
                networks.oscOut.outputs[0].data.should.be.equal(0, 'Wrong OSC output data')
                networks.oscOut.outputs[1].address.should.be.equal('/audio/Audio Input Capture/volumeDb', 'Wrong OSC address')
                networks.oscOut.outputs[1].data.should.be.equal(-100, 'Wrong OSC output data')
            })
        })

        describe('sendAudioMuteFeedback', function () {
            it('should send an input\'s mute state through OSC', async function () {
                await _audio.sendAudioMuteFeedback(networks, 'Audio Input Capture', true)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/audio/Audio Input Capture/mute', 'Wrong OSC address')
                output.data.should.be.equal(1, 'Wrong OSC output data')
            })
        })
    })

    describe('Input', function () {
        describe('getInputList', function () {
            it('should get a list of inputs', async function () {
                const inputs = await _input.getInputList(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/input', 'Wrong OSC address')
                output.data.should.be.an('Array', 'Wrong OSC output format')
                output.data[0].should.be.a('string', 'Wrong OSC output type')
                inputs.should.be.an('Array')
                inputs[0].should.be.an('object').that.has.all.keys(['inputKind', 'inputName', 'unversionedInputKind'])
            })
        })

        describe('getInputKind', function () {
            it('should get a list of input kinds', async function () {
                const inputKind = await _input.getInputKind(networks, 'Color Source')
                inputKind.should.be.a('string')
                inputKind.should.be.equal('color_source_v3')
            })
        })

        describe('getInputSettings', function () {
            it('should get the current settings of an input and send setting paths through OSC', async function () {
                const inputSettings = await _input.getInputSettings(networks, 'Scene Label 1')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/input/Scene Label 1/settings', 'Wrong OSC address')
                output.data.should.be.an('Array').that.include.members(['bk_color', 'bk_opacity', 'font/size', 'text'], 'Wrong OSC output data')
                inputSettings.should.be.an('object').that.include.all.keys(['bk_color', 'bk_opacity', 'font', 'text'])
                inputSettings.should.have.nested.property('font.size', 96)
            })
        })

        describe('setInputSettings', function () {
            it('should be able to set the current settings of an input', async function () {
                let inputSettings = { font: { size: 128 } }
                await _input.setInputSettings(networks, 'Scene Label 1', inputSettings)
                let currentInputSettings = await _input.getInputSettings(networks, 'Scene Label 1')
                currentInputSettings.font.size.should.be.equal(128)
                inputSettings.font.size = 96
                await _input.setInputSettings(networks, 'Scene Label 1', inputSettings)
                currentInputSettings = await _input.getInputSettings(networks, 'Scene Label 1')
                currentInputSettings.font.size.should.be.equal(96)
            })
        })


        describe('getInputSetting', function () {
            it('should get value of an input\'s setting', async function () {
                await _input.getInputSetting(networks, 'Scene Label 1', 'font/size'.split('/'))
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/input/Scene Label 1/settings/font/size', 'Wrong OSC address')
                output.data.should.be.equal(96, 'Wrong OSC output data')
            })
        })

        describe('setInputSetting', function () {
            it('should be able to set value of an input\'s setting', async function () {
                await _input.setInputSetting(networks, 'Color Source', 'height'.split('/'), 512)
                let currentInputSettings = await _input.getInputSettings(networks, 'Color Source', false)
                currentInputSettings.width.should.be.equal(256)
                currentInputSettings.height.should.be.equal(512)
                currentInputSettings.color.should.be.equal(4279676924)
                await _input.setInputSetting(networks, 'Color Source', 'height'.split('/'), 256)
                currentInputSettings = await _input.getInputSettings(networks, 'Color Source', false)
                currentInputSettings.width.should.be.equal(256)
                currentInputSettings.height.should.be.equal(256)
                currentInputSettings.color.should.be.equal(4279676924)
            })
        })

        describe('getInputDefaultSettings', function () {
            it('should get default settings of an input', async function () {
                const defaultInputSettings = await _input.getInputDefaultSettings(networks, 'Color Source')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/input/Color Source/default', 'Wrong OSC address')
                output.data.should.be.an('Array').that.include.members(['color', 'height', 'width'])
                defaultInputSettings.should.be.an('object').that.has.all.keys(['color', 'height', 'width'])
            })
        })

        describe('getInputDefaultSetting', function () {
            it('should get default value of an input\'s setting', async function () {
                await _input.getInputDefaultSetting(networks, 'Scene Label 1', 'valign'.split('/'))
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/input/Scene Label 1/default/valign', 'Wrong OSC address')
                output.data.should.be.equal('top', 'Wrong OSC output data')
            })
        })

        describe('getInputPropertiesListPropertyItems', function () {
            it('should get a list of available property value of an input', async function () {
                const propertyItems = await _input.getInputPropertiesListPropertyItems(networks, 'Scene Label 1', 'transform')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('input/Scene Label 1/settings/transform/propertyItems', 'Wrong OSC address')
                output.data.should.be.an('Array').that.has.members([0, 1, 2, 3])
                propertyItems.should.be.lengthOf(4)
                propertyItems[0].should.have.all.keys(['itemEnabled', 'itemName', 'itemValue'])
            })
        })

        describe('pressInputPropertiesButton', function () {
            it('should be able to press property button of an input', async function () {
                await _input.pressInputPropertiesButton(networks, 'Browser', 'refreshnocache')
            })
        })

    })

    describe('Output', function () {
        describe('getOutputList', function () {
            it('should get a list of outputs', async function () {
                const outputs = await _output.getOutputList(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/output', 'Wrong OSC address')
                output.data.should.be.an('Array', 'Wrong OSC output format')
                output.data[0].should.be.a('string', 'Wrong OSC output type')
                outputs.should.be.an('Array')
                outputs[0].should.be.an('object').that.has.all.keys(['outputActive', 'outputFlags', 'outputHeight', 'outputKind', 'outputName', 'outputWidth'])
            })
        })

        describe('getOutputStatus', function () {
            it('should get current status of an output', async function () {
                const outputActive = await _output.getOutputStatus(networks, 'simple_file_output')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/output/simple_file_output', 'Wrong OSC address')
                output.data.should.be.a('number', 'Wrong OSC output type').and.oneOf([0, 1], 'Wrong OSC output data')
                outputActive.should.be.a('boolean')
            })
        })

        describe('startOutput', function () {
            it('should able to start an output', async function () {
                await _output.startOutput(networks, 'virtualcam_output')
            })
        })

        describe('stopOutput', function () {
            it('should able to stop an output', async function () {
                await _output.stopOutput(networks, 'virtualcam_output')
            })
        })

        describe('toggleOutput', function () {
            it('should able to start/stop an output (+100 ms delay for status change)', async function () {
                await _output.toggleOutput(networks, 'virtualcam_output')
                let outputActive = await _output.getOutputStatus(networks, 'virtualcam_output')
                outputActive.should.be.true
                await _output.toggleOutput(networks, 'virtualcam_output')
                await delay(100)
                outputActive = await _output.getOutputStatus(networks, 'virtualcam_output')
                outputActive.should.be.false
            })
        })
    })

    describe('Profile', function () {
        describe('getOutputList', function () {
            it('should get a list of profile', async function () {
                const profiles = await _profile.getProfileList(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/profile', 'Wrong OSC address')
                output.data.should.be.an('Array', 'Wrong OSC output format')
                output.data[0].should.be.a('string', 'Wrong OSC output type')
                profiles.should.be.an('Array')
                profiles[0].should.be.a('string')
            })
        })
        
        describe('getCurrentProfile', function () {
            it('should get current profile', async function () {
                const currentProfileName = await _profile.getCurrentProfile(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/profile/current', 'Wrong OSC address')
                output.data.should.be.a('string', 'Wrong OSC output format').and.equal(currentProfileName)
            })
        })

        describe('setCurrentProfile', function () {
            it('should be able to set current profile', async function () {
                const currentProfileName = await _profile.getCurrentProfile(networks)
                await _profile.setCurrentProfile(networks, currentProfileName)
            })
        })

        describe('sendCurrentProfileFeedback', function () {
            it('should send current profile through OSC', async function () {
                const profileName = 'Test Profile'
                await _profile.sendCurrentProfileFeedback(networks, profileName)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/profile/current', 'Wrong OSC address')
                output.data.should.be.equal(profileName, 'Wrong OSC output data')
            })
        })
    })

    describe('Recording', function () {
        describe('getRecordStatus', function () {
            it('should get current status of recording', async function () {
                const { outputActive, outputPaused } = await _recording.getRecordStatus(networks)
                networks.oscOut.outputs.should.have.lengthOf(2, `Too ${networks.oscOut.outputs.length < 2 ? 'little' : 'many'} OSC output`)
                networks.oscOut.outputs[0].address.should.be.equal('/recording', 'Wrong OSC address')
                networks.oscOut.outputs[0].data.should.be.a('number', 'Wrong OSC output type').and.oneOf([0, 1], 'Wrong OSC output data')
                networks.oscOut.outputs[1].address.should.be.equal('/recording/pause', 'Wrong OSC address')
                networks.oscOut.outputs[1].data.should.be.a('number', 'Wrong OSC output type').and.oneOf([0, 1], 'Wrong OSC output data')
                outputActive.should.be.equal(networks.oscOut.outputs[0].data === 1)
                outputPaused.should.be.equal(networks.oscOut.outputs[1].data === 1)
            })
        })
        
        describe('startRecord', function () {
            it.skip('should able to start recording (do not test this)', async function () {
                await _recording.startRecord(networks)
            })
        })
        
        describe('stopRecord', function () {
            it.skip('should able to stop recording (do not test this)', async function () {
                await _recording.stopRecord(networks)
            })
        })
        
        describe('toggleRecord', function () {
            it.skip('should able to start/stop recording (do not test this)', async function () {
                await _recording.toggleRecord(networks)
            })
        })
        
        describe('pauseRecord', function () {
            it.skip('should able to pause recording (do not test this)', async function () {
                await _recording.pauseRecord(networks)
            })
        })
        
        describe('resumeRecord', function () {
            it.skip('should able to resume recording (do not test this)', async function () {
                await _recording.resumeRecord(networks)
            })
        })
        
        describe('toggleRecordPause', function () {
            it.skip('should able to pause/resume recording (do not test this)', async function () {
                await _recording.toggleRecordPause(networks)
            })
        })
        
        describe('sendRecordingStateFeedback', function () {
            it('should send start/stop state of recording through OSC', async function () {
                await _recording.sendRecordingStateFeedback(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/recording', 'Wrong OSC address')
                output.data.should.be.a('number', 'Wrong OSC output type').and.oneOf([0, 1], 'Wrong OSC output data')
            })
        })
        
        describe('sendRecordingPauseStateFeedback', function () {
            it('should send pause/resume state of recording through OSC', async function () {
                await _recording.sendRecordingPauseStateFeedback(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/recording/pause', 'Wrong OSC address')
                output.data.should.be.a('number', 'Wrong OSC output type').and.oneOf([0, 1], 'Wrong OSC output data')
            })
        })
        
    })

    describe('Scene', function () {
        describe('getSceneList', function () {
            it('should get a list of scene name', async function () {
                const sceneList = await _scene.getSceneList(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/scene', 'Wrong OSC address')
                // Note: Scenes and Scene Items are in reversed order of what obs-websocket provided
                output.data.should.be.deep.equal(['Test Scene 1', 'Test Scene 2', 'Test Scene 3'], 'Wrong OSC output data')
                sceneList.should.be.deep.equal(
                    [
                        { sceneIndex: 2, sceneName: 'Test Scene 1' },
                        { sceneIndex: 1, sceneName: 'Test Scene 2' },
                        { sceneIndex: 0, sceneName: 'Test Scene 3' },
                    ]
                )
            })
        })

        describe('getCurrentProgramScene', function () {
            it('should get the active scene name', async function () {
                const sceneList = await _scene.getCurrentProgramScene(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/activeScene', 'Wrong OSC address')
                output.data.should.be.deep.equal('Test Scene 1', 'Wrong OSC output data')
                sceneList.should.be.deep.equal('Test Scene 1')
            })
        })

        describe('setCurrentProgramScene', function () {
            it('should be able to set active scene by name', async function () {
                const sceneName = 'Test Scene 1'
                await _scene.setCurrentProgramScene(networks, sceneName)
            })

            it('should be able to set active scene by index', async function () {
                const sceneIndex = 0
                await _scene.setCurrentProgramScene(networks, sceneIndex)
            })
        })

        describe('sendActiveSceneFeedback', function () {
            it('should send active scene name through OSC', async function () {
                await _scene.sendActiveSceneFeedback(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/activeScene', 'Wrong OSC address')
                output.data.should.be.equal('Test Scene 1')
            })
        })

        describe('sendSceneCompletedFeedback', function () {
            it('should send completed active scene name through OSC', async function () {
                await _scene.sendSceneCompletedFeedback(networks, 'Test Scene 1')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/activeSceneCompleted', 'Wrong OSC address')
                output.data.should.be.equal('Test Scene 1')
            })
        })
    })

    after(async function () {
        try {
            await obs.disconnect()
        } catch (e) {
            throw e
        }
    })
})
