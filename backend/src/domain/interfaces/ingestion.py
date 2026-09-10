from typing import Protocol, List, Tuple, Dict, Any
from src.domain.value_objects import EntityType

class ISchemaMapper(Protocol):
    def map_columns(self, entity_type: EntityType, columns: List[str]) -> Tuple[Dict[str, str], List[str]]:
        ...

class IDataCleaner(Protocol):
    def clean(self, df: Any, entity_type: EntityType, mapping: Dict[str, str]) -> Tuple[Any, List[str], int]:
        ...

class IRowValidator(Protocol):
    def validate(self, df: Any, entity_type: EntityType) -> Tuple[List[Dict[str, Any]], List[str], List[str]]:
        ...
