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
- [obs-websocket](https://github.com/obsproject/obs-websocket) **5.0.0** or above

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

`/sceneItem/[path to sceen item]/show`

`/sceneItem/[path to sceen item]/show` `[0|1]`

`/sceneItem/[path to sceen item]/hide` `1`

<!-- `/sceneItem/[path to sceen item]/reset` `1` -->

`/sceneItem/[path to sceen item]/transform`

Get transform/crop info (attributes) of a scene item

- width, height (Read only)  
  Current source size when bounding box type is set to `No bounds`

- sourceWidth, sourceHeight (Read only)  
  Source's original size

- positionX, positionY

- scaleX, scaleY

- cropTop, cropRight, cropBottom, cropLeft

- rotation (degree)

- alignment  
  Alignment for source or for bounding box when enabled, default: `5` (Top Left)
  <table>
    <tr>
      <td>5 (Top Left)</td>
      <td>4 (Top Center)</td>
      <td>6 (Top Right)</td>
    </tr>
    <tr>
      <td>1 (Center Left)</td>
      <td>0 (Center)</td>
      <td>2 (Center Right)</td>
    </tr>
    <tr>
      <td>9 (Bottom Left)</td>
      <td>8 (Bottom Center)</td>
      <td>10 (Bottom Right)</td>
    </tr>
  </table>

- boundsAlignment  
  Alignment for source inside a bounding box, default: `0` (`Center`)

- boundsWidth, boundsHeight

- boundsType  
  Bounding box type, default: `OBS_BOUNDS_NONE` (No bounds)
  - `OBS_BOUNDS_NONE` (No bounds)
  - `OBS_BOUNDS_STRETCH` (Stretch to bounds)
  - `OBS_BOUNDS_SCALE_INNER` (Scale to inner bounds)
  - `OBS_BOUNDS_SCALE_OUTER` (Scale to outer bounds)
  - `OBS_BOUNDS_SCALE_TO_WIDTH` (Scale to width of bounds)
  - `OBS_BOUNDS_SCALE_TO_HEIGHT` (Scale to height of bounds)
  - `OBS_BOUNDS_MAX_ONLY` (Maximum size only)

`/sceneItem/[path to sceen item]/transform/[transform attribute]`

`/sceneItem/[path to sceen item]/transform/[transform attribute]` `[attribute value]`

### Note - Resizing a source (scene item)

By default, bounding box type of a source is set to `No bounds` . To properly resize a source, you can either stick to No bounds then change the scale of it, or switch to `Stretch to bounds` then change the bounding box size.

#### Example

With a OBS canvas (output) resolution of 1920x1080, a scene `Scene 1` and a image source `Image` contained a 4K image (3840x2160):

If we want to fit `Image` entirely into `Scene 1` , we can either change the scale by

```
'/sceneItem/Scene 1/Image/transform/scaleX' 0.5
'/sceneItem/Scene 1/Image/transform/scaleY' 0.5
```

Or switch bounding box type to `Stretch to bounds` then change the bounding box size, which you can precisely set

```
'/sceneItem/Scene 1/Image/transform/boundsType' 'OBS_BOUNDS_STRETCH'

'/sceneItem/Scene 1/Image/transform/boundsWidth' 1920
'/sceneItem/Scene 1/Image/transform/boundsHeight' 1080
```

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

`/sceneAudio` `[scene name]` `[scene audio source 1]` ... `[scene audio source n]`

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
