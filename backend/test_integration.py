import time
import subprocess
import httpx
import sys

def run_tests():
    print("Starting Profile Service (port 8081)...")
    profile_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "profile_service.main:app", "--port", "8081"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    print("Starting API Gateway (port 8080)...")
    gateway_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--port", "8080"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    # Wait a moment for services to start dynamically
    import socket
    def wait_for_port(port, timeout=10.0):
        start_time = time.time()
        while True:
            try:
                with socket.create_connection(("localhost", port), timeout=0.5):
                    break
            except (socket.timeout, ConnectionRefusedError):
                if time.time() - start_time > timeout:
                    print(f"Uvicorn on port {port} failed to start. Checking if process is alive...")
                    raise TimeoutError(f"Port {port} did not open in {timeout} seconds")
                time.sleep(0.1)

    try:
        print("Waiting for Profile Service on port 8081...")
        wait_for_port(8081)
        print("Waiting for Gateway on port 8080...")
        wait_for_port(8080)
        # Create a client that will keep session cookies
        client = httpx.Client(base_url="http://localhost:8080")
        
        # 1. Test Registration
        email = "test_developer@zinder.internal"
        password = "securepassword123"
        name = "Test Developer"
        print(f"\n--- 1. Testing Registration for {email} ---")
        reg_res = client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": password, "name": name}
        )
        print("Status Code:", reg_res.status_code)
        print("Response Body:", reg_res.json())
        assert reg_res.status_code == 201 or reg_res.status_code == 400  # 400 is fine if already registered
        
        # 2. Test Login
        print(f"\n--- 2. Testing Login for {email} ---")
        login_res = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password}
        )
        print("Status Code:", login_res.status_code)
        print("Response Body:", login_res.json())
        print("Session Cookies:", login_res.cookies)
        assert login_res.status_code == 200
        
        # 3. Test Get My Profile (Protected)
        print("\n--- 3. Testing Get Authenticated Profile ---")
        # Support both sessionId and sessionID casings
        session_id = login_res.cookies.get("sessionID") or login_res.cookies.get("sessionId")
        if session_id:
            client.cookies.set("sessionID", session_id, domain="localhost")
            client.cookies.set("sessionId", session_id, domain="localhost")
            client.cookies.set("sessionID", session_id)
            client.cookies.set("sessionId", session_id)
        profile_res = client.get("/api/v1/profiles/me")
        print("Status Code:", profile_res.status_code)
        print("Response Body:", profile_res.json())
        assert profile_res.status_code == 200
        assert profile_res.json()["user"]["email"] == email
        
        # 4. Test Post a Project Request (Protected)
        print("\n--- 4. Testing Post New Project Help Request ---")
        proj_payload = {
            "title": "Need assistance with FastAPIs dependency injection",
            "description": "I am struggling to structure my dependency injection logic for mock databases. Looking for someone with advanced FastAPI knowledge to review my code.",
            "tech_stack": ["FastAPI", "Python", "pytest"]
        }
        proj_post_res = client.post("/api/v1/projects", json=proj_payload)
        print("Status Code:", proj_post_res.status_code)
        print("Response Body:", proj_post_res.json())
        assert proj_post_res.status_code == 201
        
        # 5. Test Get Projects List (Protected)
        print("\n--- 5. Testing Get All Project Help Requests ---")
        projects_res = client.get("/api/v1/projects")
        print("Status Code:", projects_res.status_code)
        projects_data = projects_res.json()
        print("Number of projects found:", len(projects_data))
        print("First Project details:")
        print("  Title:", projects_data[0]["title"])
        print("  Posted by:", projects_data[0]["user_name"])
        print("  Tech stack:", projects_data[0]["tech_stack"])
        assert projects_res.status_code == 200
        assert len(projects_data) >= 3  # 2 seeded + 1 created
        
        print("\nAll integration tests passed successfully! 🚀")
        
    except Exception as e:
        print("\nTest failed with exception:", e)
        if 'reg_res' in locals():
            print("Registration output:", reg_res.text)
        if 'login_res' in locals():
            print("Login output:", login_res.text)
        if 'profile_res' in locals():
            print("Profile output:", profile_res.text)
    finally:
        print("\nStopping services...")
        gateway_proc.terminate()
        profile_proc.terminate()
        gateway_proc.wait()
        profile_proc.wait()
        print("Services stopped.")

if __name__ == "__main__":
    run_tests()
