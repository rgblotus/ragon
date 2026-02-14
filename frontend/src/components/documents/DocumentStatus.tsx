import React, {useState, useEffect } from 'react'
import { Loader2, CheckCircle } from 'lucide-react'
import type { Document } from '../../types/api'
import { api } from '../../services/api'

interface DocumentStatusProps {
    doc: Document
    progressMap: Record<
        string,
        {
            isProcessing: boolean
            progress: number
            message: string
            error?: string
        }
    >
}

const DocumentStatus: React.FC<DocumentStatusProps> = ({
    doc,
    progressMap,
}) => {
    const [polledProgress, setPolledProgress] = useState<Record<string, unknown> | null>(null)
    const progress = progressMap[doc.id.toString()] || polledProgress

    // Poll for progress if document is not processed
    useEffect(() => {
        if (doc.processed) return

        let timeoutId: NodeJS.Timeout

        const pollProgress = async () => {
            try {
                const progressData = await api.getDocumentProgress(
                    doc.id.toString(),
                )

                setPolledProgress(progressData)
                if (
                    progressData.status === 'processing' &&
                    Number(progressData.progress) < 100
                ) {
                    // Continue polling every 2 seconds
                    timeoutId = setTimeout(pollProgress, 2000)
                }
            } catch (error) {
                console.error(
                    'Failed to poll progress for doc',
                    doc.id,
                    ':',
                    error,
                )
                // Retry after error with longer interval
                timeoutId = setTimeout(pollProgress, 5000)
            }
        }

        // Start polling immediately
        pollProgress()

        return () => {
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [doc.id, doc.processed])

    // Show progress if we have progress data and it's between 0 and 100
    const progressValue = progress ? Number(progress.progress) : NaN
    const conditionMet =
        progress &&
        !isNaN(progressValue) &&
        progressValue >= 0 &&
        progressValue < 100

    if (conditionMet) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 uppercase tracking-tighter shadow-sm backdrop-blur-sm">
                <Loader2 size={10} className="animate-spin" />
                {progressValue}%
            </span>
        )
    } else if (doc.processed || (progress && progressValue === 100)) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 uppercase tracking-tighter shadow-sm backdrop-blur-sm">
                <CheckCircle size={10} />
                Ready
            </span>
        )
    } else {
        return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-orange-500 to-yellow-600 text-white border-0 uppercase tracking-tighter shadow-sm backdrop-blur-sm">
                <Loader2 size={10} className="animate-spin" />
                Processing
            </span>
        )
    }
}

export default DocumentStatus
