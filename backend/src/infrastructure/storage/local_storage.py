"""Local-disk FileStorage."""

import os
import tempfile
from contextlib import contextmanager
from typing import BinaryIO, Iterator

from src.domain.exceptions import ValidationError
from src.domain.interfaces.file_storage import FileStorage


class LocalFileStorage(FileStorage):
    def __init__(self, root: str):
        self.root = os.path.abspath(root)

    def _path(self, key: str) -> str:
        if not key or key != os.path.basename(key) or key in (".", ".."):
            raise ValidationError(f"Invalid storage key: {key!r}")
        return os.path.join(self.root, key)

    def local_path(self, key: str) -> str:
        return self._path(key)

    def write(self, key: str, data: bytes) -> None:
        """Atomic write: a reader never sees a half-written file."""
        path = self._path(key)
        os.makedirs(self.root, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=self.root, suffix=".tmp")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(data)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, path)
        except Exception:
            if os.path.exists(tmp):
                os.remove(tmp)
            raise

    @contextmanager
    def open_writer(self, key: str) -> Iterator[BinaryIO]:
        path = self._path(key)
        os.makedirs(self.root, exist_ok=True)
        with open(path, "wb") as f:
            yield f

    def read(self, key: str) -> bytes:
        with open(self._path(key), "rb") as f:
            return f.read()

    def exists(self, key: str) -> bool:
        return os.path.exists(self._path(key))

    def delete(self, key: str) -> None:
        try:
            os.remove(self._path(key))
        except FileNotFoundError:
            pass
