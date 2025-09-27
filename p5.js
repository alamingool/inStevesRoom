import p5 from 'p5';
import crtVert from './shaders/crt.vert?raw';
import crtFrag from './shaders/crt.frag?raw';

// --- SHARED STATE ---
const WORD_REVEAL_SPEED = 200;
const COMMA_PAUSE = 300;
const PERIOD_PAUSE = 600;
const ELLIPSIS_DOT_PAUSE = 600;
p5.disableFriendlyErrors = true;
let currentUserText = '';
let fullSteveText = '';
let steveWords = [];
let displayedSteveText = '';
let wordIndex = 0;
let nextWordTimestamp = 0;
let isAnimatingEllipsis = false;
let ellipsisDotsRevealed = 0;
let isCrtActive = false;
let onCompleteCallback = null;

// --- STATE FOR SHAKE EFFECTS ---
const BASE_SHAKE_INTENSITY = 1.5;
const TEXT_SHAKE_INTENSITY = 2;
const BASE_RED_TINT_ALPHA = 10;    // How intense the RED flicker is (0-255)
const BASE_DARKEN_ALPHA = 100;     // How dark the PULSE gets (0-255)
const BASE_FLICKER_RATE = 10;     // Lower is faster. This is a divisor for frameCount.
let currentGiveUpState = 0;
// ------------------------------------

// --- EXPORTED FUNCTIONS for main.js ---
export let p5Video;
export let isSteveSpeaking = false;

export function setCrtEffect(isActive) {
    if (isCrtActive !== isActive) {
        isCrtActive = isActive;
        console.log(`CRT Easter Egg set to: ${isActive}`);
    }
}

// NEW function for main.js to call
export function triggerScreenShake(intensity) {
    screenShakeMagnitude = BASE_SHAKE_INTENSITY * intensity;
    screenShakeStartTime = performance.now(); // Use a high-precision timer
    console.log(`p5.js: Screen shake triggered with magnitude ${screenShakeMagnitude}`);
}

// NEW function for main.js to call
export function setGiveUpState(intensity) {
    currentGiveUpState = intensity;
}

export function updateDisplayText(texts, callback = null) {
    if (texts.user !== undefined) currentUserText = texts.user;
    if (texts.steve !== undefined) {
        fullSteveText = texts.steve.replace(/\.\.\./g, ' ... ');
        steveWords = fullSteveText.split(' ').filter(word => word.length > 0);
        displayedSteveText = '';
        wordIndex = 0;
        nextWordTimestamp = 1;
        isAnimatingEllipsis = false;
        ellipsisDotsRevealed = 0;

        if (steveWords.length > 0) {
            isSteveSpeaking = true;
            onCompleteCallback = callback;
        } else {
            isSteveSpeaking = false;
        }
    }
}

// --- SKETCH 1: THE VIDEO/EFFECTS "STAGE" ---
const videoSketch = (p) => {
    let crtShader;

    function videoReady() { console.log("p5.js reports video is ready."); p5Video.volume(100); p5Video.noLoop(); p5Video.hide(); window.onP5VideoReady(); }
    p.preload = () => { crtShader = p.createShader(crtVert, crtFrag); p5Video = p.createVideo('/room.webm', videoReady); };
    p.setup = () => { p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL); };


    p.draw = () => {
        if (p5Video && p5Video.width > 0) {
            const canvasAspect = p.width / p.height;
            const videoAspect = p5Video.width / p5Video.height;
            let drawWidth, drawHeight;
            if (canvasAspect > videoAspect) { drawWidth = p.width; drawHeight = p.width / videoAspect; } 
            else { drawHeight = p.height; drawWidth = p.height * videoAspect; }

            p.push();

            // --- NEW CONTINUOUS SHAKE LOGIC ---
            // If the "give up" state is active, apply a continuous, random shake
            if (currentGiveUpState > 0) {
                const intensity = BASE_SHAKE_INTENSITY * currentGiveUpState;
                const shakeX = p.random(-intensity, intensity);
                const shakeY = p.random(-intensity, intensity);
                p.translate(shakeX, shakeY);
            }
            // --- END NEW LOGIC ---

            // Step 1: Draw the Video (it will be shaken if the state is active)
            if (isCrtActive) {
                p.shader(crtShader); crtShader.setUniform('videoTexture', p5Video); crtShader.setUniform('resolution', [p.width, p.height]); p.rect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight); p.resetShader();
            } else {
                p.background(0); p.imageMode(p.CENTER); p.image(p5Video, 0, 0, drawWidth, drawHeight);
            }

            // Step 2: Draw the overlays, which are also now continuous
            if (currentGiveUpState > 0) {
                // Darken Overlay (no pulse, just a constant oppression)
                p.fill(0, 0, 0, BASE_DARKEN_ALPHA * currentGiveUpState);
                p.noStroke();
                p.rect(-p.width, -p.height, p.width * 2, p.height * 2);

                // Red Flicker Overlay
                const flickerRate = Math.max(2, BASE_FLICKER_RATE - currentGiveUpState);
                if (p.frameCount % flickerRate < flickerRate / 2) {
                    p.fill(255, 0, 0, BASE_RED_TINT_ALPHA * currentGiveUpState);
                    p.noStroke();
                    p.rect(-p.width, -p.height, p.width * 2, p.height * 2);
                }
            }

            p.pop();

        } else {
            p.background(0);
        }
    };

    p.windowResized = () => { p.resizeCanvas(p.windowWidth, p.windowHeight); };
};


// --- SKETCH 2: THE 2D TEXT "UI" ---
const uiSketch = (p) => {
    let textGraphics;

    p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
        textGraphics = p.createGraphics(p.windowWidth, p.windowHeight);
    };

    p.draw = () => {
        p.clear();
        updateAndDrawText(textGraphics, p);
        p.image(textGraphics, 0, 0);
    };
    
    p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        textGraphics.resizeCanvas(p.windowWidth, p.windowHeight);
    };
};


// --- MAIN INITIALIZER ---
export function initP5Sketches(videoParentId, uiParentId, onReadyCallback) {
    window.onP5VideoReady = onReadyCallback;
    new p5(videoSketch, document.getElementById(videoParentId));
    new p5(uiSketch, document.getElementById(uiParentId));
}

// --- HELPER FUNCTIONS ---
function updateAndDrawText(tg, p) {
    tg.clear();
    
    // --- TYPEWRITER LOGIC (Handles revealing text over time) ---
    if (nextWordTimestamp === 1 && steveWords.length > 0) { nextWordTimestamp = p.millis() + WORD_REVEAL_SPEED; }
    if (isSteveSpeaking && wordIndex < steveWords.length && p.millis() > nextWordTimestamp) {
        const currentWord = steveWords[wordIndex];
        if (currentWord === "...") {
            if (!isAnimatingEllipsis) { isAnimatingEllipsis = true; ellipsisDotsRevealed = 0; if (displayedSteveText.length > 0) { displayedSteveText += ' '; } }
            if (ellipsisDotsRevealed < 3) { displayedSteveText += "."; ellipsisDotsRevealed++; nextWordTimestamp = p.millis() + ELLIPSIS_DOT_PAUSE; }
            if (ellipsisDotsRevealed >= 3) { isAnimatingEllipsis = false; wordIndex++; nextWordTimestamp = p.millis() + WORD_REVEAL_SPEED; }
        } else {
            displayedSteveText = steveWords.slice(0, wordIndex + 1).join(' ');
            let delay = WORD_REVEAL_SPEED;
            if (currentWord.endsWith(',')) { delay += COMMA_PAUSE; } else if (currentWord.endsWith('.') || currentWord.endsWith('!') || currentWord.endsWith('?')) { delay += PERIOD_PAUSE; }
            nextWordTimestamp = p.millis() + delay;
            wordIndex++;
        }
    }
    if (isSteveSpeaking && wordIndex >= steveWords.length) {
        isSteveSpeaking = false;
        if (onCompleteCallback) {
            console.log("p5.js: Steve finished speaking, firing callback.");
            onCompleteCallback();
            onCompleteCallback = null;
        }
    }

    // --- DRAWING LOGIC (Handles where and how to draw the text) ---
    let steveX = tg.width * 0.1;
    let steveY = tg.height * 0.9;
    const userX = tg.width * 0.9;
    const userY = tg.height * 0.9;

    // --- TEXT SHAKE LOGIC ---
    // If we're in the "give up" state, apply a shake to Steve's text box position
    if (currentGiveUpState > 0) {
        const intensity = TEXT_SHAKE_INTENSITY * currentGiveUpState;
        steveX += p.random(-intensity, intensity);
        steveY += p.random(-intensity, intensity);
    }
    
    if (displayedSteveText) {
        drawDiegeticText(tg, displayedSteveText, steveX, steveY, 'left');
    }
    if (currentUserText) {
        drawDiegeticText(tg, currentUserText, userX, userY, 'right');
    }
}

// --- SIMPLER and MORE RELIABLE drawDiegeticText function ---
function drawDiegeticText(tg, textContent, x, y_bottom, align) {
    const maxWidth = tg.width * 0.35;
    const fontSize = 20;
    const padding = 12;

    tg.textFont('IBM Plex Mono');
    tg.textSize(fontSize);
    tg.textWrap(tg.WORD);

    const lines = Math.ceil(tg.textWidth(textContent) / maxWidth) || 1;
    const textH = tg.textAscent() + tg.textDescent();
    const boxHeight = (textH * lines) + (padding * 2);
    const boxWidth = Math.min(tg.textWidth(textContent), maxWidth) + padding * 2;
    const boxY = y_bottom - boxHeight;
    const boxX = (align === 'right') ? x - boxWidth : x;

    tg.fill(0, 0, 0, 190);
    tg.noStroke();
    tg.rect(boxX, boxY, boxWidth, boxHeight);

    tg.fill(255);
    tg.textAlign(tg.LEFT, tg.TOP);
    tg.text(textContent, boxX + padding, boxY + padding, maxWidth);
}