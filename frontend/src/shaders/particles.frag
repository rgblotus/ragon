#version 300 es
precision highp float;

in vec3 vColor;
out vec4 outColor;

void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    outColor = vec4(vColor, 1.0);
}
