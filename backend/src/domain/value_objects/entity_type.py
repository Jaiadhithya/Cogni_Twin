"""EntityType enum — defines the business entity types supported by CogniTwin."""

from enum import Enum


class EntityType(str, Enum):
    """Business entity types that can be uploaded and queried.

    Inherits from str so it can be used directly in URL paths
    and serialized to JSON without conversion.
    """

    SALES = "sales"
    PRODUCTS = "products"
    CUSTOMERS = "customers"
    INVENTORY = "inventory"
    SUPPLIERS = "suppliers"
