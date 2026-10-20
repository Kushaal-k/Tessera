"""Tests for RAG text chunking (`src.rag._split_into_chunks`).

These verify the core invariant that every returned chunk respects `chunk_size`,
including the edge case where a single token is longer than `chunk_size`. No
MongoDB or embedding service is required.
"""

from src.rag import _split_into_chunks


def test_empty_text_returns_no_chunks():
    assert _split_into_chunks("", 64) == []
    assert _split_into_chunks("   ", 64) == []


def test_short_text_is_a_single_chunk():
    assert _split_into_chunks("hello world", 64) == ["hello world"]


def test_normal_text_splits_into_multiple_chunks():
    text = " ".join(f"word{i}" for i in range(50))
    chunks = _split_into_chunks(text, 32)
    assert len(chunks) > 1


def test_every_chunk_respects_chunk_size_for_normal_text():
    text = " ".join(f"token{i}" for i in range(200))
    chunk_size = 40
    for chunk in _split_into_chunks(text, chunk_size):
        assert len(chunk) <= chunk_size


def test_normal_text_is_preserved_in_order():
    # When no token is hard-split, re-joining the chunks must reproduce the input.
    text = " ".join(f"w{i}" for i in range(120))
    chunks = _split_into_chunks(text, 50)
    assert " ".join(chunks).split() == text.split()


def test_oversized_single_token_is_hard_split():
    # Regression: previously this returned one chunk of length 33 for chunk_size 10.
    chunk_size = 10
    word = "x" * 33
    chunks = _split_into_chunks(word, chunk_size)

    assert all(len(c) <= chunk_size for c in chunks)
    # No characters lost or added by the hard split.
    assert "".join(chunks) == word
    assert chunks == ["x" * 10, "x" * 10, "x" * 10, "x" * 3]


def test_oversized_token_among_normal_words():
    chunk_size = 12
    text = f"alpha beta {'z' * 30} gamma"
    chunks = _split_into_chunks(text, chunk_size)

    assert all(len(c) <= chunk_size for c in chunks)
    # The long token's characters survive intact across the hard-split pieces.
    assert "".join(chunks).count("z") == 30
    # Surrounding words are still present.
    joined = " ".join(chunks)
    assert "alpha" in joined and "beta" in joined and "gamma" in joined


def test_token_exactly_chunk_size_is_one_chunk():
    chunk_size = 8
    word = "a" * 8
    assert _split_into_chunks(word, chunk_size) == [word]
