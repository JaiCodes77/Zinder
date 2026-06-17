import time
import subprocess
import httpx
import sys
import socket
import os

def wait_for_port(port, timeout=10.0):
    start_time = time.time()
    while True:
        try:
            with socket.create_connection(("localhost", port), timeout=0.5):
                break
        except (socket.timeout, ConnectionRefusedError):
            if time.time() - start_time > timeout:
                raise TimeoutError(f"Port {port} did not open in {timeout} seconds")
            time.sleep(0.1)

def run_tests():
    print("Starting Profile Service (port 8081)...")
    profile_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "profile_service.main:app", "--port", "8081"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    print("Starting Matcher Service (port 8082)...")
    matcher_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "matcher_service.main:app", "--port", "8082"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    print("Starting API Gateway (port 8080)...")
    gateway_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--port", "8080"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    try:
        print("Waiting for Profile Service on port 8081...")
        wait_for_port(8081)
        print("Waiting for Matcher Service on port 8082...")
        wait_for_port(8082)
        print("Waiting for Gateway on port 8080...")
        wait_for_port(8080)
        
        # Create HTTPX clients
        client_a = httpx.Client(base_url="http://localhost:8080")
        client_b = httpx.Client(base_url="http://localhost:8080")

        timestamp = int(time.time())
        email_a = f"dev_a_{timestamp}@zinder-test.com"
        email_b = f"dev_b_{timestamp}@zinder-test.com"
        password = "password123"

        # 1. Register User A
        print(f"\n--- 1. Register User A ({email_a}) ---")
        res = client_a.post("/api/v1/auth/register", json={
            "email": email_a,
            "password": password,
            "name": "Developer A"
        })
        print("Register A status:", res.status_code)
        assert res.status_code == 201

        # 2. Register User B
        print(f"\n--- 2. Register User B ({email_b}) ---")
        res = client_b.post("/api/v1/auth/register", json={
            "email": email_b,
            "password": password,
            "name": "Developer B"
        })
        print("Register B status:", res.status_code)
        assert res.status_code == 201

        # 3. Login User A
        print("\n--- 3. Login User A ---")
        res = client_a.post("/api/v1/auth/login", json={
            "email": email_a,
            "password": password
        })
        print("Login A status:", res.status_code)
        assert res.status_code == 200
        cookie_a = res.cookies.get("sessionID") or res.cookies.get("sessionId")
        print("Session Cookie A:", cookie_a)
        assert cookie_a is not None
        client_a.cookies.set("sessionId", cookie_a, domain="localhost")
        client_a.cookies.set("sessionID", cookie_a, domain="localhost")

        # 4. Login User B
        print("\n--- 4. Login User B ---")
        res = client_b.post("/api/v1/auth/login", json={
            "email": email_b,
            "password": password
        })
        print("Login B status:", res.status_code)
        assert res.status_code == 200
        cookie_b = res.cookies.get("sessionID") or res.cookies.get("sessionId")
        print("Session Cookie B:", cookie_b)
        assert cookie_b is not None
        client_b.cookies.set("sessionId", cookie_b, domain="localhost")
        client_b.cookies.set("sessionID", cookie_b, domain="localhost")

        # Get Profiles to fetch user IDs
        res = client_a.get("/api/v1/profiles/me")
        user_id_a = res.json()["user"]["id"]
        print("User ID A:", user_id_a)

        res = client_b.get("/api/v1/profiles/me")
        user_id_b = res.json()["user"]["id"]
        print("User ID B:", user_id_b)

        # 4.5. Update Profile for User A
        print("\n--- 4.5. Update Profile for User A ---")
        res = client_a.post("/api/v1/profiles", json={
            "age": 28,
            "looking_for": "Backend Partner",
            "radius_limit": 25,
            "bio": "Extremely passionate about distributed systems and Redis.",
            "interests": ["Python", "Redis", "FastAPI"]
        })
        print("Update Profile A status:", res.status_code)
        assert res.status_code == 200
        profile_data = res.json()
        print("Updated Profile A:", profile_data)
        assert profile_data["age"] == 28
        assert profile_data["looking_for"] == "Backend Partner"
        assert profile_data["radius_limit"] == 25
        assert profile_data["bio"] == "Extremely passionate about distributed systems and Redis."
        assert "Redis" in profile_data["interests"]

        # 5. Browse candidates for User A
        print("\n--- 5. Browse Candidates for User A ---")
        res = client_a.get("/api/v1/matcher/browse")
        print("Browse A status:", res.status_code)
        candidates = res.json()
        print("Candidates count:", len(candidates))
        candidate_ids = [c["user_id"] for c in candidates]
        print("Candidate IDs:", candidate_ids)
        assert user_id_b in candidate_ids

        # 6. Swipe LIKE from User A -> User B
        print(f"\n--- 6. Swipe LIKE User A ({user_id_a}) -> User B ({user_id_b}) ---")
        res = client_a.post("/api/v1/matcher/swipe", json={
            "swiped_id": user_id_b,
            "action": "LIKE"
        })
        print("Swipe A->B status:", res.status_code)
        print("Swipe A->B response:", res.json())
        assert res.status_code == 200
        assert res.json()["is_match"] is False

        # 7. Browse candidates for User A again
        print("\n--- 7. Browse Candidates for User A (Should not contain User B) ---")
        res = client_a.get("/api/v1/matcher/browse")
        candidates = res.json()
        candidate_ids = [c["user_id"] for c in candidates]
        print("Candidate IDs after swipe:", candidate_ids)
        assert user_id_b not in candidate_ids

        # 8. Browse candidates for User B
        print("\n--- 8. Browse Candidates for User B ---")
        res = client_b.get("/api/v1/matcher/browse")
        candidates = res.json()
        candidate_ids = [c["user_id"] for c in candidates]
        print("User B Candidates count:", len(candidates))
        print("User B Candidate IDs:", candidate_ids)
        assert user_id_a in candidate_ids

        # 9. Swipe LIKE from User B -> User A
        print(f"\n--- 9. Swipe LIKE User B ({user_id_b}) -> User A ({user_id_a}) ---")
        res = client_b.post("/api/v1/matcher/swipe", json={
            "swiped_id": user_id_a,
            "action": "LIKE"
        })
        print("Swipe B->A status:", res.status_code)
        swipe_res = res.json()
        print("Swipe B->A response:", swipe_res)
        assert res.status_code == 200
        assert swipe_res["is_match"] is True
        assert swipe_res["match_id"] is not None

        # 10. Verify matches for both users
        print("\n--- 10. Verify matches list for User A ---")
        res = client_a.get("/api/v1/matcher/matches")
        matches_a = res.json()
        print("Matches A:", matches_a)
        assert len(matches_a) > 0
        assert matches_a[0]["matched_user_id"] == user_id_b
        assert matches_a[0]["matched_user_name"] == "Developer B"

        print("\n--- 11. Verify matches list for User B ---")
        res = client_b.get("/api/v1/matcher/matches")
        matches_b = res.json()
        print("Matches B:", matches_b)
        assert len(matches_b) > 0
        assert matches_b[0]["matched_user_id"] == user_id_a
        assert matches_b[0]["matched_user_name"] == "Developer A"

        print("\nAll Matcher Integration Tests Passed Successfully! 🚀")

    finally:
        print("\nStopping microservices...")
        gateway_proc.terminate()
        matcher_proc.terminate()
        profile_proc.terminate()
        
        gateway_proc.wait()
        matcher_proc.wait()
        profile_proc.wait()
        print("Microservices stopped.")

if __name__ == "__main__":
    run_tests()
