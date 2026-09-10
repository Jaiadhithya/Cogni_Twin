from typing import Optional, Any, List, Literal, Dict, Union
from pydantic import BaseModel, Field

class ChartSpec(BaseModel):
    type: Literal["line", "bar", "scatter", "pie", "area"]
    title: str
    description: Optional[str] = None
    x_key: str
    y_keys: List[str]
    data: List[Dict[str, Any]]

class PrescriptiveAction(BaseModel):
    priority: int
    action: str
    expected_impact: str
    timeframe: str

class QueryRequest(BaseModel):
    question: str = Field(..., min_length=5, max_length=500)
    dataset_id: Optional[str] = None

class QueryResponseData(BaseModel):
    question: str
    answer: str
    insights: List[str] = Field(default_factory=list)
    prescriptive_actions: List[PrescriptiveAction] = Field(default_factory=list)
    charts: List[ChartSpec] = Field(default_factory=list)
    generated_sql: Optional[str] = ""
    raw_data: Any = Field(default_factory=list)
    confidence: str = "high"
