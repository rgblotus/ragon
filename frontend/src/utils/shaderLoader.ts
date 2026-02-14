// File: src/utils/shaderLoader.ts

// Import shader sources using Vite's ?raw flag
import particlesVert from '../shaders/particles.vert?raw';
import particlesFrag from '../shaders/particles.frag?raw';


// Utility to remove first line (e.g. "#version 300 es")
function trimFirstLine(source: string): string {
    return source.split('\n').slice(1).join('\n');
}

// Add other shaders here as needed in the future
const shaderSources: Record<string, { vertex: string; fragment: string }> = {
    particles: {
        vertex: trimFirstLine(particlesVert),
        fragment: trimFirstLine(particlesFrag),
    },
};

/**
 * Loads a vertex/fragment shader pair by name.
 * The shader files must be included in `shaderSources`.
 *
 * @param shaderName Name of the shader pair to load (e.g. "particles")
 * @returns Promise resolving to vertexShader and fragmentShader strings
 */
export async function loadShaderPair(shaderName: string): Promise<{
    vertexShader: string;
    fragmentShader: string;
}> {
    const source = shaderSources[shaderName];

    if (!source) {
        throw new Error(`Shader "${shaderName}" not found in shaderLoader.`);
    }

    return {
        vertexShader: source.vertex,
        fragmentShader: source.fragment,
    };
}
