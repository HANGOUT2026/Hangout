from django.contrib.auth.models import User

# Change this line at the top of your meetings/views.py file:
from .models import MeetingRecording, Room, MeetingNote
import json

# Create your views here.
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone


@csrf_exempt
@csrf_exempt
def upload_recording(request):
    if request.method == "POST":
        video_file = request.FILES.get("video_file")
        room_uuid = request.POST.get("room_id")
        username_str = request.POST.get("username")

        if not video_file or not room_uuid or not username_str:
            return JsonResponse({"error": "Missing required fields"}, status=400)

        try:
            # 1. Dynamically fetch or create the user (to support Neon Auth users)
            actual_user, _ = User.objects.get_or_create(username=username_str)

            # 2. FIXED: Dynamically fetch or create the room if it's a new link!
            actual_room, created = Room.objects.get_or_create(room_id=room_uuid)

            # 3. Save the recording with relation keys
            recording = MeetingRecording.objects.create(
                user=actual_user, room=actual_room, video_file=video_file
            )
            return JsonResponse({"message": "Upload successful", "id": recording.id})

        except User.DoesNotExist:
            return JsonResponse(
                {"error": f"User '{username_str}' does not exist"}, status=404
            )

    return JsonResponse({"error": "Invalid method"}, status=405)


def get_user_recordings(request, username):
    # Fetch or create the user (to support Neon Auth users)
    actual_user, _ = User.objects.get_or_create(username=username)

    # 1. Clean up expired records on-the-fly using the 'user' relational field
    expired_recordings = MeetingRecording.objects.filter(
        user=actual_user, expires_at__lte=timezone.now()
    )
    for rec in expired_recordings:
        if rec.video_file:
            rec.video_file.delete(
                save=False
            )  # Deletes the actual storage asset file from disk
        rec.delete()  # Wipes row instance from the database table

    # 2. Fetch remaining valid active listings (Fixed: changed .order_index to .order_by)
    recordings = MeetingRecording.objects.filter(user=actual_user).order_by(
        "-created_at"
    )

    data = []
    for r in recordings:
        # Calculate exactly how many days are left before expiry
        days_left = (r.expires_at - timezone.now()).days
        data.append(
            {
                "id": r.id,
                "room_id": str(
                    r.room.room_id
                ),  # Accesses the room_id property from the related Room object
                "file_url": request.build_absolute_uri(r.video_file.url),
                "created_at": r.created_at.strftime("%Y-%m-%d %H:%M"),
                "days_remaining": max(0, days_left),
            }
        )

    return JsonResponse({"recordings": data})

@csrf_exempt
def delete_recording(request, recording_id):
    if request.method == "DELETE":
        try:
            recording = MeetingRecording.objects.get(id=recording_id)
            if recording.video_file:
                recording.video_file.delete(save=False)
            recording.delete()
            return JsonResponse({"message": "Recording deleted successfully"})
        except MeetingRecording.DoesNotExist:
            return JsonResponse({"error": "Recording not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid method"}, status=405)


@csrf_exempt
def save_note(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            room_uuid = data.get("room_id")
            username_str = data.get("username")
            content = data.get("content")

            if not room_uuid or not username_str or content is None:
                return JsonResponse({"error": "Missing required fields"}, status=400)

            actual_user, _ = User.objects.get_or_create(username=username_str)
            actual_room, created = Room.objects.get_or_create(room_id=room_uuid)

            note = MeetingNote.objects.create(
                user=actual_user, room=actual_room, content=content
            )
            return JsonResponse({"message": "Note saved successfully", "id": note.id})
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid method"}, status=405)


def get_user_notes(request, username):
    actual_user, _ = User.objects.get_or_create(username=username)

    notes = MeetingNote.objects.filter(user=actual_user).order_by("-created_at")
    data = []
    for n in notes:
        data.append({
            "id": n.id,
            "room_id": str(n.room.room_id),
            "content": n.content,
            "created_at": n.created_at.strftime("%Y-%m-%d %H:%M"),
        })

    return JsonResponse({"notes": data})

@csrf_exempt
def delete_note(request, note_id):
    if request.method == "DELETE":
        try:
            note = MeetingNote.objects.get(id=note_id)
            note.delete()
            return JsonResponse({"message": "Note deleted successfully"})
        except MeetingNote.DoesNotExist:
            return JsonResponse({"error": "Note not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid method"}, status=405)

def validate_room(request, room_id):
    # Rooms are ephemeral in WebSocket memory until a recording/note is saved.
    # We only validate that the room code is a valid string.
    if room_id and len(room_id) >= 3:
        return JsonResponse({'exists': True}, status=200)
    else:
        return JsonResponse({'exists': False, 'error': 'Invalid Room Code'}, status=404)