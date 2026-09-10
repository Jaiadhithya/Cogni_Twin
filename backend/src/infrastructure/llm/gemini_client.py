import json
import logging
from typing import Any
import google.generativeai as genai

from src.domain.interfaces.llm_client import LLMClient
from src.config import settings
from src.domain.exceptions import LlmError

logger = logging.getLogger(__name__)

class GeminiClient(LLMClient):
    """Google Gemini implementation of the LLMClient protocol."""

    def __init__(self):
        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model_name = settings.GEMINI_MODEL_NAME
        except Exception as e:
            logger.error(f"Failed to initialize Gemini client: {e}")
            raise LlmError("Failed to initialize LLM client.") from e

    async def generate_sql(self, question: str, schema_context: str, current_date: str) -> str:
        """Generate a PostgreSQL query based on the natural language question."""
        prompt = f"""
You are a PostgreSQL expert data analyst. Your task is to generate a valid, optimized PostgreSQL query based ONLY on the provided schema to answer the user's question.

CRITICAL RULES:
1. ONLY return the raw SQL query. Do not include markdown formatting (like ```sql), markdown blocks, explanations, or any other text.
2. The query MUST be a SELECT statement. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, or GRANT statements.
3. The query MUST be read-only.
4. Use standard ANSI SQL that is compatible with PostgreSQL 15+.
5. If the question cannot be answered using the provided schema, return exactly the string: ERROR_CANNOT_ANSWER.
6. Assume current date is {current_date}.

SCHEMA:
{schema_context}

USER QUESTION:
{question}
"""
        try:
            model = genai.GenerativeModel(self.model_name)
            # Use low temperature for deterministic SQL generation
            generation_config = genai.types.GenerationConfig(
                temperature=0.0,
                max_output_tokens=1024,
            )
            
            # Using generate_content_async for async support
            response = await model.generate_content_async(
                contents=prompt,
                generation_config=generation_config
            )
            
            sql = response.text.strip()
            
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
            if "429" in error_str or "resourceexhausted" in error_str or "too many requests" in error_str:
                logger.error(f"Gemini API rate limit exceeded: {e}")
                from src.domain.exceptions import RateLimitError
                raise RateLimitError("LLM API rate limit exceeded. Please try again later.") from e
                
            logger.error(f"Gemini API error during SQL generation: {e}")
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
            model = genai.GenerativeModel(self.model_name)
            # Use slight temperature for more natural language
            generation_config = genai.types.GenerationConfig(
                temperature=0.3,
                max_output_tokens=1024,
            )
            
            response = await model.generate_content_async(
                contents=prompt,
                generation_config=generation_config
            )
            
            return response.text.strip()
            
        except Exception as e:
            error_str = str(e).lower()
            if "429" in error_str or "resourceexhausted" in error_str or "too many requests" in error_str:
                logger.error(f"Gemini API rate limit exceeded: {e}")
                from src.domain.exceptions import RateLimitError
                raise RateLimitError("LLM API rate limit exceeded. Please try again later.") from e
                
            logger.error(f"Gemini API error during answer formatting: {e}")
            raise LlmError(f"Failed to format answer: {e}")
