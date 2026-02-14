/**
 * useDocuments Hook - Document management
 */

import { useState, useEffect, useCallback } from 'react'
import { documentApi, collectionApi } from '../services/api'
import type { Document, Collection } from '../types/api'

export function useDocuments() {
    const [documents, setDocuments] = useState<Document[]>([])
    const [collections, setCollections] = useState<Collection[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedCollectionId, setSelectedCollectionId] = useState<number | undefined>()

    const loadDocuments = useCallback(async () => {
        setLoading(true)
        try {
            const docs = await documentApi.getAll(selectedCollectionId)
            setDocuments(docs)
            setError(null)
        } catch (err) {
            setError('Failed to load documents')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [selectedCollectionId])

    const loadCollections = useCallback(async () => {
        try {
            const colls = await collectionApi.getAll()
            setCollections(colls)
        } catch (err) {
            console.error('Failed to load collections:', err)
        }
    }, [])

    const uploadDocument = useCallback(async (
        file: File,
        collectionId?: number,
        onProgress?: (progress: number) => void
    ) => {
        try {
            const doc = await documentApi.upload(file, collectionId, onProgress)
            setDocuments((prev) => [...prev, doc])
            return doc
        } catch (err) {
            setError('Failed to upload document')
            console.error(err)
            throw err
        }
    }, [])

    const deleteDocument = useCallback(async (id: number) => {
        try {
            await documentApi.delete(id)
            setDocuments((prev) => prev.filter((d) => d.id !== id))
        } catch (err) {
            setError('Failed to delete document')
            console.error(err)
            throw err
        }
    }, [])

    const getDocumentContent = useCallback(async (docId: number) => {
        try {
            return await documentApi.getContent(docId)
        } catch (err) {
            console.error('Failed to get document content:', err)
            throw err
        }
    }, [])

    useEffect(() => {
        loadDocuments()
        loadCollections()
    }, [loadDocuments, loadCollections])

    return {
        documents, collections, loading, error,
        selectedCollectionId, setSelectedCollectionId,
        loadDocuments, loadCollections,
        uploadDocument, deleteDocument, getDocumentContent,
    }
}
