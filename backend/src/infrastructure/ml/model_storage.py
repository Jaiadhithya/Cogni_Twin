import json
import os
import logging
from typing import Optional, Protocol, Any
from datetime import datetime

from prophet.serialize import model_to_json, model_from_json
from prophet import Prophet

from src.config import settings

logger = logging.getLogger(__name__)

class ModelStorage(Protocol):
    """Protocol for saving and loading machine learning models."""
    def save_model(self, model: Any, model_id: str, metadata: dict[str, Any]) -> str:
        ...
        
    def load_model(self, model_id: str) -> Optional[Any]:
        ...
        
    def get_latest_model_info(self) -> Optional[dict[str, Any]]:
        ...

class JsonModelStorage(ModelStorage):
    """File-based JSON storage for Prophet models."""
    
    def __init__(self):
        self.models_dir = settings.ML_MODELS_DIR
        self.registry_path = os.path.join(self.models_dir, "model_registry.json")
        os.makedirs(self.models_dir, exist_ok=True)
        
        # Initialize registry if it doesn't exist
        if not os.path.exists(self.registry_path):
            with open(self.registry_path, "w") as f:
                json.dump({"latest_model": None, "history": []}, f)
                
    def _update_registry(self, model_id: str, metadata: dict[str, Any]) -> None:
        try:
            with open(self.registry_path, "r") as f:
                registry = json.load(f)
                
            entry = {
                "model_id": model_id,
                "metadata": metadata,
                "created_at": datetime.now().isoformat()
            }
            
            registry["latest_model"] = entry
            registry["history"].append(entry)
            
            with open(self.registry_path, "w") as f:
                json.dump(registry, f)
        except Exception as e:
            logger.error(f"Failed to update model registry: {e}")
            
    def save_model(self, model: Prophet, model_id: str, metadata: dict[str, Any]) -> str:
        """Save a Prophet model to JSON."""
        model_path = os.path.join(self.models_dir, f"{model_id}.json")
        
        try:
            with open(model_path, "w") as f:
                json.dump(model_to_json(model), f)
                
            self._update_registry(model_id, metadata)
            logger.info(f"Successfully saved model {model_id}")
            return model_path
        except Exception as e:
            logger.error(f"Failed to save model {model_id}: {e}")
            raise
            
    def load_model(self, model_id: str) -> Optional[Prophet]:
        """Load a Prophet model from JSON."""
        model_path = os.path.join(self.models_dir, f"{model_id}.json")
        if not os.path.exists(model_path):
            return None
            
        try:
            with open(model_path, "r") as f:
                model = model_from_json(json.load(f))
            return model
        except Exception as e:
            logger.error(f"Failed to load model {model_id}: {e}")
            return None
            
    def get_latest_model_info(self) -> Optional[dict[str, Any]]:
        """Get information about the latest trained model."""
        try:
            with open(self.registry_path, "r") as f:
                registry = json.load(f)
            return registry.get("latest_model")
        except Exception as e:
            logger.error(f"Failed to read model registry: {e}")
            return None
