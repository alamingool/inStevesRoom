precision highp float;
varying vec2 vTexCoord;

uniform sampler2D videoTexture;
uniform vec2 resolution;

const float pixelSize = 5.0;

void main() {
    // --- THE FIX ---
    // Create the same flipped coordinate system here.
    vec2 flippedUv = vec2(vTexCoord.x, 1.0 - vTexCoord.y);

    // Use flippedUv for all subsequent calculations.
    vec2 gridCoords = floor(flippedUv * resolution / pixelSize) * pixelSize / resolution;
    vec3 pixelColor = texture2D(videoTexture, gridCoords).rgb;

    float scanLine = mod(gl_FragCoord.y, 3.0) * 0.1;
    pixelColor *= 1.0 - scanLine;

    vec2 centerDist = flippedUv - 0.5;
    float vignette = 1.0 - dot(centerDist, centerDist) * 0.8;
    pixelColor *= vignette;

    gl_FragColor = vec4(pixelColor, 1.0);
}