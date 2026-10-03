import pytest

from src.domain.exceptions import ValidationError
from src.infrastructure.storage.local_storage import LocalFileStorage


def test_roundtrip_exists_delete(tmp_path):
    s = LocalFileStorage(str(tmp_path / "files"))
    s.write("a.json", b"hello")
    assert s.exists("a.json") and s.read("a.json") == b"hello"
    s.write("a.json", b"world")
    assert s.read("a.json") == b"world"
    assert [p.name for p in (tmp_path / "files").iterdir()] == ["a.json"]  # no temp files left behind
    s.delete("a.json")
    s.delete("a.json")  # idempotent
    assert not s.exists("a.json")


def test_streaming_writer_and_local_path(tmp_path):
    s = LocalFileStorage(str(tmp_path))
    with s.open_writer("x.pdf") as f:
        f.write(b"%PDF-")
    assert open(s.local_path("x.pdf"), "rb").read() == b"%PDF-"


@pytest.mark.parametrize("key", ["../evil", "a/b", "", "..", "/etc/passwd"])
def test_keys_cannot_escape_the_root(tmp_path, key):
    with pytest.raises(ValidationError):
        LocalFileStorage(str(tmp_path)).write(key, b"x")
