# OSC Feedbacks

## Scene

### Notify active scene

Triggered when OBS is changing scene and/or is completely transitioned

| Address | Arguments | Description
|---|---|---|
| /activeScene | "scene name" | Name of scene is switching to (at the start of transition)
| /activeSceneCompleted | "scene name" | Name of scene is switched to (at the end of transition)

## Scene Item

### Notify active scene items

Triggered when a new scene is completely transitioned

| Address | Arguments | Description
|---|---|---|
| /sceneItem | "scene item name 1" ... "scene item name n" | Names of scene items in active scene

## Audio

### Notify active scene audios

Triggered when a new scene is completely transitioned

| Address | Arguments | Description
|---|---|---|
| /sceneAudio | "scene audio input 1" ... "scene audio input n" | Names of audio inputs in active scene

> Note: Dynamically added inputs, like ones from source scene of a StreamFX's source mirror, might not be included.

### Notify input volume change

Triggered when a audio input's volume is changed

| Address | Arguments | Description
|---|---|---|
| /audio/[audio input]/volume | volume in mul (0.0~1.0) | Volume of the audio input

### Enable volumeDb feedback

Triggered when a audio input's volume is changed

> Need to enable `Notify input volume change` as well

| Address | Arguments | Description
|---|---|---|
| /audio/[audio input]/volumeDb | volume in dB (-100.0~0.0) | Volume of the audio input

### Notify input mute state

Triggered when a audio input is unmuted/muted

| Address | Arguments | Description
|---|---|---|
| /audio/[audio input]/mute | 0: unmuted, 1: muted | Mute state of the audio input

## Recording

### Notify recording state

Triggered when recording is stopped/started/resumed/paused

| Address | Arguments | Description
|---|---|---|
| /recording | 0: stopped, 1: started | State of recording
| /recording/pause | 0: resumed, 1: paused | Pause state of recording

## Streaming

### Notify streaming state

Triggered when streaming is stopped/started

| Address | Arguments | Description
|---|---|---|
| /streaming | 0: stopped, 1: started | State of streaming

## Virtual Camera

### Notify virtual cam state

Triggered when virtual camera is stopped/started

| Address | Arguments | Description
|---|---|---|
| /virtualCam | 0: stopped, 1: started | State of virtual camera

## Studio

### Notify studio mode state

Triggered when studio mode is disabled/enabled

| Address | Arguments | Description
|---|---|---|
| /studio | 0: disabled, 1: enabled | Enable state of studio mode

### Notify studio preview scene

Triggered when preview scene is changed

| Address | Arguments | Description
|---|---|---|
| /studio/preview | "scene name" | Name of preview scene

## Profile

### Notify profile

Triggered when current profile is changed

| Address | Arguments | Description
|---|---|---|
| /profile/current | "profile name" | Name of active profile

## Scene Collection

### Notify scene collection

Triggered when current scene collection is changed

| Address | Arguments | Description
|---|---|---|
| /sceneCollection/current | "scene collection name" | Name of active scene collection
