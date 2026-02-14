import React from 'react'
import type { ParticleShape } from '../../utils/shapeGenerators'
import {
    Globe,
    Sparkles,
    CircleOff,
} from 'lucide-react'

interface ShapeGeneratorProps {
    onShapeChange: (shape: ParticleShape) => void
    currentShape: ParticleShape
    className?: string
}

const shapeOptions: { value: ParticleShape; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; description: string }[] = [
    { value: 'none', label: 'None', icon: CircleOff, description: 'No particle background' },
    { value: 'sphere', label: 'Sphere', icon: Globe, description: 'Particles in a spherical pattern' },
    { value: 'sparkles', label: 'Sparkles', icon: Sparkles, description: 'Sparkling particles' },
]

const ShapeGenerator: React.FC<ShapeGeneratorProps> = ({
    onShapeChange,
    currentShape,
    className = '',
}) => {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className="flex items-center gap-1">
                {shapeOptions.map((option) => {
                    const Icon = option.icon
                    const isSelected = option.value === currentShape

                    return (
                        <button
                            type="button"
                            key={option.value}
                            onClick={() => onShapeChange(option.value)}
                            className={`p-2 rounded-lg transition-all duration-200 ${
                                isSelected ? 'bg-purple-100 border border-purple-300' : 'hover:bg-slate-100 border border-transparent'
                            }`}
                            title={option.description}
                        >
                            <Icon
                                size={16}
                                className={isSelected ? 'text-purple-600' : 'text-slate-600'}
                            />
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export default ShapeGenerator
