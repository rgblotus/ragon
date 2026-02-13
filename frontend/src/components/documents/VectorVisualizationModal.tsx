import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three-stdlib'
import {
    Eye,
    Info,
    RotateCcw,
    Play,
    Pause,
    Maximize2,
    Download,
    Filter,
    Grid3X3,
    Target,
    AlertCircle,
    Box,
    Circle,
    Activity,
    Settings,
    RefreshCw,
    EyeOff,
    Sparkles,
    TrendingUp,
    Database,
    ZoomIn,
} from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import type { Document, Collection } from '../../types/api'
import { api } from '../../services/api'

interface VectorVisualizationModalProps {
    document: Document
    collection: Collection | null
    onClose: () => void
    onShowDocumentDetails: () => void
}

interface VectorPoint {
    position: THREE.Vector3
    color: THREE.Color
    metadata: {
        index: number
        similarity?: number
        cluster?: number
        originalIndex?: number
    }
}

interface Cluster {
    id: number
    color: THREE.Color
    points: VectorPoint[]
    center: THREE.Vector3
    size: number
}

type VisualizationMode = 'points' | 'spheres' | 'connection' | 'heatmap' | 'clusters'

const VectorVisualizationModal: React.FC<VectorVisualizationModalProps> = ({
    document,
    collection,
    onClose,
    onShowDocumentDetails,
}) => {
    const mountRef = useRef<HTMLDivElement>(null)
    const sceneRef = useRef<THREE.Scene | null>(null)
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
    const controlsRef = useRef<OrbitControls | null>(null)
    const pointsRef = useRef<THREE.Points | null>(null)
    const spheresRef = useRef<THREE.InstancedMesh | null>(null)
    const connectionsRef = useRef<THREE.LineSegments | null>(null)
    const pointsGroupRef = useRef<THREE.Group | null>(null)
    const animationRef = useRef<number | null>(null)
    const raycasterRef = useRef<THREE.Raycaster | null>(null)
    const selectedPointRef = useRef<THREE.Object3D | null>(null)
    const hoverTooltipRef = useRef<HTMLDivElement | null>(null)
    const frameCountRef = useRef(0)
    const lastTimeRef = useRef(0)
    const userInteractingRef = useRef(false)

    const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('points')
    const [pointSize, setPointSize] = useState(0.02)
    const [sphereSize, setSphereSize] = useState(0.05)
    const [connectionThreshold, setConnectionThreshold] = useState(0.85)
    const [isAnimating, setIsAnimating] = useState(true)
    const [showAxes, setShowAxes] = useState(true)
    const [showGrid, setShowGrid] = useState(true)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [selectedPoint, setSelectedPoint] = useState<VectorPoint | null>(null)
    const [hoveredPoint, setHoveredPoint] = useState<VectorPoint | null>(null)
    const [fps, setFps] = useState(0)

    const [minSimilarity, setMinSimilarity] = useState(0)
    const [maxSimilarity, setMaxSimilarity] = useState(1)

    const [vectorData, setVectorData] = useState<{
        points: Float32Array
        colors: Float32Array
        count: number
        vectorPoints: VectorPoint[]
        clusters: Cluster[]
        connections: Float32Array
    }>({
        points: new Float32Array(),
        colors: new Float32Array(),
        count: 0,
        vectorPoints: [],
        clusters: [],
        connections: new Float32Array(),
    })
    const [isLoadingVectors, setIsLoadingVectors] = useState(false)
    const [vectorError, setVectorError] = useState<string | null>(null)
    const [autoRotate, setAutoRotate] = useState(true)
    const rotateSpeedRef = useRef(0.5)

    const filteredVectorData = useMemo(() => {
        if (!vectorData.vectorPoints.length) return vectorData

        const filtered = vectorData.vectorPoints.filter((point) => {
            const similarity = point.metadata.similarity || 0

            if (similarity < minSimilarity || similarity > maxSimilarity) {
                return false
            }

            return true
        })

        const points: number[] = []
        const colors: number[] = []

        filtered.forEach((point) => {
            points.push(point.position.x, point.position.y, point.position.z)
            colors.push(point.color.r, point.color.g, point.color.b)
        })

        const connections = new Float32Array()
        if (filtered.length > 1 && visualizationMode === 'connection') {
            const connectionPositions: number[] = []
            const similarityThreshold = connectionThreshold
            const maxConnections = 5000

            for (let i = 0; i < Math.min(filtered.length, 200); i++) {
                let connectionCount = 0
                for (let j = i + 1; j < Math.min(filtered.length, 200); j++) {
                    if (connectionCount > maxConnections / 200) break

                    const dist = filtered[i].position.distanceTo(filtered[j].position)
                    const sim1 = filtered[i].metadata.similarity || 0
                    const sim2 = filtered[j].metadata.similarity || 0
                    const avgSim = (sim1 + sim2) / 2

                    if (avgSim > similarityThreshold && dist < 3) {
                        connectionPositions.push(
                            filtered[i].position.x, filtered[i].position.y, filtered[i].position.z,
                            filtered[j].position.x, filtered[j].position.y, filtered[j].position.z
                        )
                        connectionCount++
                    }
                }
            }
        }

        return {
            ...vectorData,
            points: new Float32Array(points),
            colors: new Float32Array(colors),
            count: filtered.length,
            vectorPoints: filtered,
            connections,
        }
    }, [vectorData, minSimilarity, maxSimilarity, connectionThreshold, visualizationMode])

    useEffect(() => {
        if (!document.processed) {
            setVectorData({
                points: new Float32Array(),
                colors: new Float32Array(),
                count: 0,
                vectorPoints: [],
                clusters: [],
                connections: new Float32Array(),
            })
            setVectorError(null)
            return
        }

        const fetchVectors = async () => {
            setIsLoadingVectors(true)
            setVectorError(null)
            try {
                const response = await api.get<Record<string, unknown>>(
                    `/documents/${document.id}/vectors`,
                )
                const data = response as { vectorPoints: Array<{ position: { x: number; y: number; z: number }; color?: { r: number; g: number; b: number }; metadata?: { similarity?: number; cluster?: number; originalIndex?: number } }>; points?: number[]; colors?: number[]; count?: number }
                const vectorPointsData = data.vectorPoints || []

                const vectorPoints: VectorPoint[] = vectorPointsData.map(
                    (vp, index) => {
                        const similarity = vp.metadata?.similarity || 0
                        const cluster = vp.metadata?.cluster || 0

                        const pointColor = new THREE.Color()
                        if (visualizationMode === 'heatmap') {
                            const hue = (1 - similarity) * 0.7
                            pointColor.setHSL(hue, 0.8, 0.5)
                        } else if (vp.color && visualizationMode !== 'clusters') {
                            pointColor.setRGB(vp.color.r, vp.color.g, vp.color.b)
                        } else {
                            const hue = (cluster * 0.3) % 1
                            pointColor.setHSL(hue, 0.7, 0.5)
                        }

                        return {
                            position: new THREE.Vector3(
                                vp.position.x,
                                vp.position.y,
                                vp.position.z,
                            ),
                            color: pointColor,
                            metadata: {
                                index,
                                similarity,
                                cluster,
                                originalIndex: vp.metadata?.originalIndex || index,
                            },
                        }
                    },
                )

                const clusters: Cluster[] = []
                const clusterMap = new Map<number, VectorPoint[]>()
                vectorPoints.forEach((point) => {
                    const clusterId = point.metadata.cluster || 0
                    if (!clusterMap.has(clusterId)) {
                        clusterMap.set(clusterId, [])
                    }
                    clusterMap.get(clusterId)!.push(point)
                })

                clusterMap.forEach((points, id) => {
                    const center = new THREE.Vector3()
                    points.forEach((p) => center.add(p.position))
                    center.divideScalar(points.length)

                    const hue = (Number(id) * 0.3) % 1
                    const color = new THREE.Color().setHSL(hue, 0.7, 0.5)

                    clusters.push({
                        id: Number(id),
                        color,
                        points,
                        center,
                        size: points.length,
                    })
                })

                setVectorData({
                    points: new Float32Array(data.points || []),
                    colors: new Float32Array(data.colors || []),
                    count: data.count || 0,
                    vectorPoints,
                    clusters,
                    connections: new Float32Array(),
                })
            } catch (error: unknown) {
                console.error('Failed to fetch vector data:', error)
                const err = error as { detail?: string }
                setVectorError(err.detail || 'Failed to load vector data')
                setVectorData({
                    points: new Float32Array(),
                    colors: new Float32Array(),
                    count: 0,
                    vectorPoints: [],
                    clusters: [],
                    connections: new Float32Array(),
                })
            } finally {
                setIsLoadingVectors(false)
            }
        }

        fetchVectors()
    }, [document.id, document.processed, visualizationMode])

    const createVisualization = useCallback(() => {
        if (!mountRef.current || !filteredVectorData.count) return

        const mount = mountRef.current
        const width = mount.clientWidth
        const height = mount.clientHeight

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0f172a)
        scene.fog = new THREE.Fog(0x0f172a, 15, 60)
        sceneRef.current = scene

        const camera = new THREE.PerspectiveCamera(
            60,
            width / height,
            0.1,
            200,
        )
        camera.position.set(10, 8, 10)
        camera.lookAt(0, 0, 0)
        cameraRef.current = camera

        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
        })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.0
        renderer.outputColorSpace = THREE.SRGBColorSpace
        mount.appendChild(renderer.domElement)
        rendererRef.current = renderer

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.05
        controls.minDistance = 3
        controls.maxDistance = 80
        controls.maxPolarAngle = Math.PI * 0.9
        controls.autoRotate = autoRotate
        controls.autoRotateSpeed = rotateSpeedRef.current
        controlsRef.current = controls

        const raycaster = new THREE.Raycaster()
        raycasterRef.current = raycaster

        if (showAxes) {
            const axesHelper = new THREE.AxesHelper(5)
            const axesMaterial = axesHelper.material as THREE.LineBasicMaterial
            axesMaterial.transparent = true
            axesMaterial.opacity = 0.5
            scene.add(axesHelper)
        }

        if (showGrid) {
            const gridHelper = new THREE.GridHelper(15, 30, 0x3b82f6, 0x1e293b)
            gridHelper.material.transparent = true
            gridHelper.material.opacity = 0.3
            scene.add(gridHelper)
        }

        const pointsGroup = new THREE.Group()
        scene.add(pointsGroup)
        pointsGroupRef.current = pointsGroup

        if (visualizationMode === 'points' || visualizationMode === 'heatmap') {
            const geometry = new THREE.BufferGeometry()
            geometry.setAttribute(
                'position',
                new THREE.BufferAttribute(filteredVectorData.points, 3),
            )
            geometry.setAttribute(
                'color',
                new THREE.BufferAttribute(filteredVectorData.colors, 3),
            )
            geometry.userData = { vectorPoints: filteredVectorData.vectorPoints }

            const material = new THREE.PointsMaterial({
                size: pointSize * 5,
                vertexColors: true,
                transparent: true,
                opacity: 0.85,
                sizeAttenuation: true,
                depthWrite: false,
            })

            const points = new THREE.Points(geometry, material)
            points.userData = { type: 'vectorPoints' }
            pointsGroup.add(points)
            pointsRef.current = points
        }

        if (visualizationMode === 'clusters') {
            const geometry = new THREE.BufferGeometry()
            geometry.setAttribute(
                'position',
                new THREE.BufferAttribute(filteredVectorData.points, 3),
            )
            geometry.setAttribute(
                'color',
                new THREE.BufferAttribute(filteredVectorData.colors, 3),
            )
            geometry.userData = { vectorPoints: filteredVectorData.vectorPoints }

            const material = new THREE.PointsMaterial({
                size: pointSize * 6,
                vertexColors: true,
                transparent: true,
                opacity: 0.9,
                sizeAttenuation: true,
                depthWrite: false,
            })

            const points = new THREE.Points(geometry, material)
            points.userData = { type: 'vectorPoints' }
            pointsGroup.add(points)
            pointsRef.current = points
        }

        if (visualizationMode === 'spheres') {
            const sphereGeometry = new THREE.SphereGeometry(sphereSize, 12, 8)
            const material = new THREE.MeshPhongMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0.9,
                shininess: 100,
            })

            const instancedMesh = new THREE.InstancedMesh(
                sphereGeometry,
                material,
                filteredVectorData.count,
            )

            const tempObject = new THREE.Object3D()

            for (let i = 0; i < filteredVectorData.count; i++) {
                const point = filteredVectorData.vectorPoints[i]
                tempObject.position.copy(point.position)
                tempObject.updateMatrix()
                instancedMesh.setMatrixAt(i, tempObject.matrix)
                instancedMesh.setColorAt(i, point.color)
            }

            instancedMesh.instanceMatrix.needsUpdate = true
            instancedMesh.instanceColor!.needsUpdate = true
            instancedMesh.userData = { type: 'instancedSpheres' }
            pointsGroup.add(instancedMesh)
            spheresRef.current = instancedMesh
        }

        if (visualizationMode === 'connection' && filteredVectorData.connections.length > 0) {
            const pointsMaterial = new THREE.PointsMaterial({
                size: pointSize * 3,
                vertexColors: true,
                transparent: true,
                opacity: 0.9,
                sizeAttenuation: true,
                depthWrite: false,
            })
            const pointsGeometry = new THREE.BufferGeometry()
            pointsGeometry.setAttribute(
                'position',
                new THREE.BufferAttribute(filteredVectorData.points, 3),
            )
            pointsGeometry.setAttribute(
                'color',
                new THREE.BufferAttribute(filteredVectorData.colors, 3),
            )
            const points = new THREE.Points(pointsGeometry, pointsMaterial)
            pointsGroup.add(points)
            pointsRef.current = points

            const lineGeometry = new THREE.BufferGeometry()
            lineGeometry.setAttribute(
                'position',
                new THREE.BufferAttribute(filteredVectorData.connections, 3),
            )
            const lineMaterial = new THREE.LineBasicMaterial({
                color: 0x6366f1,
                transparent: true,
                opacity: 0.3,
                depthWrite: false,
            })
            const connections = new THREE.LineSegments(lineGeometry, lineMaterial)
            connections.userData = { type: 'connections' }
            pointsGroup.add(connections)
            connectionsRef.current = connections
        }

        const ambientLight = new THREE.AmbientLight(0x6366f1, 0.4)
        scene.add(ambientLight)

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(10, 15, 10)
        scene.add(directionalLight)

        const pointLight1 = new THREE.PointLight(0x8b5cf6, 0.6, 30)
        pointLight1.position.set(-10, 10, 10)
        scene.add(pointLight1)

        const pointLight2 = new THREE.PointLight(0x06b6d4, 0.4, 25)
        pointLight2.position.set(10, -8, -10)
        scene.add(pointLight2)

        const tooltip = mount.ownerDocument.createElement('div')
        tooltip.style.cssText = `
            position: absolute;
            background: rgba(15, 23, 42, 0.95);
            color: #e2e8f0;
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 12px;
            pointer-events: none;
            z-index: 1000;
            border: 1px solid rgba(99, 102, 241, 0.3);
            display: none;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(8px);
        `
        mount.appendChild(tooltip)
        hoverTooltipRef.current = tooltip

        const mouse = new THREE.Vector2()
        let hoveredIntersect: THREE.Intersection | null = null

        const onMouseDown = () => { userInteractingRef.current = true }
        const onMouseUp = () => { setTimeout(() => { userInteractingRef.current = false }, 800) }

        const onMouseMove = (event: MouseEvent) => {
            if (!mount) return

            const rect = mount.getBoundingClientRect()
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

            if (raycaster) {
                raycaster.setFromCamera(mouse, camera)

                let intersects: THREE.Intersection[] = []
                if (pointsRef.current) {
                    intersects = raycaster.intersectObject(pointsRef.current)
                } else if (spheresRef.current) {
                    intersects = raycaster.intersectObject(spheresRef.current)
                }

                if (intersects.length > 0) {
                    hoveredIntersect = intersects[0]
                    const index = hoveredIntersect.index

                    if (index !== undefined && filteredVectorData.vectorPoints[index]) {
                        const vectorPoint = filteredVectorData.vectorPoints[index]
                        setHoveredPoint(vectorPoint)

                        if (tooltip) {
                            const similarityPercent = ((vectorPoint.metadata.similarity || 0) * 100).toFixed(1)

                            tooltip.innerHTML = `
                                <div style="font-weight: 600; margin-bottom: 6px; color: #a5b4fc;">
                                    Vector Point #${index}
                                </div>
                                <div style="display: grid; gap: 4px;">
                                    <div><span style="color: #94a3b8;">Similarity:</span> <span style="color: ${vectorPoint.metadata.similarity > 0.8 ? '#4ade80' : '#fbbf24'}">${similarityPercent}%</span></div>
                                    <div style="color: #64748b; font-size: 11px; margin-top: 4px;">
                                        Position: (${vectorPoint.position.x.toFixed(2)}, ${vectorPoint.position.y.toFixed(2)}, ${vectorPoint.position.z.toFixed(2)})
                                    </div>
                                </div>
                            `
                            tooltip.style.display = 'block'

                            const modalRect = mount.getBoundingClientRect()
                            tooltip.style.left = `${event.clientX - modalRect.left + 15}px`
                            tooltip.style.top = `${event.clientY - modalRect.top - 10}px`
                        }
                    }
                } else {
                    hoveredIntersect = null
                    setHoveredPoint(null)
                    if (tooltip) tooltip.style.display = 'none'
                }
            }
        }

        const onClick = (event: MouseEvent) => {
            if (!mount || !raycaster) return

            const rect = mount.getBoundingClientRect()
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

            raycaster.setFromCamera(mouse, camera)

            let intersects: THREE.Intersection[] = []
            if (pointsRef.current) {
                intersects = raycaster.intersectObject(pointsRef.current)
            } else if (spheresRef.current) {
                intersects = raycaster.intersectObject(spheresRef.current)
            }

            if (intersects.length > 0) {
                const index = intersects[0].index
                if (index !== undefined && filteredVectorData.vectorPoints[index]) {
                    const vectorPoint = filteredVectorData.vectorPoints[index]
                    setSelectedPoint(vectorPoint)

                    if (selectedPointRef.current) {
                        scene.remove(selectedPointRef.current)
                    }

                    const highlightGeometry = new THREE.SphereGeometry(sphereSize * 2.5, 16, 16)
                    const highlightMaterial = new THREE.MeshBasicMaterial({
                        color: 0xfbbf24,
                        transparent: true,
                        opacity: 0.9,
                        side: THREE.DoubleSide,
                    })
                    const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial)
                    highlight.position.copy(vectorPoint.position)

                    const glowGeometry = new THREE.SphereGeometry(sphereSize * 4, 16, 16)
                    const glowMaterial = new THREE.MeshBasicMaterial({
                        color: 0xfbbf24,
                        transparent: true,
                        opacity: 0.15,
                    })
                    const glow = new THREE.Mesh(glowGeometry, glowMaterial)
                    highlight.add(glow)

                    scene.add(highlight)
                    selectedPointRef.current = highlight
                }
            } else {
                setSelectedPoint(null)
                if (selectedPointRef.current) {
                    scene.remove(selectedPointRef.current)
                    selectedPointRef.current = null
                }
            }
        }

        const onWheel = (event: WheelEvent) => {
            event.preventDefault()
            const delta = event.deltaY * 0.001
            const distance = camera.position.length()
            const newDistance = Math.max(3, Math.min(80, distance + delta * distance))
            camera.position.normalize().multiplyScalar(newDistance)
        }

        renderer.domElement.addEventListener('mousedown', onMouseDown)
        renderer.domElement.addEventListener('mouseup', onMouseUp)
        renderer.domElement.addEventListener('mousemove', onMouseMove)
        renderer.domElement.addEventListener('click', onClick)
        renderer.domElement.addEventListener('wheel', onWheel)

        const animate = () => {
            frameCountRef.current++
            const currentTime = performance.now()

            if (currentTime - lastTimeRef.current >= 1000) {
                setFps(frameCountRef.current)
                frameCountRef.current = 0
                lastTimeRef.current = currentTime
            }

            controls.update()

            if (selectedPointRef.current) {
                selectedPointRef.current.rotation.y += 0.02
            }

            renderer.render(scene, camera)
            animationRef.current = requestAnimationFrame(animate)
        }
        animate()

        const handleResize = () => {
            if (!mount || !camera || !renderer) return
            const newWidth = mount.clientWidth
            const newHeight = mount.clientHeight
            camera.aspect = newWidth / newHeight
            camera.updateProjectionMatrix()
            renderer.setSize(newWidth, newHeight)
        }

        window.addEventListener('resize', handleResize)

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current)
            }
            window.removeEventListener('resize', handleResize)
            renderer.domElement.removeEventListener('mousedown', onMouseDown)
            renderer.domElement.removeEventListener('mouseup', onMouseUp)
            renderer.domElement.removeEventListener('mousemove', onMouseMove)
            renderer.domElement.removeEventListener('click', onClick)
            renderer.domElement.removeEventListener('wheel', onWheel)

            if (mount.contains(renderer.domElement)) {
                mount.removeChild(renderer.domElement)
            }
            renderer.dispose()
        }
    }, [filteredVectorData, pointSize, sphereSize, visualizationMode, showAxes, showGrid, autoRotate, connectionThreshold])

    useEffect(() => {
        if (!mountRef.current || !filteredVectorData.count) return
        const cleanup = createVisualization()
        return cleanup
    }, [createVisualization, filteredVectorData.count])

    const resetCamera = useCallback(() => {
        if (cameraRef.current) {
            cameraRef.current.position.set(10, 8, 10)
            cameraRef.current.lookAt(0, 0, 0)
            if (controlsRef.current) {
                controlsRef.current.reset()
            }
        }
    }, [])

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen)
    }

    const takeScreenshot = () => {
        if (!rendererRef.current || !mountRef.current) return

        const canvas = rendererRef.current.domElement
        const link = mountRef.current.ownerDocument!.createElement('a')
        link.download = `vector-visualization-${Date.now()}.png`
        link.href = canvas.toDataURL()
        link.click()
    }

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 ${isFullscreen ? 'bg-slate-900' : ''}`}>
            <div className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm ${isFullscreen ? 'pointer-events-none' : ''}`} onClick={!isFullscreen ? onClose : undefined} />
            <div className={`relative w-full ${isFullscreen ? 'max-w-[98vw] max-h-[98vh]' : 'max-w-sm md:max-w-5xl lg:max-w-7xl max-h-[80vh]'} animate-scale-in`}>
                <Card className={`${isFullscreen ? 'h-[96vh]' : 'max-h-[80vh]'} border-slate-700 shadow-2xl bg-slate-900 overflow-hidden`}>
                    <div className="flex flex-col h-full">
                        <div className="flex items-center gap-3 pb-3 border-b border-slate-700 flex-shrink-0">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center border border-purple-400/30">
                                <Eye className="text-white" size={20} />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-white">3D Vector Space</h2>
                                <p className="text-xs text-slate-400">
                                    Interactive visualization of {filteredVectorData.count} embeddings • <span className="text-emerald-400">{fps} FPS</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsAnimating(!isAnimating)} className={`p-2 rounded-lg transition-all ${isAnimating ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`} title={isAnimating ? 'Pause' : 'Play'}>
                                    {isAnimating ? <Pause size={18} /> : <Play size={18} />}
                                </button>
                                <button onClick={resetCamera} className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all" title="Reset Camera">
                                    <RotateCcw size={18} />
                                </button>
                                <button onClick={toggleFullscreen} className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all" title="Fullscreen">
                                    <Maximize2 size={18} />
                                </button>
                                <button onClick={takeScreenshot} className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all" title="Download Screenshot">
                                    <Download size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-1 xl:grid xl:grid-cols-9 flex-1 gap-4">
                            <div className="xl:col-span-3 xl:order-1 order-2 flex flex-col h-[45vh] md:h-[50vh] xl:h-[55vh]">
                                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 mb-3">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Settings size={14} className="text-purple-400" />
                                        <span className="text-xs font-semibold text-slate-300">Visualization Mode</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { mode: 'points', icon: Circle, label: 'Points' },
                                            { mode: 'spheres', icon: Box, label: 'Spheres' },
                                            { mode: 'connection', icon: Activity, label: 'Network' },
                                            { mode: 'heatmap', icon: TrendingUp, label: 'Heatmap' },
                                            { mode: 'clusters', icon: Filter, label: 'Clusters', colSpan: true },
                                        ].map(({ mode, icon: Icon, label, colSpan }) => (
                                            <button key={mode} onClick={() => setVisualizationMode(mode as VisualizationMode)} className={`p-2 rounded-lg flex items-center gap-1 transition-all ${visualizationMode === mode ? 'bg-purple-500/20 border border-purple-500/50 text-purple-300' : 'bg-slate-700/50 border border-transparent text-slate-400 hover:bg-slate-700'} ${colSpan ? 'col-span-2' : ''}`}>
                                                <Icon size={16} />
                                                <span className="text-[10px]">{label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 mb-3">
                                    <div className="flex items-center gap-2 mb-3">
                                        <ZoomIn size={14} className="text-blue-400" />
                                        <span className="text-xs font-semibold text-slate-300">Size Controls</span>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                                <span>Point Size</span>
                                                <span className="text-blue-400">{pointSize.toFixed(3)}</span>
                                            </div>
                                            <input type="range" min="0.005" max="0.08" step="0.005" value={pointSize} onChange={(e) => setPointSize(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-blue" />
                                        </div>
                                        {visualizationMode === 'spheres' && (
                                            <div>
                                                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                                    <span>Sphere Size</span>
                                                    <span className="text-emerald-400">{sphereSize.toFixed(3)}</span>
                                                </div>
                                                <input type="range" min="0.02" max="0.15" step="0.01" value={sphereSize} onChange={(e) => setSphereSize(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-emerald" />
                                            </div>
                                        )}
                                        {visualizationMode === 'connection' && (
                                            <div>
                                                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                                    <span>Connection Threshold</span>
                                                    <span className="text-amber-400">{(connectionThreshold * 100).toFixed(0)}%</span>
                                                </div>
                                                <input type="range" min="0.5" max="0.98" step="0.02" value={connectionThreshold} onChange={(e) => setConnectionThreshold(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-amber" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 mb-3">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Filter size={14} className="text-amber-400" />
                                        <span className="text-xs font-semibold text-slate-300">Filters</span>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                                <span>Min Similarity</span>
                                                <span className="text-emerald-400">{(minSimilarity * 100).toFixed(0)}%</span>
                                            </div>
                                            <input type="range" min="0" max="1" step="0.05" value={minSimilarity} onChange={(e) => setMinSimilarity(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-emerald" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                                <span>Max Similarity</span>
                                                <span className="text-amber-400">{(maxSimilarity * 100).toFixed(0)}%</span>
                                            </div>
                                            <input type="range" min="0" max="1" step="0.05" value={maxSimilarity} onChange={(e) => setMaxSimilarity(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-amber" />
                                        </div>

                                        <button onClick={() => { setMinSimilarity(0); setMaxSimilarity(1); }} className="w-full p-2 rounded-lg text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all flex items-center justify-center gap-1">
                                            <RefreshCw size={12} /> Reset All
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 mb-3">
                                    <div className="flex items-center gap-2 mb-3">
                                        <EyeOff size={14} className="text-cyan-400" />
                                        <span className="text-xs font-semibold text-slate-300">Display Options</span>
                                    </div>
                                    <div className="space-y-2">
                                        <button onClick={() => setShowAxes(!showAxes)} className={`w-full p-2 rounded-lg text-xs flex items-center gap-2 transition-all ${showAxes ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-700 text-slate-400'}`}>
                                            <Target size={14} /> {showAxes ? 'Hide Axes' : 'Show Axes'}
                                        </button>
                                        <button onClick={() => setShowGrid(!showGrid)} className={`w-full p-2 rounded-lg text-xs flex items-center gap-2 transition-all ${showGrid ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-400'}`}>
                                            <Grid3X3 size={14} /> {showGrid ? 'Hide Grid' : 'Show Grid'}
                                        </button>
                                        <button onClick={() => setAutoRotate(!autoRotate)} className={`w-full p-2 rounded-lg text-xs flex items-center gap-2 transition-all ${autoRotate ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                                            <RotateCcw size={14} /> {autoRotate ? 'Auto-Rotate ON' : 'Auto-Rotate OFF'}
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 rounded-xl p-3 border border-purple-500/20 mb-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Sparkles size={14} className="text-purple-400" />
                                        <span className="text-xs font-semibold text-purple-300">Statistics</span>
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Total Vectors</span>
                                            <span className="text-white font-medium">{vectorData.count}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Filtered</span>
                                            <span className="text-emerald-400 font-medium">{filteredVectorData.count}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Dimensions</span>
                                            <span className="text-blue-400 font-medium">384</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">FPS</span>
                                            <span className="text-amber-400 font-medium">{fps}</span>
                                        </div>
                                        {selectedPoint && (
                                            <div className="pt-2 border-t border-purple-500/20 mt-2">
                                                <div className="text-purple-300 mb-1">Selected Point</div>
                                                <div className="space-y-1 text-[10px]">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Similarity</span>
                                                        <span className="text-emerald-400">{((selectedPoint.metadata.similarity || 0) * 100).toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 mb-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Database size={14} className="text-cyan-400" />
                                        <span className="text-xs font-semibold text-slate-300">Document Info</span>
                                    </div>
                                    <div className="text-xs text-slate-400 truncate">
                                        <div className="text-slate-200 font-medium truncate">{document.filename}</div>
                                        <div className="truncate">{collection?.name || 'No collection'}</div>
                                    </div>
                                </div>


                            </div>
                            </div>

                            <div className="xl:col-span-6 xl:order-2 order-1 flex flex-col">
                                <div className={`${isFullscreen ? 'h-full' : 'h-[45vh] md:h-[50vh] xl:h-[55vh]'} bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl border border-slate-700 relative overflow-hidden shadow-inner flex-shrink-0`}>
                                    <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

                                    <div className="absolute top-3 left-3 flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-xs">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-slate-300 font-medium">3D Vector Space</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 ml-4">{isAnimating ? 'Auto-rotating' : 'Drag to rotate'} • Scroll to zoom</span>
                                    </div>

                                    <div className="absolute top-3 right-3 flex items-center gap-2">
                                        <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg px-2 py-1 border border-slate-600">
                                            <span className="text-[10px] text-slate-300">{filteredVectorData.count.toLocaleString()} vectors</span>
                                        </div>
                                        {hoveredPoint && (
                                            <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg px-2 py-1 border border-purple-500/30">
                                                <span className="text-[10px] text-purple-300">#{hoveredPoint.metadata.index}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="absolute bottom-3 right-3">
                                        {visualizationMode === 'heatmap' ? (
                                            <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-2 border border-slate-600">
                                                <div className="text-[10px] text-slate-300 font-medium mb-1.5 text-center">Similarity</div>
                                                <div className="w-24 h-3 rounded-md bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 mb-1" />
                                                <div className="flex justify-between text-[9px] text-slate-400">
                                                    <span>0%</span>
                                                    <span>100%</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-2 border border-slate-600">
                                                <div className="text-[10px] text-slate-300 font-medium mb-1.5 text-center">Cluster Colors</div>
                                                <div className="w-24 h-3 rounded-md bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-cyan-500 to-blue-500 mb-1" />
                                                <div className="flex justify-between text-[9px] text-slate-400">
                                                    <span>1</span>
                                                    <span>5</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="absolute bottom-3 left-3 flex gap-2">
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-0.5 bg-red-500" />
                                            <span className="text-[9px] text-slate-400">X</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-0.5 bg-green-500" />
                                            <span className="text-[9px] text-slate-400">Y</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-0.5 bg-blue-500" />
                                            <span className="text-[9px] text-slate-400">Z</span>
                                        </div>
                                    </div>

                                    {isLoadingVectors && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                                            <div className="text-center">
                                                <div className="relative w-20 h-20 mx-auto mb-4">
                                                    <div className="absolute inset-0 border-4 border-slate-700 rounded-full" />
                                                    <div className="absolute inset-0 border-4 border-purple-500 rounded-full animate-spin border-t-transparent" />
                                                </div>
                                                <div className="text-white font-medium">Loading Vectors</div>
                                                <div className="text-xs text-slate-400 mt-1">Applying PCA dimensionality reduction</div>
                                            </div>
                                        </div>
                                    )}

                                    {vectorError && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                                            <div className="text-center">
                                                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                                                    <AlertCircle className="text-red-400" size={32} />
                                                </div>
                                                <div className="text-white font-medium">Failed to Load Vectors</div>
                                                <div className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">{vectorError}</div>
                                            </div>
                                        </div>
                                    )}

                                    {!isLoadingVectors && !vectorError && !vectorData.count && document.processed && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                                            <div className="text-center">
                                                <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-600">
                                                    <Eye className="text-slate-400" size={32} />
                                                </div>
                                                <div className="text-white font-medium">No Vector Data</div>
                                                <div className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Document needs at least 3 text chunks for 3D visualization</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-3 mt-3 border-t border-slate-700 flex-shrink-0">
                            <Button variant="secondary" size="sm" className="flex-1 bg-slate-700 hover:bg-slate-600 border-slate-600" onClick={onClose}>
                                Close
                            </Button>
                            <Button variant="default" size="sm" className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0" onClick={onShowDocumentDetails}>
                                <Info size={16} className="mr-1" /> Document Details
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default VectorVisualizationModal
