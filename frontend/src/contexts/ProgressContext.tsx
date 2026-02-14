import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { progressWebSocket, ProgressEvent } from '../services/progressWebSocket'

export interface TaskProgress {
    progress: number
    message: string
    isProcessing: boolean
    error?: string
}

interface ProgressContextType {
    progressMap: Record<string, TaskProgress>
    connect: () => void
    disconnect: () => void
}

const ProgressContext = createContext<ProgressContextType | undefined>(
    undefined
)

export const useProgress = (): ProgressContextType => {
    const context = useContext(ProgressContext)
    if (!context) {
        throw new Error('useProgress must be used within a ProgressProvider')
    }
    return context
}

interface ProgressProviderProps {
    children: ReactNode
}

export const ProgressProvider: React.FC<ProgressProviderProps> = ({
    children,
}) => {
    const { user } = useAuth()
    const [progressMap, setProgressMap] = useState<
        Record<string, TaskProgress>
    >({})

    const connect = () => {
        if (user?.id) {
            progressWebSocket.connect(user.id)
        }
    }

    const disconnect = () => {
        progressWebSocket.disconnect()
    }

    // Connect to WebSocket for real-time progress updates
    useEffect(() => {
        if (!user) {
            disconnect()
            return
        }

        connect()

        // Set up WebSocket event listeners
        const handleProgress = (event: ProgressEvent) => {
            if (event.task_id) {
                setProgressMap(prev => ({
                    ...prev,
                    [event.task_id!]: {
                        progress: event.progress,
                        message: event.message,
                        isProcessing: event.progress < 100
                    }
                }))
            }
        }

        progressWebSocket.onProgress(handleProgress)

        return () => {
            progressWebSocket.offProgress(handleProgress)
        }
    }, [user])

    const value: ProgressContextType = {
        progressMap,
        connect,
        disconnect,
    }

    return (
        <ProgressContext.Provider value={value}>
            {children}
        </ProgressContext.Provider>
    )
}

export default ProgressProvider
