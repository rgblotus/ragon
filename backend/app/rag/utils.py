"""
RAG Service Utilities - Helper functions and constants.
"""

import asyncio
import logging

logger = logging.getLogger(__name__)


def hsl_to_rgb(h: float, s: float, l: float) -> tuple:
    """Convert HSL color to RGB."""
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs((h * 6) % 2 - 1))
    m = l - c / 2
    if 0 <= h < 1 / 6:
        return c, x, 0
    elif 1 / 6 <= h < 2 / 6:
        return x, c, 0
    elif 2 / 6 <= h < 3 / 6:
        return 0, c, x
    elif 3 / 6 <= h < 4 / 6:
        return 0, x, c
    elif 4 / 6 <= h < 5 / 6:
        return x, 0, c
    else:
        return c, 0, x


def get_event_loop() -> asyncio.AbstractEventLoop:
    """Get the current event loop, handling edge cases."""
    try:
        return asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop


def format_docs_for_chain(docs) -> str:
    """Format documents for RAG chain context."""
    formatted = []
    for doc in docs:
        source = doc.metadata.get("source", "Unknown")
        formatted.append(f"[Source: {source}]\n{doc.page_content}")
    return "\n\n".join(formatted)


EMPTY_VISUALIZATION_RESPONSE = {
    "points": [],
    "colors": [],
    "count": 0,
    "vectorPoints": [],
    "clusters": [],
    "dimensions": 3,
    "original_dimensions": 384,
}


# Enhanced RAG Prompt with source citations and structured responses
DEFAULT_RAG_PROMPT = """You are Olivia, an AI research assistant. Answer the user's question based ONLY on the document sources provided below.

## Instructions
1. Base your answer EXCLUSIVELY on the provided sources
2. Cite sources using [Source: filename] format after relevant information
3. If the sources don't contain relevant information, clearly state this
4. Use clear structure with headings and bullet points where appropriate
5. Keep answers concise and focused

## Sources
{context}

## Question
{question}

## Your Answer (based only on the sources above)"""


# Prompt when context is empty or irrelevant
DEFAULT_NO_CONTEXT_PROMPT = """You are Olivia, an AI research assistant for document Q&A.

The user asked a question, but no relevant information was found in the uploaded documents.

You MUST respond with exactly this message:
"I couldn't find any information about this topic in your uploaded documents. 

To get better results, you could:
• Check that your documents contain the topic you're asking about
• Try rephrasing your question with different keywords
• Upload additional documents on this topic"

Do NOT mention domains like Technical, Commercial, Mathematical, or HR unless the user specifically asks about them.
Do NOT ask "who Krishna refers to" - just explain that no relevant information was found."""


# Lightweight prompt for quick responses without documents
DEFAULT_LIGHTWEIGHT_PROMPT = """You are Olivia, a helpful AI assistant.

Question: {question}

Answer helpfully and concisely:"""


# Minimal fallback prompt
DEFAULT_FALLBACK_PROMPT = """Context:\n{context}\n\nQuestion: {question}\n\nAnswer:"""


# Detailed prompt for complex queries
DETAILED_RAG_PROMPT = """You are Olivia, an expert AI research assistant. Analyze the provided documents and answer the user's question thoroughly.

## Analysis Requirements
1. Carefully read all provided sources
2. Identify the most relevant information for the question
3. Synthesize information from multiple sources when available
4. Note any contradictions or gaps in the information
5. Provide a comprehensive, well-structured answer

## Document Sources
{context}

## User's Question
{question}

## Detailed Answer (cite sources with [Source: filename])"""

# Concise prompt for simple factual questions
CONCISE_RAG_PROMPT = """Based on your documents:

{context}

Question: {question}

Answer (brief, with source citations):"""

# Analytical prompt for comparative/analytical questions
ANALYTICAL_RAG_PROMPT = """You are Olivia, an AI research analyst. Analyze the provided documents to answer the question analytically.

## Sources
{context}

## Question
{question}

## Analysis
Provide a structured analysis with:
1. Key findings
2. Supporting evidence from sources [Source: filename]
3. Any limitations or gaps in the information

## Conclusion"""
