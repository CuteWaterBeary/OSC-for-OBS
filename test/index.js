// const assert = require('assert')
const should = require('chai').should()

const { open } = require('fs/promises')
const OBSWebSocket = require('obs-websocket-js').default

const audio = require('../src/obsosc/audio')
const scene = require('../src/obsosc/scene')

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
                const audioInputList = await audio.getAudioInputList(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/audio', 'Wrong OSC address')
                output.data.should.be.a('Array', 'Wrong OSC output format')
                output.data[0].should.be.a('string', 'Wrong OSC output type')
                audioInputList.should.be.a('Array')
                audioInputList[0].should.be.an('object').that.has.all.keys(['inputKind', 'inputName', 'unversionedInputKind'])
            })
        })

        describe('updateAudioInputKindList', function () {
            it('should updata audio input kind list (would not check)', async function () {
                await audio.updateAudioInputKindList(networks)
            })
        })

        describe('getInputVolume', function () {
            it('should get volume of a input in mul', async function () {
                const { inputVolumeMul } = await audio.getInputVolume(networks, 'Audio Input Capture')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/audio/Audio Input Capture/volume', 'Wrong OSC address')
                output.data.should.be.a('number', 'Wrong OSC output type')
                output.data.should.be.within(0, 1)
                output.data.should.be.equal(inputVolumeMul)
            })

            it('should get volume of a input in dB', async function () {
                const { inputVolumeDb } = await audio.getInputVolume(networks, 'Audio Input Capture', true)
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
                await audio.setInputVolume(networks, 'Audio Input Capture', 0)
                const { inputVolumeMul, inputVolumeDb } = await audio.getInputVolume(networks, 'Audio Input Capture')
                inputVolumeMul.should.be.equal(0)
                inputVolumeDb.should.be.equal(-100)
            })

            it('should able to set input volume in dB', async function () {
                await audio.setInputVolume(networks, 'Audio Input Capture', 0, true)
                const { inputVolumeMul, inputVolumeDb } = await audio.getInputVolume(networks, 'Audio Input Capture')
                inputVolumeMul.should.be.equal(1)
                inputVolumeDb.should.be.equal(0)
            })
        })

        describe('getInputMute', function () {
            it('should get mute state of a inupt', async function () {
                const mute = await audio.getInputMute(networks, 'Audio Input Capture')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/audio/Audio Input Capture/mute', 'Wrong OSC address')
                output.data.should.be.a('number', 'Wrong OSC output type')
                output.data.should.be.oneOf([0, 1], 'Wrong OSC output data')
                mute.should.be.a('boolean')
            })
        })

        describe('setInputMute', function () {
            it('should be able to mute a input', async function () {
                await audio.setInputMute(networks, 'Audio Input Capture', 1)
                const mute = await audio.getInputMute(networks, 'Audio Input Capture')
                mute.should.be.true
            })
            
            it('should be able to unmute a input', async function () {
                await audio.setInputMute(networks, 'Audio Input Capture', 0)
                const mute = await audio.getInputMute(networks, 'Audio Input Capture')
                mute.should.be.false
            })
        })

        describe('getSpecialInputs', function () {
            it('should get special inputs', async () => {
                const specialInputList = await audio.getSpecialInputs(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/specialAudio', 'Wrong OSC address')
                output.data.should.be.a('Array', 'Wrong OSC output format')
                specialInputList.should.be.a('Array')
            })
        })

        describe('getSceneAudioInputList', function () {
            it('should get all audio inputs in a scene', async () => {
                const sceneAudioInputs = await audio.getSceneAudioInputList(networks, 'Test Scene 3')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/sceneAudio', 'Wrong OSC address')
                output.data.should.be.a('Array', 'Wrong OSC output format')
                output.data[0].should.be.a('string', 'Wrong OSC output type')
                sceneAudioInputs.should.be.a('Array')
            })

            it('should get all audio inputs in current scene', async () => {
                const currentSceneAudioInputs = await audio.getSceneAudioInputList(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/sceneAudio', 'Wrong OSC address')
                output.data.should.be.a('Array', 'Wrong OSC output format')
                currentSceneAudioInputs.should.be.a('Array')

                const sceneAudioInputs = await audio.getSceneAudioInputList(networks, 'Test Scene 3')
                sceneAudioInputs.should.be.a('Array')
                currentSceneAudioInputs.should.have.lengthOf(sceneAudioInputs.length - 1)
            })
        })

        describe('sendSceneAudioInputFeedback', function () {
            it('should send scene audio input list through OSC', async function() {
                await audio.sendSceneAudioInputFeedback(networks, 'Test Scene 3')
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/sceneAudio', 'Wrong OSC address')
                output.data.should.be.a('Array', 'Wrong OSC output format')
                output.data[0].should.be.a('string', 'Wrong OSC output type')
            })
        })

        describe('sendAudioInputVolumeFeedback', function () {
            it('should send a input\'s volume in mul through OSC', async function() {
                networks.miscConfig.enableVolumeDbOutput = false
                await audio.sendAudioInputVolumeFeedback(networks, 'Audio Input Capture', 0, -100)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/audio/Audio Input Capture/volume', 'Wrong OSC address')
                output.data.should.be.equal(0, 'Wrong OSC output data')
            })

            it('should send a input\'s volume in both mul and dB through OSC', async function() {
                networks.miscConfig.enableVolumeDbOutput = true
                await audio.sendAudioInputVolumeFeedback(networks, 'Audio Input Capture', 0, -100)
                networks.oscOut.outputs.should.have.lengthOf(2, `Too ${networks.oscOut.outputs.length < 2 ? 'little' : 'many'} OSC output`)
                
                networks.oscOut.outputs[0].address.should.be.equal('/audio/Audio Input Capture/volume', 'Wrong OSC address')
                networks.oscOut.outputs[0].data.should.be.equal(0, 'Wrong OSC output data')
                networks.oscOut.outputs[1].address.should.be.equal('/audio/Audio Input Capture/volumeDb', 'Wrong OSC address')
                networks.oscOut.outputs[1].data.should.be.equal(-100, 'Wrong OSC output data')
            })
        })

        describe('sendAudioMuteFeedback', function () {
            it('should send a input\'s mute state through OSC', async function() {
                await audio.sendAudioMuteFeedback(networks, 'Audio Input Capture', true)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/audio/Audio Input Capture/mute', 'Wrong OSC address')
                output.data.should.be.equal(1, 'Wrong OSC output data')
            })
        })
    })

    describe('Scene', function () {
        describe('getSceneList', function () {
            it('should get a list of scene name', async function () {
                const sceneList = await scene.getSceneList(networks)
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
                const sceneList = await scene.getCurrentProgramScene(networks)
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
                await scene.setCurrentProgramScene(networks, sceneName)
            })

            it('should be able to set active scene by index', async function () {
                const sceneIndex = 0
                await scene.setCurrentProgramScene(networks, sceneIndex)
            })
        })

        describe('sendActiveSceneFeedback', function () {
            it('should send active scene name through OSC', async function () {
                await scene.sendActiveSceneFeedback(networks)
                networks.oscOut.outputs.should.have.lengthOf(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/activeScene', 'Wrong OSC address')
                output.data.should.be.equal('Test Scene 1')
            })
        })

        describe('sendSceneCompletedFeedback', function () {
            it('should send completed active scene name through OSC', async function () {
                await scene.sendSceneCompletedFeedback(networks, 'Test Scene 1')
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
