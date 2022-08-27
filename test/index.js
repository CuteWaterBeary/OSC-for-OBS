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
const _sceneCollection = require('../src/obsosc/sceneCollection')
const _sceneItem = require('../src/obsosc/sceneItem')
const _source = require('../src/obsosc/source')
const _streaming = require('../src/obsosc/streaming')

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
            it('should able to start/stop an output (+100 ms waiting for status change)', async function () {
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
                output.data.should.be.a('string', 'Wrong OSC output format').that.equal(currentProfileName)
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

    describe('Scene Collection', function () {
        describe('getSceneCollectionList', function () {
            it('should get a list of scene collection names', async function () {
                const sceneCollections = await _sceneCollection.getSceneCollectionList(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/sceneCollection', 'Wrong OSC address')
                output.data.should.be.an('Array', 'Wrong OSC output format').that.deep.equal(sceneCollections, 'Wrong OSC output data')
                sceneCollections.should.be.include('Test', 'Wrong scene collection name (should be named Test)')
            })
        })

        describe('getCurrentSceneCollection', function () {
            it('should get current scene collection', async function () {
                const currentSceneCollectionName = await _sceneCollection.getCurrentSceneCollection(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/sceneCollection/current', 'Wrong OSC address')
                output.data.should.be.equal('Test', 'Wrong OSC output data')
                currentSceneCollectionName.should.be.equal(output.data)
            })
        })

        describe('setCurrentSceneCollection', function () {
            it('should be able to set current scene collection', async function () {
                await _sceneCollection.setCurrentSceneCollection(networks, 'Test')
            })
        })

        describe('sendCurrentSceneCollectionFeedback', function () {
            it('should send current scene collection name through OSC', async function () {
                const sceneCollectionName = 'Test Scene Collection'
                await _sceneCollection.sendCurrentSceneCollectionFeedback(networks, sceneCollectionName)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/sceneCollection/current', 'Wrong OSC address')
                output.data.should.be.equal(sceneCollectionName, 'Wrong OSC output data')
            })
        })
    })

    describe('Scene Item', function () {
        describe('getSceneItemList', function () {
            it('should get a list of scene item names (that are not in a group)', async function () {
                const expectedSceneItems = [
                    'Scene Label 2',
                    '`!@#$%^&*()_+[]{}',
                    'テスト　テキスト',
                    '測試文字'
                ]
                const expectedKeys = [
                    'inputKind',
                    'isGroup',
                    'sceneItemBlendMode',
                    'sceneItemEnabled',
                    'sceneItemId',
                    'sceneItemIndex',
                    'sceneItemLocked',
                    'sceneItemTransform',
                    'sourceName',
                    'sourceType'
                ]

                const sceneItems = await _sceneItem.getSceneItemList(networks, 'Test Scene 2')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/sceneItem', 'Wrong OSC address')
                output.data.should.be.deep.equal(expectedSceneItems, 'Wrong OSC output data')
                sceneItems.should.be.an('Array')
                sceneItems[0].should.be.an('object').that.has.all.keys(expectedKeys)
            })

            it('should get a list of current scene item names (that are not in a group)', async function () {
                const expectedSceneItems = [
                    'Scene Label 1',
                    'Readme'
                ]
                const expectedKeys = [
                    'inputKind',
                    'isGroup',
                    'sceneItemBlendMode',
                    'sceneItemEnabled',
                    'sceneItemId',
                    'sceneItemIndex',
                    'sceneItemLocked',
                    'sceneItemTransform',
                    'sourceName',
                    'sourceType'
                ]

                const sceneItems = await _sceneItem.getSceneItemList(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/sceneItem', 'Wrong OSC address')
                output.data.should.be.deep.equal(expectedSceneItems, 'Wrong OSC output data')
                sceneItems.should.be.an('Array')
                sceneItems[0].should.be.an('object').that.has.all.keys(expectedKeys)
            })
        })

        describe('getSceneAndSceneItemId', function () {
            it('should get id of a scene item in specified scene', async function () {
                const { sceneName, sceneItemId } = await _sceneItem.getSceneAndSceneItemId(networks, 'Test Scene 2/`!@#$%^&*()_+[]{}'.split('/'))
                sceneName.should.be.equal('Test Scene 2')
                sceneItemId.should.be.equal(10)
            })

            it('should get id of a scene item in current scene', async function () {
                const { sceneName, sceneItemId } = await _sceneItem.getSceneAndSceneItemId(networks, 'Readme'.split('/'))
                sceneName.should.be.equal('Test Scene 1')
                sceneItemId.should.be.equal(3)
            })
        })

        describe('getSceneItemTransform', function () {
            it('should get transform info of a scene item in specified scene', async function () {
                const path = 'Test Scene 3/Browser'
                const expectedKeys = [
                    'alignment',
                    'boundsAlignment',
                    'boundsHeight',
                    'boundsType',
                    'boundsWidth',
                    'cropBottom',
                    'cropLeft',
                    'cropRight',
                    'cropTop',
                    'height',
                    'positionX',
                    'positionY',
                    'rotation',
                    'scaleX',
                    'scaleY',
                    'sourceHeight',
                    'sourceWidth',
                    'width'
                ]

                const sceneItemTransform = await _sceneItem.getSceneItemTransform(networks, path.split('/'))
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal(`/sceneItem/${path}/transform`, 'Wrong OSC address')
                output.data.should.be.an('Array', 'Wrong OSC output format').that.deep.equal(Object.keys(sceneItemTransform), 'Wrong OSC output data')
                sceneItemTransform.should.be.an('object').that.has.all.keys(expectedKeys)
            })

            it('should get transform info of a scene item in current scene', async function () {
                const path = 'Readme'
                const expectedKeys = [
                    'alignment',
                    'boundsAlignment',
                    'boundsHeight',
                    'boundsType',
                    'boundsWidth',
                    'cropBottom',
                    'cropLeft',
                    'cropRight',
                    'cropTop',
                    'height',
                    'positionX',
                    'positionY',
                    'rotation',
                    'scaleX',
                    'scaleY',
                    'sourceHeight',
                    'sourceWidth',
                    'width'
                ]

                const sceneItemTransform = await _sceneItem.getSceneItemTransform(networks, path.split('/'))
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal(`/sceneItem/${path}/transform`, 'Wrong OSC address')
                output.data.should.be.an('Array', 'Wrong OSC output format').that.deep.equal(Object.keys(sceneItemTransform), 'Wrong OSC output data')
                sceneItemTransform.should.be.an('object').that.has.all.keys(expectedKeys)
            })
        })

        describe('setSceneItemTransform', function () {
            it('should be able to set transform info of a scene item in specified scene', async function () {
                const path = 'Test Scene 3/Browser'
                await _sceneItem.setSceneItemTransform(networks, path.split('/'), 'cropTop', 100)
                let sceneItemTransform = await _sceneItem.getSceneItemTransform(networks, path.split('/'))
                sceneItemTransform.cropTop.should.be.equal(100)
                await _sceneItem.setSceneItemTransform(networks, path.split('/'), 'cropTop', 0)
                sceneItemTransform = await _sceneItem.getSceneItemTransform(networks, path.split('/'))
                sceneItemTransform.cropTop.should.be.equal(0)
            })

            it('should be able to set transform info of a scene item in current scene', async function () {
                const path = 'Readme'
                await _sceneItem.setSceneItemTransform(networks, path.split('/'), 'cropTop', 100)
                let sceneItemTransform = await _sceneItem.getSceneItemTransform(networks, path.split('/'))
                sceneItemTransform.cropTop.should.be.equal(100)
                await _sceneItem.setSceneItemTransform(networks, path.split('/'), 'cropTop', 0)
                sceneItemTransform = await _sceneItem.getSceneItemTransform(networks, path.split('/'))
                sceneItemTransform.cropTop.should.be.equal(0)
            })
        })

        describe('getSceneItemTransformValue', function () {
            it('should get transform value of a scene item in specified scene', async function () {
                const path = 'Test Scene 3/Browser'
                const transfromValue = await _sceneItem.getSceneItemTransformValue(networks, path.split('/'), 'positionY')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal(`/sceneItem/${path}/transform/positionY`, 'Wrong OSC address')
                output.data.should.be.equal(480, 'Wrong OSC output data')
                transfromValue.should.be.equal(output.data)
            })

            it('should get transform value of a scene item in current scene', async function () {
                const path = 'Readme'
                const transfromValue = await _sceneItem.getSceneItemTransformValue(networks, path.split('/'), 'sourceHeight')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal(`/sceneItem/${path}/transform/sourceHeight`, 'Wrong OSC address')
                output.data.should.be.equal(824, 'Wrong OSC output data')
                transfromValue.should.be.equal(output.data)
            })
        })

        describe('getSceneItemEnabled', function () {
            it('should get enable state of a scene item in specified scene', async function () {
                const path = 'Test Scene 2/`!@#$%^&*()_+[]{}'
                const sceneItemEnabled = await _sceneItem.getSceneItemEnabled(networks, path.split('/'))
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal(`/sceneItem/${path}/enable`, 'Wrong OSC address')
                output.data.should.be.equal(0, 'Wrong OSC output data')
                sceneItemEnabled.should.be.false
            })

            it('should get enable state of a scene item in current scene', async function () {
                const path = 'Scene Label 1'
                const sceneItemEnabled = await _sceneItem.getSceneItemEnabled(networks, path.split('/'))
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal(`/sceneItem/${path}/enable`, 'Wrong OSC address')
                output.data.should.be.equal(1, 'Wrong OSC output data')
                sceneItemEnabled.should.be.true
            })
        })

        describe('setSceneItemEnabled', function () {
            it('should able to set enable state of a scene item in specified scene', async function () {
                const path = 'Test Scene 3/Audio Input Capture'
                await _sceneItem.setSceneItemEnabled(networks, path.split('/'), 0)
                let sceneItemEnabled = await _sceneItem.getSceneItemEnabled(networks, path.split('/'))
                sceneItemEnabled.should.be.false
                await _sceneItem.setSceneItemEnabled(networks, path.split('/'), 1)
                sceneItemEnabled = await _sceneItem.getSceneItemEnabled(networks, path.split('/'))
                sceneItemEnabled.should.be.true
            })

            it('should able to set enable state of a scene item in specified scene', async function () {
                const path = 'Scene Label 1'
                await _sceneItem.setSceneItemEnabled(networks, path.split('/'), 0)
                let sceneItemEnabled = await _sceneItem.getSceneItemEnabled(networks, path.split('/'))
                sceneItemEnabled.should.be.false
                await _sceneItem.setSceneItemEnabled(networks, path.split('/'), 1)
                sceneItemEnabled = await _sceneItem.getSceneItemEnabled(networks, path.split('/'))
                sceneItemEnabled.should.be.true
            })
        })

        describe('sendSceneItemFeedback', function () {
            it('should send a list of scene item names through OSC', async function () {
                const expectedSceneItems = [
                    'Scene Label 3',
                    'Audio Input Capture',
                    'Color Source',
                    'Browser'
                ]

                await _sceneItem.sendSceneItemFeedback(networks, 'Test Scene 3')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal(`/sceneItem`, 'Wrong OSC address')
                output.data.should.be.deep.equal(expectedSceneItems, 'Wrong OSC output data')
            })
        })
    })

    describe('Source', function () {
        describe('getSourceList', function () {
            it('should get a list of source names', async function () {
                const sourceList = await _source.getSourceList(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/source', 'Wrong OSC address')
                output.data.should.be.an('Array', 'Wrong OSC output format').that.include.members(['Test Scene 2', 'Color Source', 'Audio Input Capture'])
                sourceList.should.be.an('Array').that.deep.equal(output.data)
            })
        })

        describe('getSourceActive', function () {
            it('should get the active state of a source', async function () {
                let videoActive = await _source.getSourceActive(networks, '`!@#$%^&*()_+[]{}')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/source/`!@#$%^&*()_+[]{}', 'Wrong OSC address')
                output.data.should.be.equal(0, 'Wrong OSC output data')
                videoActive.should.be.false
                videoActive = await _source.getSourceActive(networks, 'テスト　テキスト')
                videoActive.should.be.false
                videoActive = await _source.getSourceActive(networks, 'Readme')
                videoActive.should.be.true
            })
        })

        describe('getSourceFilterList', function () {
            it('should get a list of applied filters for a source', async function () {
                const expectedKeys = [
                    'filterEnabled',
                    'filterIndex',
                    'filterKind',
                    'filterName',
                    'filterSettings'
                ]
                const filters = await _source.getSourceFilterList(networks, 'Browser')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/source/Browser/filters', 'Wrong OSC address')
                output.data.should.be.an('Array', 'Wrong OSC output format').that.deep.equal(['Limiter', 'Color Correction'], 'Wrong OSC output data')
                filters.flatMap(filter => filter.filterName).should.deep.equal(output.data)
                filters[0].should.be.an('object').that.has.keys(expectedKeys)
            })
        })

        describe('getSourceFilterSettings', function () {
            it('should get a list of settings for a filter of a source', async function () {
                const expectedKeys = [
                    'brightness',
                    'color_add',
                    'color_multiply',
                    'contrast',
                    'gamma',
                    'hue_shift',
                    'opacity',
                    'saturation'
                ]
                const filterSettings = await _source.getSourceFilterSettings(networks, 'Browser', 'Color Correction')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/source/Browser/filters/Color Correction/settings', 'Wrong OSC address')
                output.data.should.be.an('Array', 'Wrong OSC output format').that.deep.equal(expectedKeys, 'Wrong OSC output data')
                filterSettings.should.be.an('object').that.has.keys(expectedKeys)
                filterSettings.saturation.should.be.equal(2.57)
                filterSettings.hue_shift.should.be.equal(-160.36)
            })
        })

        describe('setSourceFilterSettings', function () {
            it('should able to set settings for a filter of a source', async function () {
                const settings = { release_time: 75 }
                await _source.setSourceFilterSettings(networks, 'Browser', 'Limiter', settings)
                let filterSettings = await _source.getSourceFilterSettings(networks, 'Browser', 'Limiter')
                filterSettings.release_time.should.be.equal(75)
                filterSettings.threshold.should.be.equal(-6)

                settings.threshold = -8
                await _source.setSourceFilterSettings(networks, 'Browser', 'Limiter', settings)
                filterSettings = await _source.getSourceFilterSettings(networks, 'Browser', 'Limiter')
                filterSettings.release_time.should.be.equal(75)
                filterSettings.threshold.should.be.equal(-8)

                settings.release_time = 60
                settings.threshold = -6
                await _source.setSourceFilterSettings(networks, 'Browser', 'Limiter', settings)
                filterSettings = await _source.getSourceFilterSettings(networks, 'Browser', 'Limiter')
                filterSettings.release_time.should.be.equal(60)
                filterSettings.threshold.should.be.equal(-6)
            })
        })

        describe('getSourceFilterDefaultSettings (WIP)', function () {
            it.skip('should get default settings for a filter', async function () {
                // const sourceList = await _source.getSourceFilterDefaultSettings(networks)
                // networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                // const output = networks.oscOut.outputs[0]
                // output.address.should.be.equal('/source', 'Wrong OSC address')
                // output.data.should.be.an('Array', 'Wrong OSC output format').that.include.members(['Test Scene 2', 'Color Source', 'Audio Input Capture'])
                // sourceList.should.be.an('Array').that.deep.equal(output.data)
            })
        })

        describe('getSourceFilterSetting', function () {
            it('should get the value of a setting for a filter of a source', async function () {
                const settingPath = 'saturation'
                const settingValue = await _source.getSourceFilterSetting(networks, 'Browser', 'Color Correction', settingPath.split('/'))
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal(`/source/Browser/filters/Color Correction/settings/${settingPath}`, 'Wrong OSC address')
                output.data.should.be.equal(2.57, 'Wrong OSC output data')
                settingValue.should.be.equal(output.data)
            })
        })

        describe('setSourceFilterSetting', function () {
            it('able to set a setting for a filter of a source', async function () {
                const settingPath = 'saturation'
                await _source.setSourceFilterSetting(networks, 'Browser', 'Color Correction', settingPath.split('/'), -1)
                let settingValue = await _source.getSourceFilterSetting(networks, 'Browser', 'Color Correction', settingPath.split('/'))
                settingValue.should.be.equal(-1)
                await _source.setSourceFilterSetting(networks, 'Browser', 'Color Correction', settingPath.split('/'), 2.57)
                settingValue = await _source.getSourceFilterSetting(networks, 'Browser', 'Color Correction', settingPath.split('/'))
                settingValue.should.be.equal(2.57)
            })
        })

        describe('getSourceFilter', function () {
            it('should get properties and enable state for a filter of a source', async function () {
                const expectedKeys = [
                    'filterEnabled',
                    'filterIndex',
                    'filterKind',
                    'filterSettings'
                ]

                let response = await _source.getSourceFilter(networks, '測試文字', 'Scaling and Aspect Ratio')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                let output = networks.oscOut.outputs[0]
                output.address.should.be.equal('source/測試文字/filters/Scaling and Aspect Ratio', 'Wrong OSC address')
                output.data.should.be.equal(0, 'Wrong OSC output data')
                response.should.be.an('object').that.has.keys(expectedKeys)

                response = await _source.getSourceFilter(networks, '測試文字', 'Chroma Key')
                output = networks.oscOut.outputs[1]
                output.address.should.be.equal('source/測試文字/filters/Chroma Key', 'Wrong OSC address')
                output.data.should.be.equal(1, 'Wrong OSC output data')
            })
        })

        describe('getSourceFilterEnabled', function () {
            it('should get enable state for a filter of a source', async function () {
                let filterEnabled = await _source.getSourceFilterEnabled(networks, '測試文字', 'Scaling and Aspect Ratio')

                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                let output = networks.oscOut.outputs[0]
                output.address.should.be.equal('source/測試文字/filters/Scaling and Aspect Ratio', 'Wrong OSC address')
                output.data.should.be.equal(0, 'Wrong OSC output data')
                filterEnabled.should.be.false

                filterEnabled = await _source.getSourceFilterEnabled(networks, '測試文字', 'Chroma Key')
                output = networks.oscOut.outputs[1]
                output.address.should.be.equal('source/測試文字/filters/Chroma Key', 'Wrong OSC address')
                output.data.should.be.equal(1, 'Wrong OSC output data')
                filterEnabled.should.be.true
            })
        })

        describe('setSourceFilterEnabled', function () {
            it('should be able to set enable state for a filter of a source', async function () {
                await _source.setSourceFilterEnabled(networks, 'Browser', 'Color Correction', 0)
                let filterEnabled = await _source.getSourceFilterEnabled(networks, 'Browser', 'Color Correction')
                filterEnabled.should.be.false

                await _source.setSourceFilterEnabled(networks, 'Browser', 'Color Correction', 1)
                filterEnabled = await _source.getSourceFilterEnabled(networks, 'Browser', 'Color Correction')
                filterEnabled.should.be.true
            })
        })
    })

    describe('Streaming', function () {
        describe('getStreamStatus', function () {
            it('should get current status of an output', async function () {
                const outputActive = await _streaming.getStreamStatus(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/streaming', 'Wrong OSC address')
                output.data.should.be.a('number', 'Wrong OSC output type').and.oneOf([0, 1], 'Wrong OSC output data')
                outputActive.should.be.a('boolean')
            })
        })

        describe('startOutput', function () {
            it.skip('should able to start streaming (do not test this)', async function () {
                this.timeout(5000)
                await _streaming.startStream(networks)
                await delay(1000)
                const outputActive = await _streaming.getStreamStatus(networks)
                outputActive.should.be.true
            })
        })
        
        describe('stopOutput', function () {
            it.skip('should able to stop streaming (do not test this)', async function () {
                this.timeout(5000)
                await _streaming.stopStream(networks)
                await delay(1000)
                const outputActive = await _streaming.getStreamStatus(networks)
                outputActive.should.be.false
            })
        })
        
        describe('toggleOutput', function () {
            it.skip('should able to start/stop streaming (do not test this)', async function () {
                this.timeout(5000)
                await _streaming.toggleStream(networks)
                await delay(1000)
                let outputActive = await _streaming.getStreamStatus(networks)
                outputActive.should.be.true
                await _streaming.toggleStream(networks)
                await delay(1000)
                outputActive = await _streaming.getStreamStatus(networks)
                outputActive.should.be.false
            })
        })

        describe('sendStreamingStateFeedback', function () {
            it('should send current streaming state through OSC', async function() {
                await _streaming.sendStreamingStateFeedback(networks, 1)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/streaming', 'Wrong OSC address')
                output.data.should.be.equal(1, 'Wrong OSC output data')
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
