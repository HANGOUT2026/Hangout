# core/urls.py
from django.contrib import admin
from django.urls import path, include
from meetings import (
    views as meeting_views,
)  # Points directly to the meetings app views [cite: 142]

# CRITICAL IMPORTS FOR SERVING MEDIA RECORDINGS:
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path(
        "api/", include("users.urls")
    ),  # If you have a users app mapped [cite: 133, 359]
    # Recording Action API Endpoints [cite: 142]
    path(
        "api/recordings/upload/",
        meeting_views.upload_recording,
        name="upload_recording",
    ),
    path(
        "api/recordings/<str:username>/",
        meeting_views.get_user_recordings,
        name="get_user_recordings",
    ),
    path(
        "api/recordings/delete/<int:recording_id>/",
        meeting_views.delete_recording,
        name="delete_recording",
    ),
    path(
        "api/notes/save/",
        meeting_views.save_note,
        name="save_note",
    ),
    path(
        "api/notes/<str:username>/",
        meeting_views.get_user_notes,
        name="get_user_notes",
    ),
    path(
        "api/notes/delete/<int:note_id>/",
        meeting_views.delete_note,
        name="delete_note",
    ),
    path('api/validate-room/<str:room_id>/', meeting_views.validate_room, name='validate_room'),
]

# Append media file asset lookups for local system debugging
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
