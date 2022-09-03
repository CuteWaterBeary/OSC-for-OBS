# OSC Command List

## Table of Contents

- [Format](#format)
  - [Commands with Feedbacks](#commands-with-feedbacks)

- [Scene](#scene)
  - [Scene List](#scene-list)
  - [Scene State](#scene-state)

- [Source](#source)
  - [Source List / State](#source-list--state)
  - [Source Filter List / State](#source-filter-list--state)
  - [Source Filter Settings](#source-filter-settings)

- [Scene Item](#scene-item)
  - [Scene Item List](#scene-item-list)
  - [Scene Item State](#scene-item-state)
  - [Scene Item Transform / Crop](#scene-item-transform--crop)

- [Input](#input)
  - [Input List](#input-list)
  - [Input Settings](#input-settings)

- [Audio](#audio)
  - [Audio Input List](#audio-input-list)
  - [Audio Input State](#audio-input-state)

- [Transition](#transition)
  - [Transition List](#transition-list)
  - [Transition State](#transition-state)

- [Studio](#studio)
  - [Studio Mode State](#studio-mode-state)
  - [Studio Mode Preview](#studio-mode-preview)
  - [Studio Mode Transition](#studio-mode-transition)

- [Recording](#recording)

- [Streaming](#streaming)

- [Virtual Camera](#virtual-camera)

- [Output](#output)

- [Profile](#profile)

- [Scene Collection](#scene-collection)

## Format

An OSC message contains an address, and sometime one or more arguments, for example:

```
/recording 1
```

`/recording` is the address and `1` is the argument.

```
/scene
```

`/scene` is the address and no argument.

```
/studio/transition "Fade" 500
```

`/studio/transition` is the address, `"Fade"` and `500` is the arguments.

In the content below, each command will be compile into tables like this

| Address | Arguments | Description
|---|---|---|
| /recording | 0: stop, 1: start | Stop/start recording
| /scene | No argument | Get scene list
| /studio/transition | "transition name" transition duration (ms) | Trigger studio mode transition with specified transition and duration

### Commands with Feedbacks

Some commands have one or more feedbacks to let your OSC client get the current state of items in OBS Studio.

#### Example 1

| Address | Arguments | Description
|---|---|---|
| /output/[output name] | No argument | Get output state
| /output | "output name" | Get output state
| /output/[output name] (feedback) | 0: stopped, 1: started | Output stopped/started state feedback

If I want to get output state of `virtualcam_output`, I could either send

```
/output/virtualcam_output
```

or

```
/output "virtualcam_output"
```

The feedback will always be sent to address `/output/virtualcam_output` with argument being `0` or `1`.

#### Example 2

| Address | Arguments | Description
|---|---|---|
| /audio | "audio input name" | Get current volume of audio input in **both mil and dB**
| /audio/[audio input name]/volume | No argument | Get current volume of audio input in **mil**
| /audio/[audio input name]/volumeDb | No argument | Get current volume of audio input in **dB**
| /audio/[audio input name]/volume (feedback) | input volume in mul (0.0~1.0) | Volume feedback of audio input in mil
| /audio/[audio input name]/volumeDb (feedback) | input volume in dB (-100.0~0.0) | Volume feedback of audio input in dB

If I send a message to get state of `PC Audio`

```
/audio "PC Audio"
```

Then my OSC client will get these messages as return

```
/audio/PC Audio/volume 1
/audio/PC Audio/volumeDb 0
/audio/PC Audio/mute 0
```

Generally if a command could be sent with no argument would give you the status of related subject, and could change it by providing arguments.

## Scene

### Scene List

| Address | Arguments | Description
|---|---|---|
| /scene | No argument | Get scene list
| /scene (Feedback) | "scene name 1" "scene name 2" "scene name 3" | Scene list feedback

### Scene State

| Address | Arguments | Description
|---|---|---|
| /activeScene | No argument | Get active scene
| /activeScene (Feedback) | "active scene name" | Active scene feedback

| Address | Arguments | Description
|---|---|---|
| /activeScene | "scene name" | Set active scene
| /scene | "scene name" | Set active scene
| /scene | scene index (0~n-1) | Set active scene
| /scene/[scene name] | 1 | Set active scene
| /scene/[scene index (0~n-1)] | 1 | Set active scene

## Source

### Source List / State

| Address | Arguments | Description
|---|---|---|
| /source | No argument | Get source list (scenes + inputs)
| /source (feedback) | "source name 1" ... "source name n" | Source list feedback

| Address | Arguments | Description
|---|---|---|
| /source/[source name] | No argument | Get source active state
| /source | "source name" | Get source active state
| /source/[source name]/active | No argument | Get source active state
| /source/[source name] (feedback) | 0: inactive, 1: active | Source state feedback (shown on screen or not)

### Source Filter List / State

| Address | Arguments | Description
|---|---|---|
| /source/[source name]/filters | No argument | Get filter list of the source
| /source/[source name]/filters (feedback) | "filter name 1" ... "filter name n" | Filter list feedback

| Address | Arguments | Description
|---|---|---|
| /source/[source name]/filters/[filter name] | No argument | Get filter state
| /source/[source name]/filters/[filter name]/enable | No argument | Get filter state
| /source/[source name]/filters/[filter name] (feedback) | No argument | Filter state feedback

### Source Filter Settings

| Address | Arguments | Description
|---|---|---|
| /source/[source name]/filters/[filter name]/settings | No argument | Get available setting paths for the filter
| /source/[source name]/filters/[filter name]/settings (feedback) | "setting path 1" ... "setting path n" | Setting paths feedback
| /source/[source name]/filters/[filter name]/settings/[path of setting] | No argument | Get current filter setting value
| /source/[source name]/filters/[filter name]/settings/[path of setting] (feedback) | setting value | Setting value feedback

| Address | Arguments | Description
|---|---|---|
| /source/[source name]/filters/[filter name] | 0: disable, 1: enable | Disable/enable filter
| /source/[source name]/filters/[filter name]/enable | 0: disable, 1: enable | Disable/enable filter
| /source/[source name]/filters/[filter name]/disable | 1 | Disable filter
| /source/[source name]/filters/[filter name]/settings/[path of setting] | setting value | Set filter setting value
| /source/[source name]/filters/[filter name]/reset | 1 | Reset filter settings and enable it

## Scene Item

### Scene Item List

| Address | Arguments | Description
|---|---|---|
| /sceneItem | No argument | Get scene item list of active scene
| /sceneItem (feedback) | "scene item name 1" ... "scene item name n" | Scene item list feedback of active scene

> Note: Might be deprecated later
| Address | Arguments | Description
|---|---|---|
| /sceneItem | "scene name" | Get scene item list of specified scene
| /sceneItem (feedback) | "scene item name 1" ... "scene item name n" | Scene item list feedback of specified scene

### Scene Item State

| Address | Arguments | Description
|---|---|---|
| /sceneItem/[path to scene item]/enable | No argument | Get scene item state
| /sceneItem/[path to scene item]/enable (feedback) | 0: disabled, 1: enabled | Scene item state feedback

| Address | Arguments | Description
|---|---|---|
| /sceneItem/[path to scene item]/enable | 0: disable, 1: enable | Disable/enable scene item
| /sceneItem/[path to scene item]/disable | 1 | Disable scene item

### Scene Item Transform / Crop

| Address | Arguments | Description
|---|---|---|
| /sceneItem/[path to scene item]/transform | No argument | Get scene item transform/crop info (attributes)
| /sceneItem/[path to scene item]/transform (feedback) | "transform attribute name 1" ... "transform attribute name n" | Transform/crop info (attributes) feedback
| /sceneItem/[path to scene item]/transform/[transform attribute name] | No argument | Get current transform attribute value
| /sceneItem/[path to scene item]/transform/[transform attribute name] (feedback) | attribute value | Transform attribute value feedback

| Address | Arguments | Description
|---|---|---|
| /sceneItem/[path to scene item]/transform/[transform attribute name] | attribute value | Set transform attribute value
 
#### Transform Attributes

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

#### Note - Resizing a source (scene item)

By default, bounding box type of a source is set to `No bounds`. To properly resize a source, you can either stick to No bounds then change the scale of it, or switch to `Stretch to bounds` then change the bounding box size.

##### Example

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

## Input

### Input List

| Address | Arguments | Description
|---|---|---|
| /input | No argument | Get input list
| /input (feedback) | No argument | Input list feedback

### Input settings

| Address | Arguments | Description
|---|---|---|
| /input/[input name]/settings | No argument | Get available setting paths for the input
| /input/[input name]/settings (feedback) | "setting path 1" ... "setting path n" | Setting paths feedback
| /input/[input name]/settings/[path of setting] | No argument | Get current input setting
| /input/[input name]/settings/[path of setting] (feedback) | setting value | Input setting value feedback
| /input/[input name]/default | No argument | Get available default setting paths for the input
| /input/[input name]/default (feedback) | "setting path 1" ... "setting path n" | Default setting paths feedback
| /input/[input name]/default/[path of setting] | No argument | Get default value of the input setting
| /input/[input name]/default/[path of setting] (feedback) | default setting value | Default setting value feedback

| Address | Arguments | Description
|---|---|---|
| /input/[input name]/settings/[path of setting] | setting value | Set input setting value

## Audio

### Audio Input list

| Address | Arguments | Description
|---|---|---|
| /audio | No argument | Get audio input list (including special inputs like PC audio and mic)
| /audio (feedback) | No argument | Audio input list feedback

### Audio Input State

| Address | Arguments | Description
|---|---|---|
| /audio | "audio input name" | Get current mute state and volume of audio input in **both mil and dB**
| /audio/[audio input name]/mute (feedback) | 0: unmuted, 1: muted | Mute state feedback of audio input
| /audio/[audio input name]/volume (feedback) | input volume in mul (0.0~1.0) | Volume feedback of audio input in mil
| /audio/[audio input name]/volumeDb (feedback) | input volume in dB (-100.0~0.0) | Volume feedback of audio input in dB

| Address | Arguments | Description
|---|---|---|
| /audio/[audio input name]/volume | No argument | Get current volume of audio input in **mil**
| /audio/[audio input name]/volume (feedback) | input volume in mul (0.0~1.0) | Volume feedback of audio input in mil

| Address | Arguments | Description
|---|---|---|
| /audio/[audio input name]/volumeDb | No argument | Get current volume of audio input in **dB**
| /audio/[audio input name]/volumeDb (feedback) | input volume in dB (-100.0~0.0) | Volume feedback of audio input in dB

| Address | Arguments | Description
|---|---|---|
| /audio/[audio input name]/mute | No argument | Get audio input mute state
| /audio/[audio input name]/mute (feedback) | 0: unmuted, 1: muted | Audio input mute state feedback

| Address | Arguments | Description
|---|---|---|
| /audio/[audio input name]/volume | input volume in mul (0.0~1.0) | Set volume of audio input in mil
| /audio/[audio input name]/volumeDb | input volume in dB (-100.0~0.0) | Set volume of audio input in dB
| /audio/[audio input name]/mute | 0: unmute, 1: mute | Unmute/mute audio input


### Scene Audio

| Address | Arguments | Description
|---|---|---|
| /sceneAudio | No argument | Get audio input list of active scene (including special inputs like PC audio and mic)
| /sceneAudio (feedback) | No argument | Audio input list feedback

> Note: Dynamically added inputs, like ones from source scene of a StreamFX's source mirror, might not be included.

## Transition

### Transition List

| Address | Arguments | Description
|---|---|---|
| /transition | No argument | Get transition list
| /transition (feedback) | "transition name 1" ... "transition name n" | Transition list feedback

### Transition State

| Address | Arguments | Description
|---|---|---|
| /transition/current | No argument | Get current transition name (the transition selected in OBS Studio UI)
| /transition/current (feedback) | "transition name" | Transition name feedback
| /transition/duration | No argument | Get current transition duration (the transition selected in OBS Studio UI)
| /transition/duration (feedback) | transition duration (ms) | Transition duration feedback
| /transition/cursor | No argument | Get current transition progression (0.0~1.0)
| /transition/cursor | transition progress (0.0~1.0) | Transition progression feedback

> Note: When there's no transition happening, `/transition/cursor` will return `1`

| Address | Arguments | Description
|---|---|---|
| /transition/current | "transition name" | Set current transition name (the transition selected in OBS Studio UI)
| /transition/duration | transition duration (ms) | Set current transition duration (the transition selected in OBS Studio UI)

> Note: If a transition has fixed duration (`Cut` for example), `/transition/duration` will return -1 and any set value will be ignored

## Studio

### Studio Mode State

| Address | Arguments | Description
|---|---|---|
| /studio | No argument | Get studio mode state
| /studio (feedback) | 0: disabled, 1: enabled | studio mode state feedback

| Address | Arguments | Description
|---|---|---|
| /studio | 0: disable, 1: enable | Disable/enable studio mode
| /studio/enable | 0: disable, 1: enable | Disable/enable studio mode
| /studio/disable | 1 | Disable studio mode
| /studio/toggle | 1 | Toggle studio mode

### Studio Mode Preview

| Address | Arguments | Description
|---|---|---|
| /studio/preview | No argument | Get studio preview scene
| /studio/preview (feedback) | "preview scene name" | Studio preview scene feedback

| Address | Arguments | Description
|---|---|---|
| /studio/preview | "preview scene name" | Set studio preview scene

### Studio Mode Transition

| /studio/transition | 1 | Trigger studio mode transition
| /studio/transition | "transition name" | Trigger studio mode transition with specified transition
| /studio/transition | "transition name" transition duration (ms) | Trigger studio mode transition with specified transition and duration
| /studio/cursor | transition progress (0.0~1.0) | Set current progression of transition

> Note: Unless it's set to 1.0, which will also trigger `/activeSceneCompleted`, you could set any value for `/studio/cursor` within the range.

## Recording

| Address | Arguments | Description
|---|---|---|
| /recording | No argument | Get recording state
| /recording (feedback) | 0: stopped, 1: started | Recording stopped/started state feedback
| /recording/pause (feedback) | 0: stopped, 1: started | Recording resumed/paused state feedback

| Address | Arguments | Description
|---|---|---|
| /recording | 0: stop, 1: start | Stop/start recording
| /recording/start | 0: stop, 1: start | Stop/start recording
| /recording/stop | 1 | Stop recording
| /recording/pause | 0: resume, 1: pause | Resume/pause recording
| /recording/resume | 1 | Resume recording
| /recording/toggle | 1 | Toggle recording between stopped/started
| /recording/togglePause | 1 | Toggle recording state between resumed/paused

## Streaming

| Address | Arguments | Description
|---|---|---|
| /streaming | No argument | Get streaming state
| /streaming (feedback) | 0: stopped, 1: started | Streaming stopped/started state feedback

| Address | Arguments | Description
|---|---|---|
| /streaming | 0: stop, 1: start | Stop/start streaming
| /streaming/start | 0: stop, 1: start | Stop/start streaming
| /streaming/stop | 1 | Stop streaming
| /streaming/toggle | 1 | Toggle streaming state between stopped/started

## Virtual Camera

| Address | Arguments | Description
|---|---|---|
| /virtualCam | No argument | Get virtual camera state
| /virtualCam (feedback) | 0: stopped, 1: started | Virtual camera stopped/started state feedback

| Address | Arguments | Description
|---|---|---|
| /virtualCam | 0: stop, 1: start | Stop/start  virtual camera
| /virtualCam/start | 0: stop, 1: start | Stop/start virtual camera
| /virtualCam/stop | 1 | Stop virtual camera
| /virtualCam/toggle | 1 | Toggle virtual camera state between stopped/started

## Output

| Address | Arguments | Description
|---|---|---|
| /output | No argument | Get output list (including virtual camera)
| /output (feedback) | "output name 1" ... "output name n" | Output list feedback
| /output/[output name] | No argument | Get output state
| /output | "output name" | Get output state
| /output/[output name] (feedback) | 0: stopped, 1: started | Output stopped/started state feedback

| Address | Arguments | Description
|---|---|---|
| /output/[output name] | 0: stop, 1: start | Stop/start output
| /output/[output name]/start | 0: stop, 1: start | Stop/start output
| /output/[output name]/stop | 1 | Stop output
| /output/[output name]/toggle | 1 | Toggle output state between stopped/started

## Profile

| Address | Arguments | Description
|---|---|---|
| /profile | No argument | Get profile list
| /profile (feedback) | "profile name 1" ... "profile name n" | Profile list feedback
| /profile/current | No argument | Get active profile name
| /profile/current (feedback) | "profile name" | Active profile name feedback

| Address | Arguments | Description
|---|---|---|
| /profile/current | "profile name" | Set active profile
| /profile/[profile name] | 1 | Set active profile

## Scene Collection

| Address | Arguments | Description
|---|---|---|
| /sceneCollection | No argument | Get scene collection list
| /sceneCollection (feedback) | "scene collection name 1" ... "scene collection name n" | Scene collection list feedback
| /sceneCollection/current | No argument | Get active scene collection name
| /sceneCollection/current (feedback) | "scene collection name" | Active scene collection name feedback

| Address | Arguments | Description
|---|---|---|
| /sceneCollection/current | "scene collection name" | Set active scene collection
| /sceneCollection/[scene collection name] | 1 | Set active scene collection
