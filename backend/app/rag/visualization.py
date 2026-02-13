"""
Document Visualization - 3D embedding visualization with PCA and clustering.
"""

import logging
import traceback
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import HTTPException
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics.pairwise import cosine_similarity

from app.rag.config import settings
from app.rag.utils import EMPTY_VISUALIZATION_RESPONSE, hsl_to_rgb

logger = logging.getLogger(__name__)


class DocumentVisualizer:
    """Handles 3D visualization of document embeddings."""

    def __init__(self, vector_store):
        self.vector_store = vector_store

    async def get_embeddings_for_visualization(
        self, user_id: int, document_id: int
    ) -> Dict[str, Any]:
        """
        Get document embeddings reduced to 3D for visualization.

        Args:
            user_id: The user ID for access control
            document_id: The document ID to visualize

        Returns:
            Dictionary with 3D points, colors, and metadata
        """
        try:
            from sqlalchemy.ext.asyncio import AsyncSession
            from sqlalchemy import select
            from app.document.models import Document
            from app.core.database import async_engine

            async with AsyncSession(async_engine) as session:
                result = await session.execute(
                    select(Document).where(Document.id == document_id)
                )
                doc = result.scalar_one_or_none()
                if not doc or doc.user_id != user_id:
                    logger.warning(
                        f"Document {document_id} not found or access denied for user {user_id}"
                    )
                    raise HTTPException(status_code=404, detail="Document not found")

            logger.info(f"Document found: {doc.filename}, processed: {doc.processed}")

            if not doc.processed:
                return EMPTY_VISUALIZATION_RESPONSE

            expr = f'user_id == {user_id} and source == "{doc.filename}"'
            if doc.collection_id:
                expr += f" and collection_id == {doc.collection_id}"

            logger.info(f"Querying Milvus with expr: {expr}")

            collection = self.vector_store.col
            logger.info(
                f"Collection fields: {[field.name for field in collection.schema.fields]}"
            )

            embedding_field, entities = self._find_embedding_field(collection, expr)

            if embedding_field is None or entities is None:
                return EMPTY_VISUALIZATION_RESPONSE

            logger.info(f"Found {len(entities)} entities in Milvus")

            if not entities:
                return EMPTY_VISUALIZATION_RESPONSE

            embeddings_384d = self._extract_embeddings(entities, embedding_field)

            if not embeddings_384d:
                return EMPTY_VISUALIZATION_RESPONSE

            if len(embeddings_384d) < 3:
                logger.info(
                    f"Document has only {len(embeddings_384d)} vectors, cannot apply PCA for 3D reduction"
                )
                return EMPTY_VISUALIZATION_RESPONSE

            vectors_3d, pca, embeddings_array = self._apply_pca(embeddings_384d)

            similarities = self._compute_similarities(embeddings_array)

            clusters = self._cluster_vectors(vectors_3d, len(vectors_3d))

            return self._prepare_visualization_response(
                vectors_3d, entities, similarities, clusters
            )

        except Exception as e:
            logger.error(f"Error getting document embeddings for visualization: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise HTTPException(
                status_code=500, detail=f"Failed to get embeddings: {str(e)}"
            )

    def _find_embedding_field(self, collection, expr: str) -> tuple:
        """Find the embedding field in the collection."""
        possible_fields = [
            "vector",
            "embeddings",
            "embedding",
            "dense_vector",
            "sentence-transformers/all-MiniLM-L6-v2",
        ]

        for field_name in possible_fields:
            try:
                text_field = (
                    "text"
                    if "text" in [f.name for f in collection.schema.fields]
                    else None
                )
                output_fields = [field_name]
                if text_field:
                    output_fields.append(text_field)

                entities = collection.query(expr=expr, output_fields=output_fields)
                logger.info(f"Successfully using '{field_name}' field for embeddings")
                return field_name, entities
            except Exception as field_error:
                logger.warning(f"Field '{field_name}' failed: {field_error}")
                continue

        available_fields = [field.name for field in collection.schema.fields]
        logger.error(
            f"No suitable embedding field found. Available fields: {available_fields}"
        )
        return None, None

    def _extract_embeddings(self, entities: List, embedding_field: str) -> List:
        """Extract embeddings from query results."""
        embeddings = []
        for entity in entities:
            if embedding_field in entity and entity[embedding_field]:
                embeddings.append(entity[embedding_field])
            else:
                logger.warning(
                    f"Entity missing {embedding_field} field: {list(entity.keys())}"
                )
        return embeddings

    def _apply_pca(self, embeddings: List) -> tuple:
        """Apply PCA for dimensionality reduction."""
        embeddings_array = np.array(embeddings)
        pca = PCA(n_components=3)
        vectors_3d = pca.fit_transform(embeddings_array).tolist()
        logger.info(
            f"PCA applied successfully, explained variance: {pca.explained_variance_ratio_}"
        )
        return vectors_3d, pca, embeddings_array

    def _compute_similarities(self, embeddings_array: np.ndarray) -> List[float]:
        """Compute similarity scores."""
        similarity_matrix = cosine_similarity(embeddings_array)
        return [np.mean(row) for row in similarity_matrix]

    def _cluster_vectors(self, vectors_3d: List, count: int) -> List[int]:
        """Apply K-means clustering."""
        n_clusters = min(5, count)
        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        return kmeans.fit_predict(vectors_3d).tolist()

    def _prepare_visualization_response(
        self,
        vectors_3d: List,
        entities: List,
        similarities: List[float],
        clusters: List[int],
    ) -> Dict[str, Any]:
        """Prepare the final visualization response."""
        vector_points = []

        for i, vector_3d in enumerate(vectors_3d):
            entity = entities[i] if i < len(entities) else {}
            text_content = entity.get("text", "")[:100] if "text" in entity else ""

            position = np.array(vector_3d)
            norm = np.linalg.norm(position)
            if norm > 0:
                position = position / norm * 3

            hue = (np.arctan2(position[1], position[0]) / (2 * np.pi) + 1) % 1
            r, g, b = hsl_to_rgb(hue * 0.8, 0.6, 0.5)

            vector_point = {
                "position": {
                    "x": float(position[0]),
                    "y": float(position[1]),
                    "z": float(position[2]),
                },
                "color": {"r": r, "g": g, "b": b},
                "metadata": {
                    "index": i,
                    "similarity": float(similarities[i]),
                    "cluster": int(clusters[i]),
                    "originalIndex": i,
                    "text": text_content,
                },
            }
            vector_points.append(vector_point)

        points = []
        colors = []
        for i, vector_3d in enumerate(vectors_3d):
            position = np.array(vector_3d)
            norm = np.linalg.norm(position)
            if norm > 0:
                position = position / norm * 3
            hue = (np.arctan2(position[1], position[0]) / (2 * np.pi) + 1) % 1
            r, g, b = hsl_to_rgb(hue * 0.8, 0.6, 0.5)
            points.extend([float(position[0]), float(position[1]), float(position[2])])
            colors.extend([r, g, b])

        logger.info(f"Returning {len(vector_points)} vectors for visualization")

        return {
            "points": points,
            "colors": colors,
            "count": len(vector_points),
            "vectorPoints": vector_points,
            "clusters": [],
            "dimensions": 3,
            "original_dimensions": 384,
        }
