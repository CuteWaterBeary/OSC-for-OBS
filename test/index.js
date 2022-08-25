// const assert = require('assert')
const should = require('chai').should()

const { open } = require('fs/promises')
const OBSWebSocket = require('obs-websocket-js').default

const scene = require('../src/obsosc/scene')

const obs = new OBSWebSocket()
const testConfigPath = './test/config.json'

const configText = `You need to have a config.json in test folder with following structure:
        {
            "ip": "your obs-websocket's ip (normally localhost or 127.0.0.1)"
            "port": "your obs-websocket's port (normally 4455)"
            "password": "your obs-websocket's password"
        }`

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

const networks = {
    obs, oscOut, reset: function () {
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

describe('Config check', () => {
    it(configText, async () => {
        const configJson = await loadJSON(testConfigPath)
        should.exist(configJson.ip, 'IP not exit')
        should.exist(configJson.port, 'Port not exist')
        should.exist(configJson.password, 'Password not exits')
        configJson.ip.should.be.a('string', 'IP should be a string')
        configJson.port.should.be.a('string', 'Port should be a string')
        configJson.password.should.be.a('string', 'Password should be a string')
    })
})

describe('OBSOSC modules', () => {
    before(async () => {
        const configJson = await loadJSON(testConfigPath)
        try {
            const address = 'ws://' + configJson.ip + ':' + configJson.port
            await obs.connect(address, configJson.password, { rpcVersion: 1 })
        } catch (e) {
            throw e
        }
    })

    beforeEach('Reset networks', () => {
        networks.reset()
    })

    describe('Scene', () => {

        describe('getSceneList', () => {
            it('should get a list of scene name', async () => {
                const sceneList = await scene.getSceneList(networks)
                networks.oscOut.outputs.length.should.be.equal(1, 'Too many OSC output')
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/scene', 'Wrong OSC address')
                // Note: Scenes and Scene Items are in reversed order of what obs-websocket provided
                output.data.should.be.deep.equal(['Test Scene 1', 'Test Scene 2', 'Test Scene 3'], 'Wrong OSC output data')
                sceneList.should.be.deep.equal(
                    [
                        { sceneIndex: 2, sceneName: 'Test Scene 1' },
                        { sceneIndex: 1, sceneName: 'Test Scene 2' },
                        { sceneIndex: 0, sceneName: 'Test Scene 3' },
                    ], 'Wrong scene data'
                )
            })
        })

        describe('getCurrentProgramScene', () => {
            it('should get the active scene name', async () => {
                const sceneList = await scene.getCurrentProgramScene(networks)
                networks.oscOut.outputs.length.should.be.equal(1, 'Too many OSC output')
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/activeScene', 'Wrong OSC address')
                output.data.should.be.deep.equal('Test Scene 1', 'Wrong OSC output data')
                sceneList.should.be.deep.equal('Test Scene 1', 'Wrong scene data')
            })
        })

        describe('setCurrentProgramScene', () => {
            it('should be able to set active scene by name', async () => {
                const sceneName = 'Test Scene 1'
                await scene.setCurrentProgramScene(networks, sceneName)
            })

            it('should be able to set active scene by index', async () => {
                const sceneIndex = 0
                await scene.setCurrentProgramScene(networks, sceneIndex)
            })
        })

        describe('sendActiveSceneFeedback', () => {
            it('should send active scene name through OSC', async () => {
                await scene.sendActiveSceneFeedback(networks)
                networks.oscOut.outputs.length.should.be.equal(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/activeScene', 'Wrong OSC address')
                output.data.should.be.equal('Test Scene 1')
            })
        })

        describe('sendSceneCompletedFeedback', () => {
            it('should send completed active scene name through OSC', async () => {
                await scene.sendSceneCompletedFeedback(networks, 'Test Scene 1')
                networks.oscOut.outputs.length.should.be.equal(1, `Too ${networks.oscOut.outputs.length < 1 ? 'little' : 'many'} OSC output`)
                const output = networks.oscOut.outputs[0]
                output.address.should.be.equal('/activeSceneCompleted', 'Wrong OSC address')
                output.data.should.be.equal('Test Scene 1')
            })
        })
    })

    after(async () => {
        try {
            await obs.disconnect()
        } catch (e) {
            throw e
        }
    })
})
