"use strict";

/*
This script uses one Tone.Loop for continuous sound and mirrors that playing state
with continuous rotation. A second tap stops both parts of the test immediately.
*/

/* Page elements and state -------------------------------------------------- */
const flowerButton = document.querySelector("#flower");
const soundStatus = document.querySelector("#sound-status");
const noteDuration = 0.28;
let flowerSynth;
let noteLoop;
let isPlaying = false;
let isAudioStarting = false;
let shouldPlay = false;

/* Playing-state control ---------------------------------------------------- */
function stopSound() {
    // Mute first, then stop the one loop and cancel queued envelope changes.
    if (flowerSynth) {
        flowerSynth.volume.value = -100;
        flowerSynth.envelope.cancel(Tone.immediate());
        flowerSynth.triggerRelease(Tone.immediate());
    }
    if (noteLoop) {
        noteLoop.mute = true;
    }
    if (typeof Tone !== "undefined") {
        Tone.Transport.stop();
    }

    isPlaying = false;
    flowerButton.classList.remove("isPlaying");
    flowerButton.setAttribute("aria-pressed", "false");
    soundStatus.textContent = "Sound stopped";
}

async function startSound() {
    // One in-flight audio unlock prevents rapid taps from creating duplicate loops.
    if (isAudioStarting || isPlaying) return;
    if (typeof Tone === "undefined") {
        shouldPlay = false;
        soundStatus.textContent = "Sound could not load. Check your connection and reload.";
        return;
    }

    isAudioStarting = true;
    try {
        // Browsers allow Tone.js audio only after the user's first activation.
        await Tone.start();
        if (!shouldPlay) return;
        if (Tone.getContext().state !== "running") {
            throw new Error("Audio context did not start");
        }
        if (!flowerSynth) {
            flowerSynth = new Tone.Synth({
                oscillator: { type: "sine" },
                envelope: {
                    attack: 0.025,
                    decay: 0.08,
                    sustain: 0.55,
                    release: 0.44,
                    releaseCurve: "linear"
                },
                volume: -16
            }).toDestination();
            Tone.Transport.bpm.value = 75;
            // One reusable Tone.Loop supplies the repeating playing state.
            noteLoop = new Tone.Loop(scheduledTime => {
                if (isPlaying && shouldPlay) {
                    flowerSynth.triggerAttackRelease(
                        "C4",
                        noteDuration,
                        scheduledTime,
                        0.65
                    );
                }
            }, "4n").start("4n");
            Tone.getContext().rawContext.addEventListener("statechange", () => {
                // A suspended audio context must not leave a silent flower spinning.
                if (isPlaying && Tone.getContext().state !== "running") {
                    shouldPlay = false;
                    stopSound();
                    soundStatus.textContent = "Audio paused. Tap the flower to play again.";
                }
            });
        }

        // Restore this one synth and loop; never create a second copy on restart.
        flowerSynth.envelope.cancel(Tone.immediate());
        flowerSynth.volume.value = -16;
        noteLoop.mute = false;
        Tone.Transport.position = 0;
        flowerSynth.triggerAttackRelease("C4", noteDuration, Tone.immediate(), 0.65);
        isPlaying = true;
        Tone.Transport.start();

        // The CSS class and aria-pressed value mirror the sound's playing state.
        flowerButton.classList.add("isPlaying");
        flowerButton.setAttribute("aria-pressed", "true");
        soundStatus.textContent = "Sound playing";
    } catch {
        shouldPlay = false;
        stopSound();
        soundStatus.textContent = "Sound could not start. Tap the flower to try again.";
    } finally {
        isAudioStarting = false;
    }
}

/* User input and accessibility -------------------------------------------- */
flowerButton.addEventListener("click", () => {
    // Every tap reverses the requested state, including taps during audio startup.
    shouldPlay = !shouldPlay;
    if (shouldPlay) {
        void startSound();
    } else {
        stopSound();
    }
});

// Native button clicks cover mouse, touch, Enter and Space. A held key is one tap.
flowerButton.addEventListener("keydown", event => {
    if (event.repeat && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
    }
});

document.addEventListener("visibilitychange", () => {
    if (document.hidden && shouldPlay) {
        shouldPlay = false;
        stopSound();
    }
});
