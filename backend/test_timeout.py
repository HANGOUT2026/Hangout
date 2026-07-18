import requests
import time
import os

BASE_URL = "http://127.0.0.1:8000/api"
test_user = "test_timeout_user_" + str(int(time.time()))

# 1. Register a test user
res = requests.post(f"{BASE_URL}/signup/", json={
    "username": test_user,
    "email": f"{test_user}@example.com",
    "password": "correct_password123"
})
print("Signup:", res.status_code, res.json())

# Helper to attempt login
def login(pwd):
    return requests.post(f"{BASE_URL}/signin/", json={
        "username": test_user,
        "password": pwd
    })

print("\n--- Testing 5 Failed Attempts ---")
for i in range(1, 6):
    res = login("wrong_password")
    print(f"Attempt {i}:", res.status_code, res.json())

print("\n--- Testing Lockout state on 6th attempt ---")
res = login("wrong_password")
print("Attempt 6:", res.status_code, res.json())

print("\n--- Testing Lockout state on 7th attempt (Simulated by sending request while locked) ---")
res = login("wrong_password")
print("Attempt 7 (While Locked):", res.status_code, res.json())

# Note: We can't easily wait 10 minutes to test the >6 timeout without modifying the DB directly in the script,
# but we can see if the 429 logic works.
