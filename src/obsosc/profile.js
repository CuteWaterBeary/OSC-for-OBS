module.exports = { processProfile, sendCurrentProfileFeedback }

const DEBUG = process.argv.includes('--enable-log')

async function processProfile(networks, path, args) {
    if (path[0] === undefined) {
        if (args[0] === undefined) {
            getProfileList(networks)
        } else {
            setCurrentProfile(networks, args[0])
        }
    }

    if (path[0] === 'current') {
        getCurrentProfile(networks)
    } else if (args[0] === 1) {
        setCurrentProfile(networks, path[0])
    }
}

async function getProfileList(networks, sendOSC = true) {
    const profileListPath = '/profile'
    try {
        const { profiles } = await networks.obs.call('GetProfileList')
        if (sendOSC) {
            try {
                networks.oscOut.send(profileListPath, profiles)
            } catch (e) {
                if (DEBUG) console.error('getProfileList -- Failed to send profile list', e)
            }
        }
    } catch (e) {
        if (DEBUG) console.error('getProfileList -- Failed to get profile list:', e)
    }
}

async function setCurrentProfile(networks, profileName) {
    try {
        await networks.obs.call('SetCurrentProfile', { profileName })
    } catch (e) {
        if (DEBUG) console.error('setCurrentProfile -- Failed to set current profile:', e)
    }
}

async function getCurrentProfile(networks) {
    const currentProfilePath = '/profile/current'
    try {
        const { profileName } = await networks.obs.call('GetProfileList')
        try {
            networks.oscOut.send(currentProfilePath, profileName)
        } catch (e) {
            if (DEBUG) console.error('getCurrentProfile -- Failed to send current profile:', e)
        }
    } catch (e) {
        if (DEBUG) console.error('getCurrentProfile -- Failed to get current profile:', e)
    }
}

function sendCurrentProfileFeedback(networks, profileName) {
    const currentProfilePath = '/profile/current'
    try {
        networks.oscOut.send(currentProfilePath, profileName)
    } catch (e) {
        if (DEBUG) console.error('sendCurrentProfileFeedback -- Failed to send current profile:', e)
    }
}