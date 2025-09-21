import asyncio
from datetime import datetime
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.main import analysis_worker
import app.main as app_main
from app.models.request import RequestStatus
from app.services.request_service import RequestService
import app.services.request_service as request_service_module


class DummyManager:
    def __init__(self) -> None:
        self.broadcasts: List[Dict[str, Any]] = []

    async def broadcast_request_created(self, payload: Dict[str, Any]) -> None:
        self.broadcasts.append(payload)


@pytest.mark.asyncio
async def test_create_request_returns_tuple_without_enqueue():
    mock_db = AsyncMock()
    queue: asyncio.Queue[int] = asyncio.Queue()
    manager = DummyManager()

    mock_request = MagicMock()
    mock_request.id = 123
    mock_request.status = RequestStatus.QUEUED
    mock_request.created_at = datetime.utcnow()
    mock_request.updated_at = mock_request.created_at
    mock_request.image_references = []
    mock_request.error_message = None

    mock_db.refresh = AsyncMock()

    with patch(
        "app.services.request_service.crud.crud_request.create_with_images",
        AsyncMock(return_value=mock_request),
    ) as create_mock, patch.object(
        request_service_module, "db_logger"
    ) as db_logger_mock:  # type: ignore[attr-defined]
        db_logger_mock.info = AsyncMock()
        db_logger_mock.warning = AsyncMock()
        db_logger_mock.error = AsyncMock()
        db_logger_mock.critical = AsyncMock()

        service = RequestService(db=mock_db, analysis_queue=queue, manager=manager)
        db_request, payload = await service.create_request(user_prompt="Prompt", images=None)

        create_mock.assert_awaited_once()
        mock_db.refresh.assert_awaited_once_with(mock_request)
        assert db_request is mock_request
        assert payload["id"] == mock_request.id
        assert queue.qsize() == 0
        assert manager.broadcasts == []


@pytest.mark.asyncio
async def test_regenerate_request_returns_tuple_without_enqueue():
    mock_db = AsyncMock()
    queue: asyncio.Queue[int] = asyncio.Queue()
    manager = DummyManager()

    original_request = MagicMock()
    original_request.id = 1
    original_request.user_prompt = "Prompt"
    original_request.image_references = []
    original_request.status = RequestStatus.COMPLETED

    new_request = MagicMock()
    new_request.id = 2
    new_request.status = RequestStatus.QUEUED
    new_request.created_at = datetime.utcnow()
    new_request.updated_at = new_request.created_at
    new_request.image_references = []
    new_request.error_message = None

    mock_db.refresh = AsyncMock()

    with patch(
        "app.services.request_service.crud.crud_request.get_or_404",
        AsyncMock(return_value=original_request),
    ) as get_mock, patch(
        "app.services.request_service.crud.crud_request.create_with_images",
        AsyncMock(return_value=new_request),
    ) as create_mock, patch.object(
        request_service_module, "db_logger"
    ) as db_logger_mock:  # type: ignore[attr-defined]
        db_logger_mock.info = AsyncMock()
        db_logger_mock.warning = AsyncMock()
        db_logger_mock.error = AsyncMock()
        db_logger_mock.critical = AsyncMock()

        service = RequestService(db=mock_db, analysis_queue=queue, manager=manager)
        regenerated, payload = await service.regenerate_request(original_request_id=original_request.id)

        get_mock.assert_awaited_once_with(mock_db, id=original_request.id)
        create_mock.assert_awaited_once()
        mock_db.refresh.assert_awaited_once_with(new_request)
        assert regenerated is new_request
        assert payload["id"] == new_request.id
        assert queue.qsize() == 0
        assert manager.broadcasts == []


@pytest.mark.asyncio
async def test_analysis_worker_processes_request_after_commit(monkeypatch):
    queue: asyncio.Queue[int] = asyncio.Queue()
    processed = asyncio.Event()

    async def fake_process(request_id: int) -> None:
        assert request_id == 42
        processed.set()

    monkeypatch.setattr(app_main, "process_analysis_request", fake_process)

    worker_task = asyncio.create_task(analysis_worker(queue))
    try:
        await queue.put(42)
        await asyncio.wait_for(processed.wait(), timeout=2.0)
        await asyncio.wait_for(queue.join(), timeout=2.0)
    finally:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass
