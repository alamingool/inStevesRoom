precision highp float;
varying vec2 vTexCoord;

uniform sampler2D videoTexture;
uniform sampler2D asciiRampTexture; // <-- The new character ramp
uniform vec2 resolution;
uniform float asciiSize;

// We need to know the dimensions of our character ramp texture
const float rampWidth = 10.0; // The ramp has 10 characters

void main() {
    // Flip the Y-coordinate to correct video orientation
    vec2 flippedUv = vec2(vTexCoord.x, 1.0 - vTexCoord.y);

    // 1. Define the "character cell"
    vec2 charCellSize = vec2(asciiSize * (9.0/16.0), asciiSize) / resolution; // Make cells rectangular for monospace look
    vec2 cellUv = floor(flippedUv / charCellSize) * charCellSize;

    // 2. Calculate the average brightness of the cell
    // (We simplify by just taking the brightness of the center pixel)
    float luminance = dot(texture2D(videoTexture, cellUv).rgb, vec3(0.299, 0.587, 0.114));

    // 3. Pick a character from the ramp based on brightness
    // floor(luminance * rampWidth) gives us an index from 0 to 9
    float charIndex = floor(luminance * (rampWidth - 1.0));
    
    // Calculate the texture coordinates within the chosen character tile
    vec2 rampUv = vec2(charIndex / rampWidth, 0.0);

    // This is a simple trick to get the character shape: we sample the ramp
    // If the ramp pixel is bright (part of a character), we use the video's color.
    // If it's dark (background), we stay dark. This isn't perfect ASCII but a great effect.
    // For a more advanced effect, we would map the sub-pixel coordinates.
    // Let's do a simpler, more classic effect:
    
    // --- New, Better Logic ---

    // 3. Map Luminance to a Character Tile
    // A high luminance (bright) should map to a dense character (high UV.x)
    // A low luminance (dark) should map to a sparse character (low UV.x)
    float charIndexLookup = floor(luminance * rampWidth);
    
    // 4. Find the coordinates of the character on the ramp texture
    vec2 subUv = fract(flippedUv / charCellSize); // UVs within the current cell (0.0 to 1.0)
    subUv.x = (subUv.x + charIndexLookup) / rampWidth;

    // 5. Sample the character texture
    float charPixel = texture2D(asciiRampTexture, subUv).r; // Just the red channel is fine

    // Output the color: The video's color multiplied by the character shape
    vec3 finalColor = texture2D(videoTexture, cellUv).rgb * charPixel;

    gl_FragColor = vec4(finalColor, 1.0);
}