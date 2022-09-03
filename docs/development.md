# Development

This page shows you how to run, build and test OSC for OBS

## Basic Info

OSC for OBS uses [Node.js](https://nodejs.org) with following dependencies:

- [Electron](https://www.electronjs.org)  
  Web app framework
- [node-osc](https://github.com/MylesBorins/node-osc)  
  Handling OSC connections
- [obs-websocket-js](https://github.com/obs-websocket-community-projects/obs-websocket-js)  
  Handling obs-websocket connections

- [electron-packager](https://electron.github.io/electron-packager/main/)  
  Packaging Electron app to executables
- [Mocha](https://mochajs.org)  
  Unit testing framework
- [Chai](https://www.chaijs.com)  
  Assertion library used alongside Mocha

OSC commands is tested on [TouchOSC](https://hexler.net/touchosc), but all other OSC clients should work as well.

Also check [obs-websocket protocol](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md) for available feedbacks and request types.

### Folder Structure

```
OSC-for-OBS
|
├─docs                # Documents
├─icons               # App icon
├─release             # Packaged app
├─src                 # Main code
|  ├─extraResources   # App icon
|  └─obsosc           # Modules for obs-websocket requests and OSC output
|
└─test                # Unit testing code
```

## Run

You can run dev version of OSC for OBS by:

```shell
npm install # First time only, install all required dependencies
npm start
```

After that, you should able to see debuging messages in you terminal, including incoming data and errors.

## Build

> **Note**  
> No app icon yet, will fix it later

You can package the app to executables by:

```shell
npm run build-win32 # To 32-bit windows app
npm run build-win64 # To 64-bit windows app
npm run build-linux64 # To 64-bit linux app
npm run build-darwin # To universal macOS app
```

The packaged apps could be found under `release` folder.

## Unit Testing

Unit testing should able to give you a rough idea of what and where went wrong before publishing by performing a series of checking on individual function's outputs with expected data type and/or value. It currently covered most of functions for modules in `obsosc` with single test case, which should be sufficient to catch common errors beforehand but it's always welcome for anyone add tests on edge cases.

Because of the functionality of OSC for OBS and complexity to mimic obs-websocket's behavior, we also need a working OBS Studio with compatible version of obs-websocket installed.

Due to privacy concerns and in case of code tampering or something horrible happen during testing, it's strongly recommended to use a clean install of OBS Studio with **no** personal information inside (profile, scene collection, settings, etc.) and/or switch to portable mode (Windows system only)

> OBS Studio **27.x and below** with portable mode enabled (Windows)
> 1. Get [OBS Studio](https://obsproject.com/download) by clicking *Download Zip*, do not download installer as you usually did
> 2. Get [obs-websocket](https://github.com/obsproject/obs-websocket/releases) plugin
> 3. Unzip OBS Studio to wherever you want, then unzip and drop obs-websocket in it
> 4. Create a text file named `obs_portable_mode` (with `.txt` file extension) in root folder of OBS Studio (the folder that contains `bin`, `data` and `obs-plugins`)
> 5. Start OBS Studio under `bin/64bit`, choose using virtual camera when Auto-Configuration Wizard pop up, and a `config` folder should be created in root folder automatically, that's where it store settings from now on

> OBS Studio **28.0 and above** with portable mode enabled (Windows)
> 1. Get [OBS Studio](https://obsproject.com/download) by clicking *Download Zip*, do not download installer as you usually did
> 2. Unzip OBS Studio to wherever you want
> 3. Create a text file named `obs_portable_mode` (with `.txt` file extension) in root folder of OBS Studio (the folder that contains `bin`, `data` and `obs-plugins`)
> 4. Start OBS Studio under `bin/64bit`, choose using virtual camera when Auto-Configuration Wizard pop up, and a `config` folder should be created in root folder automatically, that's where it store settings from now on

### Setup

1. Start OBS Studio and change language to `English` to make transition names (Fade, Cut) consistant
2. Import test scene collection by clicking `Scene Collection > Import` at menu bar, set collection path to `<path to OSC-to-OBS project folder>/test/unit-test.json` and click `Import`
3. Switch scene collection to `Test`
4. Enable websocket by clicking `Tools > obs-websocket Settings` at menu bar then click `Enable WebSocket Server`
5. Create `config.json` under `<path to OSC-to-OBS project folder>/test/` with following format:
   ```
   {
    "ip": "localhost",
    "port": "4455",
    "password": "your_obs_websocket_password"
   }
   ```

### Run the Test

Before starting it, you can find test detail in `test/index.js`, each `describe` code blocks groups individual tests by module and function name, you can skip any test by replacing `describe` with `describe.skip`. For example, if you don't want to test virtual camera, you need to skip `Virtual Camera` and `Output`.

> Photosensitivity warning: During the test, OBS Studio would produce quick flashs by rapidly switch scenes, change source properties, enable/disable studio mode and start/stop virtual camera. If you have any concerns, please minimize OBS Studio before preceding further, it will not effect the result.

To perform the test, simply enter the following in terminal:

```shell
npm test
```

> (2022-09-02) Currently tests for output and virtual camera are skipped due to unknown issue that cause virtual camera refuse to start after some obs-websocket requests

After ~15 seconds, the result should be displayed in terminal with detail if any test failed. Currently there's some tests (in Studio) prone to fail due to inconsistant state between individual tests, please run a few more times if a test shows failed.
