"""Schemas for SHAP explainability endpoints."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ShapDriverSchema(BaseModel):
    feature: str
    contribution: float
    description: str

class ShapExplanationResponse(BaseModel):
    product_id: Optional[str] = None
    forecast_date: str
    predicted_value: float
    base_value: Optional[float] = None
    top_positive_drivers: List[ShapDriverSchema] = []
    top_negative_drivers: List[ShapDriverSchema] = []
    forces: Optional[List[Dict[str, Any]]] = None
    explanation_text: Optional[str] = None
    document_context: Optional[List[Dict[str, Any]]] = None
