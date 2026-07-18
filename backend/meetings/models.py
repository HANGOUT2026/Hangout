# meetings/models.py
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta


def fifteen_days_from_now():
    return timezone.now() + timedelta(days=15)


class Room(models.Model):
    room_id = models.CharField(max_length=50, unique=True, primary_key=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        
        return self.room_id


class MeetingRecording(models.Model):
    # Relational foreign keys linked directly to your models
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="recordings")
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="recordings")
    video_file = models.FileField(upload_to="recordings/")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=fifteen_days_from_now)

    def is_expired(self):
        return timezone.now() >= self.expires_at

    def __str__(self):
        return f"Recording-{self.room.room_id} by {self.user.username}"


class MeetingNote(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notes")
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="notes")
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Note-{self.room.room_id} by {self.user.username}"
