"""Batch ID list limits for task-queue APIs (Sonar S6680)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.main import EnqueueProfileEntityUpdateBatchBody
from app.task_queue_service import TASK_QUEUE_BATCH_IDS_MAX


def test_profile_entity_update_batch_rejects_oversized_id_list():
    ids = list(range(1, TASK_QUEUE_BATCH_IDS_MAX + 2))
    with pytest.raises(ValidationError):
        EnqueueProfileEntityUpdateBatchBody(config_entry_ids=ids, payload={})


def test_profile_entity_update_batch_accepts_max_sized_list():
    ids = list(range(1, TASK_QUEUE_BATCH_IDS_MAX + 1))
    b = EnqueueProfileEntityUpdateBatchBody(config_entry_ids=ids, payload={})
    assert len(b.config_entry_ids) == TASK_QUEUE_BATCH_IDS_MAX
