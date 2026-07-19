from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from .models import LoginAttempt


@api_view(["POST"])
def signup(request):
    username = request.data.get("username")
    email = request.data.get("email")
    password = request.data.get("password")

    if User.objects.filter(username=username).exists():
        return Response({"error": "Username already exists"}, status=400)

    User.objects.create_user(username=username, email=email, password=password)

    return Response({"message": "User created successfully"}, status=201)


@api_view(["POST"])
def signin(request):
    username = request.data.get("username")
    password = request.data.get("password")

    if not username:
        return Response({"error": "Username is required"}, status=400)

    attempt, _ = LoginAttempt.objects.get_or_create(username=username)

    if attempt.locked_until and timezone.now() < attempt.locked_until:
        remaining = int((attempt.locked_until - timezone.now()).total_seconds())
        return Response({
            "error": "Too many failed attempts.",
            "lockout_seconds_remaining": remaining
        }, status=429)

    user = authenticate(username=username, password=password)
    
    if user is None:
        try:
            # In case the user entered their email instead of username
            user_obj = User.objects.get(email=username)
            user = authenticate(username=user_obj.username, password=password)
        except (User.DoesNotExist, User.MultipleObjectsReturned):
            pass

    if user is not None:
        attempt.failed_attempts = 0
        attempt.locked_until = None
        attempt.save()
        return Response({"message": "Login successful", "username": user.username})
    else:
        attempt.failed_attempts += 1
        
        if attempt.failed_attempts == 5:
            attempt.locked_until = timezone.now() + timedelta(minutes=1)
        elif attempt.failed_attempts == 6:
            attempt.locked_until = timezone.now() + timedelta(minutes=10)
        elif attempt.failed_attempts >= 7:
            attempt.locked_until = timezone.now() + timedelta(minutes=30)
            
        attempt.save()

        if attempt.locked_until:
            remaining = int((attempt.locked_until - timezone.now()).total_seconds())
            return Response({
                "error": "Too many failed attempts.",
                "lockout_seconds_remaining": remaining
            }, status=429)
            
        return Response(
            {"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
        )
