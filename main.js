// In main.js

// --- IMPORTS ---
// ADD the new functions we will create in p5.js
import { initP5Sketches, updateDisplayText, setCrtEffect, p5Video, setGiveUpState } from './p5.js';

// --- DOM ELEMENTS ---
const startMenu = document.getElementById('start-menu-overlay');
const startButton = document.getElementById('start-button');

// --- TIMECODES & STATE ---
const timecodes = { loops: { menu: { start: 0, end: 4 }, dim: { start: 9.03, end: 19 }, bright: { start: 24.03, end: 34 } }, transitions: { intro: { start: 4.03, end: 9, nextState: 'dim' }, dim_to_bright: { start: 19.03, end: 24, nextState: 'bright' }, bright_to_blinding: { start: 34.03, end: 44, nextState: 'collapse' }, collapse: { start: 44.03, end: 50, nextState: 'dim' } } };
let currentState = { type: null, name: null, data: {} };
let isExperienceStarted = false;
let currentUserInput = '';
let isWaitingForAI = false;
let isDialogueActive = false;
let needsClearOnNextKey = false; // Flag to clear text on the next input
let giveUpIntensity = 0; // 0 = normal, 1 = first time, 2 = second, etc.


// --- Video Control Logic ---
function setLoopingState(stateName) {
    console.log(`Entering looping state: ${stateName}`);
    const loop = Object.assign({}, timecodes.loops[stateName]);
    currentState = { type: 'loop', name: stateName, data: loop };

    if (p5Video) {
        p5Video.play();
        p5Video.time(loop.start);
    }
}

function playTransition(transitionName) {
    console.log(`Playing transition: ${transitionName}`);
    const transition = Object.assign({}, timecodes.transitions[transitionName]);
    currentState = { type: 'transition', name: transitionName, data: transition };

    if (p5Video) {
        p5Video.play();
        p5Video.time(transition.start);
    }
}

// --- AI Communication Logic ---
async function sendChatMessage(message) {
    if (!message.trim()) return;

    // --- NEW "GIVE UP" LOGIC ---
    if (message.toLowerCase().includes('give up')) {
        giveUpIntensity++; // Escalate the intensity
        console.log(`'Give Up' detected. Intensity is now ${giveUpIntensity}`);
    } else {
        giveUpIntensity = 0; // Reset if the user says anything else
    }
    // Tell p5.js the current intensity so it knows to shake Steve's text
    setGiveUpState(giveUpIntensity);
    // --- END NEW LOGIC ---

    isDialogueActive = true;
    isWaitingForAI = true;
    updateDisplayText({ steve: '...' });
    currentUserInput = '';

    try {
        const response = await fetch('http://127.0.0.1:5000/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
        const data = await response.json();
        isWaitingForAI = false;

        console.log('AI Response Data:', data);
        updateDisplayText({ steve: data.dialogue }, () => {
            console.log("main.js: Dialogue unlocked by callback.");
            isDialogueActive = false;
            needsClearOnNextKey = true;
        });


        handleAIResponse(data.visualState);
    } catch (error) {
        console.error("Error communicating with the server:", error);
        updateDisplayText({ steve: "System: Could not connect to Steve's thoughts..." });
        isDialogueActive = false; // Unlock on error
        needsClearOnNextKey = true; // Also set flag on error
        isWaitingForAI = false;
    }
}

function handleAIResponse(visualState) {
    // --- MODIFIED to respect the "Give Up" state ---
    // If we are in a "give up" state, PREVENT Steve from entering the bright state.
    if (giveUpIntensity > 0 && visualState === 'bright') {
        console.log("Blocking transition to 'bright' state due to 'give up' intensity.");
        return; // Exit the function before a transition can be played
    }
    // --- END MODIFICATION ---

    const currentStateName = currentState.name;
    if (visualState === 'dark') {
        checkAspectRatio();
        if (currentStateName === 'bright') { playTransition('bright_to_blinding'); }
        else { playTransition('collapse'); }
    } else if (visualState === 'bright' && currentStateName !== 'bright') {
        playTransition('dim_to_bright');
    } else if (visualState === 'considering') {
        console.log("AI is in 'Considering' state.");
    }
}


// --- Input Listener ---
window.addEventListener('keydown', (event) => {
    // Ignore all input if the experience hasn't started or dialogue is locked
    if (!isExperienceStarted || isDialogueActive) {
        return;
    }

    // A flag to determine if we need to redraw the user's text at the end.
    let inputWasProcessed = false;

    // --- Stage 1: Handle Screen Clearing ---
    if (needsClearOnNextKey) {
        const isValidActionKey = event.key.length === 1 || event.key === 'Backspace' || event.key === 'Enter';

        if (isValidActionKey) {
            // --- THIS IS THE ONLY LINE THAT CHANGES ---
            // We now only clear the user's text, leaving Steve's last response visible.
            updateDisplayText({ user: '' });
            // -----------------------------------------
            needsClearOnNextKey = false;
        } else {
            return; // Ignore modifier keys like Shift, Alt, Ctrl
        }
    }

    // --- Stage 2: Process the User's Input ---
    if (event.key === 'Enter') {
        sendChatMessage(currentUserInput);
        // No need to update the display; sendChatMessage handles the '...'
        inputWasProcessed = false;
    } else if (event.key === 'Backspace') {
        currentUserInput = currentUserInput.slice(0, -1);
        inputWasProcessed = true;
    } else if (event.key.length === 1) { // Only append visible characters
        currentUserInput += event.key;
        inputWasProcessed = true;
    }

    // --- Stage 3: Update the Display if Necessary ---
    // This now only runs if a character was actually added or removed.
    if (inputWasProcessed) {
        updateDisplayText({ user: currentUserInput });
    }
});

// --- Timeline Management ---
function checkTimecodes() {
    if (!currentState.type || !p5Video || p5Video.duration() === 0) return;

    const currentTime = p5Video.time();
    const totalDuration = p5Video.duration();

    if (currentTime >= totalDuration - 0.2) {
        setLoopingState('dim');
        return;
    }

    if (currentState.type === 'loop') {
        const loop = currentState.data;
        if (currentTime < loop.start || currentTime >= loop.end) {
            p5Video.time(loop.start);
        }
    } else if (currentState.type === 'transition') {
        const transition = currentState.data;
        if (currentTime >= transition.end - 0.1) {
            const nextStateName = transition.nextState;
            if (nextStateName) {
                setLoopingState(nextStateName);
            } else {
                p5Video.pause();
            }
        }
    }
}

// --- Aspect Ratio Logic ---
function checkAspectRatio() {
    const aspectRatio = window.innerWidth / window.innerHeight;
    const videoAspectRatio = 16 / 9;
    if (aspectRatio < videoAspectRatio) {
        setCrtEffect(true);
    } else {
        setCrtEffect(false);
    }
}
window.addEventListener('resize', checkAspectRatio);

// --- Initialization Logic ---

// This is the callback for when p5 has the video assets ready.
function onAssetsReady() {
    console.log("Assets loaded. Starting menu loop.");
    setCrtEffect(false);
    setInterval(checkTimecodes, 100);
    setLoopingState('menu'); // Play the silent video loop behind the menu
}

// The button transitions from the menu to the main experience.
startButton.addEventListener('click', () => {
    if (isExperienceStarted) return;
    isExperienceStarted = true;

    console.log("Starting experience from menu.");

    // Fade out the menu overlay
    startMenu.classList.add('hidden');

    // Begin the intro transition
    playTransition('intro');

    // Display the first line of dialogue at the correct time
    setTimeout(() => updateDisplayText({ steve: '...(sigh)' }), 5500);
});

// Final call to initialize p5, using our onAssetsReady callback.
initP5Sketches(
    'p5-video-container',
    'p5-ui-container',
    onAssetsReady
);