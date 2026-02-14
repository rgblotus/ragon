// Shape generator utilities for WebGL particle systems

export type ParticleShape =
    | 'none'
    | 'sphere'
    | 'sparkles'

export interface ParticleData {
    positions: Float32Array
    colors: Float32Array
    sizes: Float32Array
}

/**
 * Generate particles in a leaf-like distribution (random but different pattern)
 */
export function generateLeaf(
    count: number,
    radius: number = 10
): ParticleData {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
        const i3 = i * 3
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)

        // Ellipsoid shape (stretched on one axis)
        positions[i3] = radius * Math.sin(phi) * Math.cos(theta) * 0.6
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 1.2
        positions[i3 + 2] = radius * Math.cos(phi) * 0.6

        colors[i3] = 0.3 + Math.random() * 0.3
        colors[i3 + 1] = 0.5 + Math.random() * 0.4
        colors[i3 + 2] = 0.3 + Math.random() * 0.2

        sizes[i] = Math.random() * 0.1 + 0.05
    }

    return { positions, colors, sizes }
}

/**
 * Generate sparkles - random particles scattered in space
 */
export function generateSparkles(
    count: number,
    spread: number = 15
): ParticleData {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
        const i3 = i * 3

        positions[i3] = (Math.random() - 0.5) * spread
        positions[i3 + 1] = (Math.random() - 0.5) * spread
        positions[i3 + 2] = (Math.random() - 0.5) * spread

        // Sparkle colors - bright white/yellow/gold
        const colorChoice = Math.random()
        if (colorChoice < 0.5) {
            colors[i3] = 1.0
            colors[i3 + 1] = 1.0
            colors[i3 + 2] = 1.0
        } else if (colorChoice < 0.8) {
            colors[i3] = 1.0
            colors[i3 + 1] = 0.9
            colors[i3 + 2] = 0.5
        } else {
            colors[i3] = 0.8
            colors[i3 + 1] = 0.8
            colors[i3 + 2] = 1.0
        }

        sizes[i] = Math.random() * 0.15 + 0.05
    }

    return { positions, colors, sizes }
}

/**
 * Generate particles in a sphere distribution
 */
export function generateSphere(
    count: number,
    radius: number = 10
): ParticleData {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
        const i3 = i * 3
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)

        positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
        positions[i3 + 2] = radius * Math.cos(phi)

        colors[i3] = Math.sin(theta) * 0.5 + 0.5
        colors[i3 + 1] = Math.cos(phi) * 0.5 + 0.5
        colors[i3 + 2] = Math.sin(phi) * 0.5 + 0.5

        sizes[i] = Math.random() * 0.1 + 0.05
    }

    return { positions, colors, sizes }
}

/**
 * Generate particles in a cube distribution
 */
export function generateCube(count: number, size: number = 10): ParticleData {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
        const i3 = i * 3

        positions[i3] = (Math.random() - 0.5) * size
        positions[i3 + 1] = (Math.random() - 0.5) * size
        positions[i3 + 2] = (Math.random() - 0.5) * size

        const x = positions[i3] / size + 0.5
        const y = positions[i3 + 1] / size + 0.5
        const z = positions[i3 + 2] / size + 0.5

        colors[i3] = x
        colors[i3 + 1] = y
        colors[i3 + 2] = z

        sizes[i] = Math.random() * 0.1 + 0.05
    }

    return { positions, colors, sizes }
}

/**
 * Generate particles in a torus distribution
 */
export function generateTorus(
    count: number,
    majorRadius: number = 8,
    minorRadius: number = 3
): ParticleData {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
        const i3 = i * 3
        const u = Math.random() * Math.PI * 2
        const v = Math.random() * Math.PI * 2

        positions[i3] = (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u)
        positions[i3 + 1] =
            (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u)
        positions[i3 + 2] = minorRadius * Math.sin(v)

        colors[i3] = Math.sin(u) * 0.5 + 0.5
        colors[i3 + 1] = Math.cos(v) * 0.5 + 0.5
        colors[i3 + 2] = Math.sin(v) * 0.5 + 0.5

        sizes[i] = Math.random() * 0.1 + 0.05
    }

    return { positions, colors, sizes }
}

/**
 * Generate particles in a helix distribution
 */
export function generateHelix(
    count: number,
    radius: number = 5,
    height: number = 15,
    turns: number = 5
): ParticleData {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
        const i3 = i * 3
        const t = (i / count) * turns * Math.PI * 2
        const y = (i / count - 0.5) * height

        positions[i3] = radius * Math.cos(t)
        positions[i3 + 1] = y
        positions[i3 + 2] = radius * Math.sin(t)

        const hue = i / count
        colors[i3] = Math.sin(hue * Math.PI * 2) * 0.5 + 0.5
        colors[i3 + 1] = Math.cos(hue * Math.PI * 2) * 0.5 + 0.5
        colors[i3 + 2] = Math.sin(hue * Math.PI * 4) * 0.5 + 0.5

        sizes[i] = Math.random() * 0.1 + 0.05
    }

    return { positions, colors, sizes }
}

/**
 * Generate particles in a galaxy/spiral distribution
 */
export function generateGalaxy(
    count: number,
    radius: number = 10,
    arms: number = 3
): ParticleData {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
        const i3 = i * 3
        const r = Math.random() * radius
        const spinAngle = r * 0.5
        const branchAngle = ((i % arms) / arms) * Math.PI * 2

        const angle = branchAngle + spinAngle
        const randomX = (Math.random() - 0.5) * 0.5
        const randomY = (Math.random() - 0.5) * 0.5
        const randomZ = (Math.random() - 0.5) * 0.5

        positions[i3] = Math.cos(angle) * r + randomX
        positions[i3 + 1] = randomY
        positions[i3 + 2] = Math.sin(angle) * r + randomZ

        const intensity = 1 - r / radius
        colors[i3] = intensity * 0.8 + 0.2
        colors[i3 + 1] = intensity * 0.6 + 0.4
        colors[i3 + 2] = intensity

        sizes[i] = Math.random() * 0.15 + 0.05
    }

    return { positions, colors, sizes }
}

/**
 * Generate particles in a wave distribution
 */
export function generateWave(
    count: number,
    width: number = 15,
    amplitude: number = 3
): ParticleData {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    const gridSize = Math.ceil(Math.sqrt(count))

    for (let i = 0; i < count; i++) {
        const i3 = i * 3
        const x = ((i % gridSize) / gridSize - 0.5) * width
        const z = (Math.floor(i / gridSize) / gridSize - 0.5) * width
        const y = Math.sin(x * 0.5) * Math.cos(z * 0.5) * amplitude

        positions[i3] = x
        positions[i3 + 1] = y
        positions[i3 + 2] = z

        const colorValue = (y / amplitude + 1) * 0.5
        colors[i3] = colorValue * 0.5 + 0.5
        colors[i3 + 1] = colorValue
        colors[i3 + 2] = 1 - colorValue * 0.5

        sizes[i] = Math.random() * 0.1 + 0.05
    }

    return { positions, colors, sizes }
}

/**
 * Generate particles with random positions
 */
export function generateRandom(
    count: number,
    spread: number = 15
): ParticleData {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
        const i3 = i * 3

        positions[i3] = (Math.random() - 0.5) * spread
        positions[i3 + 1] = (Math.random() - 0.5) * spread
        positions[i3 + 2] = (Math.random() - 0.5) * spread

        colors[i3] = Math.random()
        colors[i3 + 1] = Math.random()
        colors[i3 + 2] = Math.random()

        sizes[i] = Math.random() * 0.15 + 0.05
    }

    return { positions, colors, sizes }
}

/**
 * Main function to generate particle data based on shape type
 */
export function generateParticleShape(
    shape: ParticleShape,
    count: number
): ParticleData {
    switch (shape) {
        case 'none':
            return {
                positions: new Float32Array(0),
                colors: new Float32Array(0),
                sizes: new Float32Array(0),
            }
        case 'sphere':
            return generateSphere(count)
        case 'sparkles':
            return generateSparkles(count)
        default:
            return generateSphere(count)
    }
}
