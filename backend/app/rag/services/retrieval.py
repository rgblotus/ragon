import re
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class QueryComplexity(Enum):
    SIMPLE = "simple"      # Basic questions, 1-2 words
    MODERATE = "moderate"  # Standard queries, 3-8 words
    COMPLEX = "complex"    # Detailed questions, 9+ words or multi-part


@dataclass
class RetrievalParams:
    """Dynamic retrieval parameters based on query analysis"""
    top_k: int
    min_score: float
    expand_query: bool
    complexity: QueryComplexity
    reasoning: str


class QueryAnalyzer:
    """
    Analyzes query complexity to determine optimal retrieval parameters.
    Reduces hallucinations by ensuring sufficient context for complex queries.
    """

    def __init__(self):
        # Complexity thresholds
        self.simple_threshold = 3  # words
        self.moderate_threshold = 9  # words

        # Question patterns that indicate complexity
        self.complex_patterns = [
            r'\b(how|why|explain|compare|analyze|describe)\b.*\?',
            r'\b(what|which|when|where)\b.*\b(and|or|versus|vs|but)\b',
            r'\b(multiple|several|different|various)\b',
            r'\b(steps|process|procedure|method)\b',
            r'[0-9]+\s+(ways|types|examples|steps)',  # "5 ways", "3 types", etc.
        ]

    def analyze_query(self, query: str) -> QueryComplexity:
        """
        Analyze query to determine complexity level.
        """
        query = query.strip()
        word_count = len(query.split())

        # Check for complex patterns first
        for pattern in self.complex_patterns:
            if re.search(pattern, query.lower()):
                return QueryComplexity.COMPLEX

        # Then check word count
        if word_count <= self.simple_threshold:
            return QueryComplexity.SIMPLE
        elif word_count <= self.moderate_threshold:
            return QueryComplexity.MODERATE
        else:
            return QueryComplexity.COMPLEX

    def get_optimal_params(self, query: str, base_top_k: int = 50, base_min_score: float = 0.0) -> RetrievalParams:
        """
        Calculate optimal retrieval parameters based on query analysis.
        """
        complexity = self.analyze_query(query)

        if complexity == QueryComplexity.SIMPLE:
            # Simple queries need fewer but higher quality results
            # Relaxed constraints to ensure we don't miss context (some relevant docs have score ~0.45)
            top_k = min(base_top_k, 10)
            min_score = max(base_min_score, 0.25)
            expand_query = False
            reasoning = "Simple query - using focused retrieval with quality threshold"

        elif complexity == QueryComplexity.MODERATE:
            # Moderate queries use baseline parameters
            top_k = base_top_k
            min_score = base_min_score
            expand_query = False
            reasoning = "Moderate complexity - using standard retrieval parameters"

        else:  # QueryComplexity.COMPLEX
            # Complex queries need more context and lower threshold
            top_k = max(base_top_k, 8)
            min_score = max(base_min_score, 0.1)  # Lower threshold for more results
            expand_query = True
            reasoning = "Complex query - expanding retrieval scope for comprehensive context"

        return RetrievalParams(
            top_k=top_k,
            min_score=min_score,
            expand_query=expand_query,
            complexity=complexity,
            reasoning=reasoning
        )


class QueryExpansionService:
    """
    Expands queries with synonyms and related terms to improve retrieval.
    """

    def __init__(self):
        # Simple synonym dictionary for common terms
        self.synonyms = {
            'show': ['display', 'present', 'illustrate'],
            'create': ['build', 'develop', 'make', 'generate'],
            'explain': ['describe', 'clarify', 'elaborate'],
            'find': ['locate', 'search', 'discover'],
            'help': ['assist', 'support', 'aid'],
            'use': ['utilize', 'apply', 'employ'],
            'work': ['function', 'operate', 'perform'],
            'problem': ['issue', 'difficulty', 'challenge'],
            'solution': ['answer', 'fix', 'resolution'],
            'example': ['instance', 'sample', 'case'],
        }

    def expand_query(self, query: str) -> List[str]:
        """
        Generate expanded query variations.
        Returns list of expanded queries including original.
        """
        if not query or len(query.split()) < 2:
            return [query]

        expanded_queries = [query]  # Always include original

        words = query.lower().split()
        expanded_words = []

        # Expand individual words with synonyms
        for word in words:
            word_synonyms = self.synonyms.get(word, [word])
            expanded_words.append(word_synonyms[:2])  # Limit to 2 synonyms per word

        # Generate combinations (limit to avoid explosion)
        if len(expanded_words) <= 4:  # Only expand short queries
            from itertools import product
            for combo in product(*expanded_words):
                expanded_query = ' '.join(combo)
                if expanded_query != query.lower() and expanded_query not in expanded_queries:
                    expanded_queries.append(expanded_query)
                    if len(expanded_queries) >= 4:  # Limit total expansions
                        break

        logger.debug(f"Query expansion: '{query}' -> {expanded_queries}")
        return expanded_queries


class RetrievalQualityMetrics:
    """
    Tracks and logs retrieval quality metrics for monitoring and improvement.
    """

    def __init__(self):
        self.metrics = {
            'total_queries': 0,
            'avg_retrieved_docs': 0.0,
            'avg_similarity_score': 0.0,
            'complexity_distribution': {comp.value: 0 for comp in QueryComplexity},
            'low_quality_retrievals': 0,
        }

    def log_retrieval(self, query: str, params: RetrievalParams, retrieved_docs: List, similarity_scores: List[float]):
        """Log retrieval metrics for analysis."""
        self.metrics['total_queries'] += 1

        if retrieved_docs:
            self.metrics['avg_retrieved_docs'] = (
                (self.metrics['avg_retrieved_docs'] * (self.metrics['total_queries'] - 1)) +
                len(retrieved_docs)
            ) / self.metrics['total_queries']

        if similarity_scores:
            avg_score = sum(similarity_scores) / len(similarity_scores)
            self.metrics['avg_similarity_score'] = (
                (self.metrics['avg_similarity_score'] * (self.metrics['total_queries'] - 1)) +
                avg_score
            ) / self.metrics['total_queries']

        self.metrics['complexity_distribution'][params.complexity.value] += 1

        # Flag low quality retrievals
        if len(retrieved_docs) < params.top_k * 0.5 or (similarity_scores and max(similarity_scores) < 0.2):
            self.metrics['low_quality_retrievals'] += 1

        logger.info(f"Retrieval metrics updated: {self.get_summary()}")

    def get_summary(self) -> Dict[str, Any]:
        """Get current metrics summary."""
        return {
            **self.metrics,
            'low_quality_rate': self.metrics['low_quality_retrievals'] / max(self.metrics['total_queries'], 1)
        }


# Global instances
query_analyzer = QueryAnalyzer()
query_expansion = QueryExpansionService()
retrieval_metrics = RetrievalQualityMetrics()