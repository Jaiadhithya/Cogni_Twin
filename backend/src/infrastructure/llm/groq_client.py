import json
import logging
from typing import Any
import os
import httpx
from groq import AsyncGroq

from src.domain.interfaces.llm_client import LLMClient
from src.config import settings
from src.domain.exceptions import LlmError, RateLimitError

logger = logging.getLogger(__name__)

class GroqClient(LLMClient):
    """Groq implementation of the LLMClient protocol."""

    def __init__(self):
        try:
            proxy = os.getenv("HTTP_PROXY") or os.getenv("HTTPS_PROXY")
            http_client = httpx.AsyncClient(timeout=15.0, proxy=proxy)
            self.client = AsyncGroq(api_key=settings.GROQ_API_KEY or "dummy_key", timeout=15.0, http_client=http_client)
            self.model_name = settings.GROQ_MODEL_NAME
        except Exception as e:
            logger.error(f"Failed to initialize Groq client: {e}")
            raise LlmError("Failed to initialize LLM client.") from e

    async def generate_sql(self, question: str, schema_context: str, current_date: str) -> str:
        """Generate a PostgreSQL query based on the natural language question."""
        prompt = f"""
You are a PostgreSQL 15 expert data analyst. Your task is to generate a valid, optimized PostgreSQL query based ONLY on the provided schema to answer the user's question.

CRITICAL RULES:
1. ONLY return the raw SQL query. Do not include markdown formatting (like ```sql), markdown blocks, explanations, or any other text.
2. The query MUST be a SELECT statement. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, or GRANT statements.
3. The query MUST be read-only.
4. Use standard ANSI SQL compatible with PostgreSQL 15 (e.g. DATE_TRUNC, INTERVAL, CAST, CASE WHEN).
5. If the question cannot be answered using the provided schema, return exactly the string: ERROR_CANNOT_ANSWER.
6. Assume current date is {current_date}.
7. CRITICAL RULE: You must always append 'LIMIT 20' to every generated SQL query unless the user explicitly asks for an aggregate function like COUNT() or SUM(). You are strictly forbidden from returning more than 20 rows.

SCHEMA:
{schema_context}

USER QUESTION:
{question}
"""
        try:
            response = await self.client.chat.completions.create(
                messages=[
                    {"role": "user", "content": prompt}
                ],
                model=self.model_name,
                temperature=0.0,
                max_tokens=1024,
            )
            
            sql = response.choices[0].message.content.strip()
            
            # Clean up potential markdown formatting just in case the model disobeys
            if sql.startswith("```sql"):
                sql = sql[6:]
            if sql.startswith("```"):
                sql = sql[3:]
            if sql.endswith("```"):
                sql = sql[:-3]
                
            return sql.strip()
            
        except Exception as e:
            error_str = str(e).lower()
            if "429" in error_str or "rate limit" in error_str or "too many requests" in error_str:
                logger.error(f"Groq API rate limit exceeded: {e}")
                raise RateLimitError("LLM API rate limit exceeded. Please try again later.") from e
                
            logger.error(f"Groq API error during SQL generation: {e}")
            raise LlmError(f"Failed to generate SQL: {e}")

    async def format_answer(self, question: str, sql: str, results: list[dict[str, Any]]) -> str:
        """Format the SQL results into a human-readable answer."""
        
        # Limit results in prompt to avoid token limits
        limited_results = results[:50]
        results_str = json.dumps(limited_results, default=str)
        
        prompt = f"""
You are a helpful business intelligence assistant. Your task is to provide a clear, concise, and professional answer to the user's question based on the data retrieved from the database.

CRITICAL RULES:
1. Base your answer ONLY on the provided data results. Do not make up numbers or facts.
2. Keep the answer under 3 paragraphs.
3. If the data is empty or indicates no results, say so clearly.
4. If applicable, highlight key insights (e.g., maximums, minimums, totals).
5. Do not show the SQL query to the user unless explicitly asked in the question.

USER QUESTION:
{question}

SQL EXECUTED (For context only):
{sql}

DATA RESULTS (JSON):
{results_str}
"""
        try:
            response = await self.client.chat.completions.create(
                messages=[
                    {"role": "user", "content": prompt}
                ],
                model=self.model_name,
                temperature=0.3,
                max_tokens=1024,
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            error_str = str(e).lower()
            if "429" in error_str or "rate limit" in error_str or "too many requests" in error_str:
                logger.error(f"Groq API rate limit exceeded: {e}")
                raise RateLimitError("LLM API rate limit exceeded. Please try again later.") from e
                
            logger.error(f"Groq API error during answer formatting: {e}")
            raise LlmError(f"Failed to format answer: {e}")

    async def generate_text(self, prompt: str, model: str | None = None) -> str:
        """Generate text from a prompt."""
        try:
            target_model = model or self.model_name
            response = await self.client.chat.completions.create(
                messages=[
                    {"role": "user", "content": prompt}
                ],
                model=target_model,
                temperature=0.3,
                max_tokens=1024,
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            error_str = str(e).lower()
            if "429" in error_str or "rate limit" in error_str or "too many requests" in error_str:
                logger.error(f"Groq API rate limit exceeded: {e}")
                raise RateLimitError("LLM API rate limit exceeded. Please try again later.") from e
                
            logger.error(f"Groq API error during text generation: {e}")
            raise LlmError(f"Failed to generate text: {e}")

    async def generate(self, prompt: str, system_prompt: str, model: str | None = None, response_format: dict | None = None) -> str:
        try:
            target_model = model or self.model_name
            kwargs = {
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "model": target_model,
                "temperature": 0.0,
            }
            if response_format:
                kwargs["response_format"] = response_format
                
            response = await self.client.chat.completions.create(**kwargs)
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Groq API error during generate: {e}")
            raise LlmError(f"Failed to generate: {e}")

