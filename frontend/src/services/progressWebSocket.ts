import { api } from './api'

export interface ProgressEvent {
    type: 'progress'
    progress: number
    message: string
    task_id?: string
}

type ProgressCallback = (event: ProgressEvent) => void

class ProgressWebSocketService {
    private socket: WebSocket | null = null
    private reconnectAttempts = 0
    private maxReconnectAttempts = 5
    private reconnectInterval = 1000 // Start with 1 second
    private userId: number | null = null
    private callbacks: ProgressCallback[] = []

    connect(userId: number): void {
        if (this.socket?.readyState === WebSocket.OPEN) {
            return // Already connected
        }

        this.userId = userId
        const baseUrl = api.getBaseUrl().replace('http', 'ws')
        const url = `${baseUrl}/documents/ws/progress/${userId}`

        try {
            this.socket = new WebSocket(url)

            this.socket.onopen = () => {
                this.reconnectAttempts = 0
                this.reconnectInterval = 1000
            }

            this.socket.onmessage = (event) => {
                try {
                    const data: ProgressEvent = JSON.parse(event.data)
                    if (data.type === 'progress') {
                        this.notifyCallbacks(data)
                    }
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error)
                }
            }

            this.socket.onclose = (event) => {
                this.socket = null
                // Attempt to reconnect if not intentionally closed
                if (
                    event.code !== 1000 &&
                    this.reconnectAttempts < this.maxReconnectAttempts
                ) {
                    this.attemptReconnect()
                }
            }

            this.socket.onerror = (error) => {
                console.error('Progress WebSocket error:', error, 'URL:', url)
            }
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error)
            this.attemptReconnect()
        }
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.close(1000, 'Client disconnect')
            this.socket = null
        }
        this.reconnectAttempts = 0
    }

    private attemptReconnect(): void {
        if (
            !this.userId ||
            this.reconnectAttempts >= this.maxReconnectAttempts
        ) {
            return
        }

        this.reconnectAttempts++

        setTimeout(() => {
            if (this.userId) {
                this.connect(this.userId)
            }
        }, this.reconnectInterval)

        // Exponential backoff
        this.reconnectInterval = Math.min(this.reconnectInterval * 2, 30000)
    }

    onProgress(callback: ProgressCallback): void {
        this.callbacks.push(callback)
    }

    offProgress(callback: ProgressCallback): void {
        const index = this.callbacks.indexOf(callback)
        if (index > -1) {
            this.callbacks.splice(index, 1)
        }
    }

    private notifyCallbacks(event: ProgressEvent): void {
        this.callbacks.forEach((callback) => {
            try {
                callback(event)
            } catch (error) {
                console.error('Error in progress callback:', error)
            }
        })
    }

    isConnected(): boolean {
        return this.socket?.readyState === WebSocket.OPEN
    }
}

// Export singleton instance
export const progressWebSocket = new ProgressWebSocketService()
export default progressWebSocket
