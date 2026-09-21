from fastapi import APIRouter, Depends, HTTPException
from app.api.routes.auth import get_current_user_dependency
from app.models.schemas import UserResponse
from app.services.citation_service import get_citation_stats

router = APIRouter(tags=['citations'])


@router.get('/citations/stats')
async def citation_stats(knowledge_id: str, current_user: UserResponse = Depends(get_current_user_dependency)):
    try:
        return {'data': await get_citation_stats(knowledge_id, current_user.id)}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
