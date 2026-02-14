from fastapi import APIRouter, Depends, Response, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.auth.router import get_current_user
from app.auth.models import User
from app.rag.schemas import ChatRequest, ChatResponse
from app.core.service_manager import get_rag_service_dependency, get_ai_utils_dependency

router = APIRouter()


@router.post("/chat")
async def chat_with_docs(
    request: ChatRequest,
    user: User = Depends(get_current_user),
    rag_service=Depends(get_rag_service_dependency),
):
    """Directly stream from the async generator for better performance."""
    return StreamingResponse(
        rag_service.stream_chat_with_data(
            request.query,
            user.id,
            request.collection_id,
            temperature=request.temperature,
            top_k=request.top_k,
            custom_prompt=request.custom_prompt,
            fetch_sources=request.fetch_sources,
        ),
        media_type="text/event-stream",
    )


@router.get("/debug/documents")
async def debug_documents(
    collection_id: int = None,
    user: User = Depends(get_current_user),
    rag_service=Depends(get_rag_service_dependency),
):
    """Debug endpoint to check what documents are in the vector store."""
    import logging

    logger = logging.getLogger(__name__)

    try:
        # Get collection info
        collection_info = {
            "user_id": user.id,
            "collection_id": collection_id,
            "milvus_host": rag_service.vector_store.connection_args.get("host"),
            "milvus_port": rag_service.vector_store.connection_args.get("port"),
        }

        # Try to get actual documents from Milvus
        try:
            # Get all documents with a simple search (no filter)
            all_docs = rag_service.vector_store.similarity_search("test", k=10)
            collection_info["total_docs_in_store"] = len(all_docs)
            collection_info["sample_docs"] = []

            for doc in all_docs[:5]:
                collection_info["sample_docs"].append(
                    {
                        "source": doc.metadata.get("source"),
                        "user_id": doc.metadata.get("user_id"),
                        "collection_id": doc.metadata.get("collection_id"),
                        "content_preview": doc.page_content[:100],
                    }
                )

            # Filter by user/collection if specified
            if collection_id:
                filtered_docs = [
                    d
                    for d in all_docs
                    if d.metadata.get("user_id") == user.id
                    and d.metadata.get("collection_id") == collection_id
                ]
                collection_info["docs_for_user_collection"] = len(filtered_docs)

        except Exception as e:
            collection_info["error_fetching_docs"] = str(e)

        # Test retrieval with the specific query
        try:
            test_results = rag_service.vector_store.similarity_search_with_score(
                "Arjuna", k=5
            )
            collection_info["arjuna_search_results"] = len(test_results)
            collection_info["arjuna_samples"] = []

            for doc, score in test_results[:3]:
                collection_info["arjuna_samples"].append(
                    {
                        "source": doc.metadata.get("source"),
                        "user_id": doc.metadata.get("user_id"),
                        "collection_id": doc.metadata.get("collection_id"),
                        "score": score,
                        "content_preview": doc.page_content[:100],
                    }
                )
        except Exception as e:
            collection_info["error_searching_arjuna"] = str(e)

        return collection_info

    except Exception as e:
        import traceback

        traceback.print_exc()
        return {"error": str(e), "traceback": traceback.format_exc()}


class GetSourcesRequest(BaseModel):
    query: str
    collection_id: int
    temperature: float = 0.7
    top_k: int = 5
    custom_prompt: str = ""


@router.post("/sources")
async def get_sources(
    request: GetSourcesRequest,
    user: User = Depends(get_current_user),
    rag_service=Depends(get_rag_service_dependency),
):
    """Get sources for a query without generating AI response"""
    import asyncio

    try:
        # Use thread pool for blocking RAG operations
        loop = asyncio.get_event_loop()
        filtered_sources, docs = await loop.run_in_executor(
            None,
            lambda: rag_service._get_processed_sources_and_docs(
                request.query, user.id, request.collection_id, request.top_k
            ),
        )

        return {
            "sources": filtered_sources,
            "query": request.query,
            "collection_id": request.collection_id,
        }
    except Exception as e:
        return {"error": f"Failed to get sources: {str(e)}", "sources": []}


class TranslateRequest(BaseModel):
    text: str


@router.post("/translate")
async def translate_text(
    request: TranslateRequest,
    user: User = Depends(get_current_user),
    ai_utils=Depends(get_ai_utils_dependency),
):
    import asyncio

    try:
        # Use thread pool for blocking translation operations
        loop = asyncio.get_event_loop()
        translated = await loop.run_in_executor(
            None, lambda: ai_utils.translate(request.text)
        )
        return {"translated_text": translated}
    except Exception as e:
        error_msg = str(e)
        print(f"Translation error: {error_msg}")
        # Return 503 Service Unavailable for model loading errors
        raise HTTPException(
            status_code=503, detail=f"Translation service unavailable: {error_msg}"
        )


@router.post("/warmup")
async def warmup_services(
    user: User = Depends(get_current_user),
    ai_utils=Depends(get_ai_utils_dependency),
):
    """Pre-warm TTS and translation services for instant response."""
    import asyncio
    import logging

    logger = logging.getLogger(__name__)

    try:
        logger.info("Starting service warmup...")

        # Warm up TTS models first (they take longer)
        tts_models = ["en_female", "hi_female"]
        for voice_id in tts_models:
            try:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(
                    None, lambda v=voice_id: ai_utils.get_tts_model(v)
                )
                logger.info(f"TTS model {voice_id} loaded successfully")
            except Exception as tts_err:
                logger.warn(f"Failed to load TTS model {voice_id}: {tts_err}")

        # Warm up translation service
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, lambda: ai_utils.load_translator())
            logger.info("Translation service warmed up")
        except Exception as trans_err:
            logger.warn(f"Failed to warm up translation: {trans_err}")
            # Try to access translator to trigger lazy loading
            try:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, lambda: ai_utils.translate("Hello"))
            except:
                pass  # Translation will be lazy-loaded on first use

        return {"status": "warmed_up", "message": "TTS and translation services ready"}
    except Exception as e:
        logger.error(f"Warmup failed: {str(e)}")
        return {
            "status": "warmed_up",
            "message": "Services initialized (some may lazy-load)",
        }


@router.get("/tts")
async def text_to_speech(
    text: str,
    voice: str = "en_female",
    user: User = Depends(get_current_user),
    ai_utils=Depends(get_ai_utils_dependency),
):
    import asyncio

    try:
        # Use thread pool for blocking TTS operations
        loop = asyncio.get_event_loop()
        audio_io = await loop.run_in_executor(
            None, lambda: ai_utils.text_to_speech(text, voice)
        )
        return StreamingResponse(audio_io, media_type="audio/wav")
    except Exception as e:
        import traceback

        traceback.print_exc()
        return Response(content=str(e), status_code=500)


# Cache monitoring endpoints
@router.get("/cache/stats")
async def get_cache_stats(user: User = Depends(get_current_user)):
    """Get comprehensive cache statistics."""
    from app.core.cache_monitor import cache_monitor
    from app.rag.service import rag_service

    try:
        cache_stats = rag_service.get_cache_stats()
        monitor_stats = cache_monitor.get_current_metrics()

        return {
            "cache_stats": cache_stats,
            "monitor_stats": monitor_stats,
            "timestamp": "current",
        }
    except Exception as e:
        return {"error": f"Failed to get cache stats: {str(e)}"}


@router.get("/cache/health")
async def get_cache_health(user: User = Depends(get_current_user)):
    """Get cache health status."""
    from app.core.cache_service import cache_service
    from app.core.cache_monitor import cache_monitor

    try:
        health = cache_service.health_check()
        alerts = cache_monitor.get_alerts(hours=1)  # Last hour

        return {
            "health": health,
            "recent_alerts": alerts[-5:],  # Last 5 alerts
            "alerts_count": len(alerts),
        }
    except Exception as e:
        return {"error": f"Failed to get cache health: {str(e)}"}


@router.get("/cache/performance-report")
async def get_cache_performance_report(user: User = Depends(get_current_user)):
    """Get detailed cache performance report."""
    from app.core.cache_monitor import cache_monitor

    try:
        report = cache_monitor.get_performance_report()
        return report
    except Exception as e:
        return {"error": f"Failed to generate performance report: {str(e)}"}


@router.post("/cache/warmup")
async def trigger_cache_warmup(user: User = Depends(get_current_user)):
    """Manually trigger cache warming."""
    from app.rag.service import rag_service

    try:
        success = rag_service.warmup_critical_caches()
        return {"success": success, "message": "Cache warmup triggered"}
    except Exception as e:
        return {"error": f"Failed to trigger cache warmup: {str(e)}"}
