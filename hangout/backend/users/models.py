from django.db import models

class SignupUser(models.Model):
    username = models.CharField(max_length=100)
    email = models.EmailField()

class LoginAttempt(models.Model):
    username = models.CharField(max_length=100, unique=True)
    failed_attempts = models.IntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
