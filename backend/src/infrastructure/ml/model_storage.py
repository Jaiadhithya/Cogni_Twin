import json
import os
import logging
import tempfile
import threading
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
        
    def get_latest_model_info(self, dataset_id: Optional[str] = None) -> Optional[dict[str, Any]]:
        ...

    def load_model_for_dataset(self, dataset_id: str) -> Optional[Any]:
        ...

class JsonModelStorage(ModelStorage):
    """File-based JSON storage for Prophet models."""
    
    def __init__(self):
        self.models_dir = settings.ML_MODELS_DIR
        self.registry_path = os.path.join(self.models_dir, "model_registry.json")
        self._write_lock = threading.Lock()
        os.makedirs(self.models_dir, exist_ok=True)

        # Initialize registry if it doesn't exist
        if not os.path.exists(self.registry_path):
            self._atomic_write(
                self.registry_path,
                json.dumps({"latest_model": None, "history": [], "by_dataset": {}}),
            )

    def _atomic_write(self, path: str, content: str) -> None:
        """Write ``content`` to ``path`` atomically via a temp file + os.replace."""
        fd, tmp_path = tempfile.mkstemp(dir=self.models_dir, suffix=".tmp")
        try:
            with os.fdopen(fd, "w") as f:
                f.write(content)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, path)
        except Exception:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            raise

    def _update_registry(self, model_id: str, metadata: dict[str, Any]) -> None:
        """Update the registry. Caller must hold ``self._write_lock``."""
        try:
            with open(self.registry_path, "r") as f:
                registry = json.load(f)

            entry = {
                "model_id": model_id,
                "metadata": metadata,
                "created_at": datetime.now().isoformat()
            }

            registry["latest_model"] = entry
            registry.setdefault("history", []).append(entry)

            dataset_id = metadata.get("dataset_id")
            if dataset_id:
                registry.setdefault("by_dataset", {})[str(dataset_id)] = entry

            self._atomic_write(
                self.registry_path,
                json.dumps(registry, indent=2),
            )
        except Exception as e:
            logger.error(f"Failed to update model registry: {e}")

    def save_model(self, model: Prophet, model_id: str, metadata: dict[str, Any]) -> str:
        """Save a Prophet model to JSON."""
        model_path = os.path.join(self.models_dir, f"{model_id}.json")

        try:
            with self._write_lock:
                self._atomic_write(model_path, json.dumps(model_to_json(model)))
                self._update_registry(model_id, metadata)
            logger.info(f"Successfully saved model {model_id} (dataset_id={metadata.get('dataset_id')})")
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

    def load_model_for_dataset(self, dataset_id: str) -> Optional[Prophet]:
        """Load the latest trained model for a specific dataset."""
        info = self.get_latest_model_info(dataset_id=dataset_id)
        if info and "model_id" in info:
            return self.load_model(info["model_id"])
        return None
            
    def get_latest_model_info(self, dataset_id: Optional[str] = None) -> Optional[dict[str, Any]]:
        """Get information about the latest trained model, optionally scoped to a dataset."""
        try:
            with open(self.registry_path, "r") as f:
                registry = json.load(f)
                
            if dataset_id:
                by_ds = registry.get("by_dataset", {})
                if str(dataset_id) in by_ds:
                    return by_ds[str(dataset_id)]
                for entry in reversed(registry.get("history", [])):
                    if str(entry.get("metadata", {}).get("dataset_id")) == str(dataset_id):
                        return entry
                return None
                
            return registry.get("latest_model")
        except Exception as e:
            logger.error(f"Failed to read model registry: {e}")
            return None
