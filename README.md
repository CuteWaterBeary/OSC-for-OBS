# OSC for OBS

> **Note**  
> This is a forked repository of [jshea2/OSC-for-OBS](github.com/jshea2/OSC-for-OBS) being (heavily) modified to personal preference, which make it *not* compatible with upstream (function, versioning, etc.).  
> If you found a bug or have any suggestion for this repo, please put it [here](https://github.com/Re-Alise/OSC-for-OBS/issues).

<p align="center">
  <img src="./icons/png/1024x1024.png" width=150 align="center">
</p>

Control and listen to [OBS](https://obsproject.com/) via OSC protocol

# Requirement

- [OBS Studio](https://obsproject.com) 27.0.0 or above
- [obs-websocket](https://github.com/obsproject/obs-websocket) 4.9.1  
  obs-websocket 5.0.0 and above **DO NOT** compatible with older API (unless you installed additional `4.9.1-compat` binary)

# OSC Command List (WIP)

## Scene

`/scene`

`/scene` `[scene name]`

`/scene` `[scene index (0~n-1)]`

`/scene/[scene name]`

`/scene/[scene index (0~n-1)]`

`/activeScene`

`/activeScene` `[scene name]`

## Source

`/source`

`/source` `[source name]`

## Scene Item

`/sceneItem`

`/sceneItem/[sceen item name]/show`

`/sceneItem/[sceen item name]/show` `[0|1]`

`/sceneItem/[sceen item name]/hide` `1`

`/sceneItem/[sceen item name]/reset` `1`

`/sceneItem/[sceen item name]/property`

`/sceneItem/[sceen item name]/property/[property path]`

`/sceneItem/[sceen item name]/property/[property path]` `[property value]`

## Audio

`/audio`

`/audio` `[audio source name]`

`/audio/volume`

`/audio/volume` `[volume (0.0~1.0)]`

`/audio/mute`

`/audio/mute` `[0|1]`

## Recording

`/recording`

`/recording` `[0|1]`

`/recording/start` `1`

`/recording/stop` `1`

`/recording/pause` `0`

`/recording/pause` `1`

`/recording/resume` `1`

`/recording/toggle` `1`

`/recording/togglePause` `1`

## Studio

`/studio`

`/studio` `[0|1]`

`/studio/enable`

`/studio/disable`

`/studio/toggle`

`/studio/preview`

`/studio/preview` `[scene name]`

`/studio/transition` `1`

`/studio/transition` `[transition name]`

`/studio/transition` `[transition name] [duration (ms)]`

## Virtual Cam

`/virtualCam`

`/virtualCam` `[0|1]`

`/virtualCam/start` `1`

`/virtualCam/stop` `1`

`/virtualCam/toggle` `1`

## Output

`/output`

`/output` `[output name]`

`/output/[output name]` `[0|1]`

`/output/[output name]/start` `1`

`/output/[output name]/stop` `1`

`/output/[output name]/toggle` `1`

# OSC Feedbacks (WIP)

## Scene

`/activeScene` `[scene name]`

`/activeSceneCompleted` `[scene name]`

## Audio

`/sceneAudio` `[scene name]` `[scene audio source 1]` ...  `[scene audio source n]`

`/audio/[audio source]/volume` `[volume (0.0~1.0)]`

`/audio/[audio source]/mute` `[0|1]`

## Recording

`/recording` `[0|1]`

`/recording/pause` `[0|1]`

## Studio

`/studio` `[0|1]`

`/studio/preview` `[scene name]`

## Virtual Cam

`/virtualCam` `[0|1]`

# Acknowledgement

- [OSC for OBS by jshea2](github.com/jshea2/OSC-for-OBS) - Original project (upstream)
- [ObSC](https://github.com/CarloCattano/ObSC) - Inspired by this project
