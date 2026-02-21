"""
RAG Chain Factory - Creates and manages LangChain RAG pipelines.
"""

import logging
from typing import List
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import (
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate,
)
from langchain_core.runnables import RunnablePassthrough
from langchain_core.messages import SystemMessage, HumanMessage

from app.rag.config import settings
from app.rag.utils import (
    DEFAULT_RAG_PROMPT,
    DEFAULT_NO_CONTEXT_PROMPT,
    DEFAULT_LIGHTWEIGHT_PROMPT,
    DEFAULT_FALLBACK_PROMPT,
    DETAILED_RAG_PROMPT,
    CONCISE_RAG_PROMPT,
    ANALYTICAL_RAG_PROMPT,
    format_docs_for_chain,
)

logger = logging.getLogger(__name__)


def _escape_curly_braces(text: str) -> str:
    """Escape literal curly braces in custom prompts for LangChain template formatting."""
    return text.replace("{", "{{").replace("}", "}}")


SYSTEM_PROMPT = """You are an AI research assistant powered by RAG (Retrieval Augmented Generation).

CRITICAL INSTRUCTIONS:
1. You have FULL ACCESS to the user's uploaded documents through the RAG system
2. When answering questions about documents, use ONLY the context provided
3. You must NOT say you "cannot access documents" - you absolutely can
4. You must NOT mention "Phi"
5. You must NOT mention privacy limitations - you are designed to help with user documents
6. Cite sources with [Source: filename] format
7. If no relevant context found, say: "I couldn't find relevant information in your documents"

Your personality: Helpful, professional, research-focused. Answer directly about the document content."""

PROMPT_TYPES = {
    "default": DEFAULT_RAG_PROMPT,
    "detailed": DETAILED_RAG_PROMPT,
    "concise": CONCISE_RAG_PROMPT,
    "analytical": ANALYTICAL_RAG_PROMPT,
    "lightweight": DEFAULT_LIGHTWEIGHT_PROMPT,
}


class ChainFactory:
    """Factory for creating LangChain RAG chains."""

    def __init__(self, llm, embeddings):
        self.llm = llm
        self.embeddings = embeddings
        self._prompt_template = None
        self._format_docs_func = None

    def _get_template(
        self, custom_prompt: str = "", prompt_type: str = "default"
    ) -> str:
        """Get the appropriate prompt template."""
        if custom_prompt and custom_prompt.strip():
            return custom_prompt
        return PROMPT_TYPES.get(prompt_type, DEFAULT_RAG_PROMPT)

    def _ensure_format_func(self):
        """Ensure format_docs function is cached."""
        if self._format_docs_func is None:
            self._format_docs_func = format_docs_for_chain
        return self._format_docs_func

    def select_prompt_type(self, query: str, context_length: int) -> str:
        """Select optimal prompt type based on query characteristics."""
        query_lower = query.lower()

        # Analytical queries
        analytical_keywords = [
            "compare",
            "analyze",
            "difference",
            "relationship",
            "why",
        ]
        if any(kw in query_lower for kw in analytical_keywords):
            return "analytical"

        # Detailed/explanatory queries
        detailed_keywords = ["explain", "describe", "how does", "what is the"]
        if any(kw in query_lower for kw in detailed_keywords):
            return "detailed"

        # Short factual queries - use concise
        if len(query.split()) <= 5 and context_length > 5000:
            return "concise"

        return "default"

    def create_rag_chain(
        self,
        retriever,
        temperature: float,
        custom_prompt: str = "",
        prompt_type: str = "default",
    ):
        """
        Create a full RAG chain with retriever and LLM.

        Args:
            retriever: LangChain retriever instance
            temperature: LLM temperature setting
            custom_prompt: Optional custom prompt template
            prompt_type: Type of prompt (default, detailed, concise, analytical)

        Returns:
            Configured RAG chain
        """
        template = self._get_template(custom_prompt, prompt_type)

        if template != self._prompt_template:
            self._prompt_template = template
            self._format_docs_func = None

        if not template or not isinstance(template, str):
            template = DEFAULT_FALLBACK_PROMPT
            logger.warning("Invalid template, using fallback")

        prompt = ChatPromptTemplate.from_template(template)
        format_func = self._ensure_format_func()

        return (
            {
                "context": retriever | format_func,
                "question": RunnablePassthrough(),
            }
            | prompt
            | self.llm.bind(options={"temperature": temperature, "num_predict": 2048})
            | StrOutputParser()
        )

    def create_context_chain(
        self,
        context_str: str,
        temperature: float,
        custom_prompt: str = "",
        prompt_type: str = "default",
    ):
        """
        Create a chain with pre-computed context.

        Args:
            context_str: Pre-formatted context string
            temperature: LLM temperature setting
            custom_prompt: Optional custom prompt template
            prompt_type: Type of prompt to use

        Returns:
            Configured chain without retriever
        """
        logger.debug(
            f"Context length: {len(context_str)}, first 500 chars: {context_str[:500]}..."
        )

        if custom_prompt and custom_prompt.strip():
            template = _escape_curly_braces(custom_prompt)
        else:
            if not context_str or context_str.strip() == "":
                template = DEFAULT_NO_CONTEXT_PROMPT
            else:
                escaped_context = _escape_curly_braces(context_str)
                template = self._get_template("", prompt_type).replace(
                    "{context}", escaped_context
                )

        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessagePromptTemplate.from_template(template),
        ]
        prompt = ChatPromptTemplate.from_messages(messages)

        return (
            {"question": RunnablePassthrough()}
            | prompt
            | self.llm.bind(options={"temperature": temperature, "num_predict": 2048})
            | StrOutputParser()
        )

    def create_lightweight_chain(self, temperature: float, custom_prompt: str = ""):
        """
        Create a lightweight chain without document retrieval for fast responses.
        """
        if custom_prompt.strip():
            escaped = _escape_curly_braces(custom_prompt)
            template = escaped.replace("{{context}}", "").replace(
                "{{question}}", "{question}"
            )
        else:
            template = DEFAULT_LIGHTWEIGHT_PROMPT

        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessagePromptTemplate.from_template(template),
        ]
        prompt = ChatPromptTemplate.from_messages(messages)

        return (
            {"question": RunnablePassthrough()}
            | prompt
            | self.llm.bind(options={"temperature": temperature, "num_predict": 2048})
            | StrOutputParser()
        )

    def create_streaming_chain(
        self,
        context_str: str,
        temperature: float,
        custom_prompt: str = "",
        prompt_type: str = "default",
    ):
        """
        Create a streaming-capable chain with pre-computed context.
        """
        if custom_prompt and custom_prompt.strip():
            template = _escape_curly_braces(custom_prompt)
        else:
            if not context_str or context_str.strip() == "":
                template = DEFAULT_NO_CONTEXT_PROMPT
            else:
                escaped_context = _escape_curly_braces(context_str)
                template = self._get_template("", prompt_type).replace(
                    "{context}", escaped_context
                )

        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessagePromptTemplate.from_template(template),
        ]
        prompt = ChatPromptTemplate.from_messages(messages)

        return (
            {"question": RunnablePassthrough()}
            | prompt
            | self.llm.bind(options={"temperature": temperature, "num_predict": 2048})
            | StrOutputParser()
        )


logger = logging.getLogger(__name__)
