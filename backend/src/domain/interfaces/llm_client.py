"""LLM client protocol."""

from typing import Protocol, Any

class LLMClient(Protocol):
    """LLM client protocol."""
    
    async def generate_sql(self, question: str, schema_context: str, current_date: str) -> str:
        ...
        
    async def format_answer(self, question: str, sql: str, results: list[dict[str, Any]]) -> str:
        ...

    async def generate_text(self, prompt: str, model: str | None = None) -> str:
        ...

    async def generate(self, prompt: str, system_prompt: str, model: str | None = None, response_format: dict | None = None) -> str:
        ...
