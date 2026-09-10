from enum import Enum

class QueryIntent(str, Enum):
    """Represents the classified intent of a natural language query."""
    SQL = "SQL"
    DOCUMENT = "DOCUMENT"
    EXPLAIN = "EXPLAIN"
    FUSED = "FUSED"
    SIMULATION = "SIMULATION"
