import os
import secrets
import requests
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from fastapi.responses import RedirectResponse
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/auth/tableau", tags=["auth"])

# Environment Variables (with fallbacks for local dev)
CLIENT_ID = os.getenv("TABLEAU_CLIENT_ID", "")
SECRET_ID = os.getenv("TABLEAU_SECRET_ID", "")
SECRET_VALUE = os.getenv("TABLEAU_SECRET_VALUE", "")
TABLEAU_BASE_URL = os.getenv("TABLEAU_BASE_URL", "https://sso.online.tableau.com")

# Minimal in-memory session store for hackathon (use Redis/DB in prod)
# Map: state -> nonce/metadata
pending_states = {}

@router.get("/login")
def login(request: Request):
    """
    Redirects the user to the Tableau authorization page.
    """
    if not CLIENT_ID:
        raise HTTPException(status_code=500, detail="TABLEAU_CLIENT_ID not configured")

    # Generate a random state to prevent CSRF
    state = secrets.token_urlsafe(16)
    pending_states[state] = True
    
    # Construct the authorization URL
    # https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_concepts_auth.htm#oauth-authorization-code-grant-flow
    redirect_uri = f"{request.base_url}auth/tableau/callback"
    
    # Ensure HTTPS for redirect_uri in production (Render handles SSL termination)
    if "onrender.com" in redirect_uri and redirect_uri.startswith("http://"):
        redirect_uri = redirect_uri.replace("http://", "https://", 1)

    auth_url = (
        f"{TABLEAU_BASE_URL}/public/oauth20/authorize"
        f"?response_type=code"
        f"&client_id={CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&state={state}"
        f"&scope=tableau:views:read tableau:workbooks:read"
    )
    
    return RedirectResponse(auth_url)

@router.get("/callback")
def callback(request: Request, response: Response, code: str, state: str):
    """
    Exchanges the authorization code for an access token.
    """
    if state not in pending_states:
        raise HTTPException(status_code=400, detail="Invalid state parameter (CSRF check failed)")
    
    del pending_states[state] # Consume state

    redirect_uri = f"{request.base_url}auth/tableau/callback"
    if "onrender.com" in redirect_uri and redirect_uri.startswith("http://"):
        redirect_uri = redirect_uri.replace("http://", "https://", 1)

    # Exchange code for token
    token_url = f"{TABLEAU_BASE_URL}/public/oauth20/token"
    payload = {
        "grant_type": "authorization_code",
        "client_id": CLIENT_ID,
        "client_secret": SECRET_VALUE,
        "redirect_uri": redirect_uri,
        "code": code
    }
    
    try:
        res = requests.post(token_url, data=payload)
        res.raise_for_status()
        token_data = res.json()
        
        access_token = token_data.get("access_token")
        # In a real app, validate the JWT signature here if Tableau provides one, 
        # or use the /auth/check endpoint to get user details.
        
        # Redirect back to the extension with success
        # We store the token in a secure HttpOnly cookie
        resp = Response(
            content=f"""
            <html>
                <body>
                    <script>
                        // Notify the parent window
                        if (window.opener) {{
                            window.opener.postMessage("login_success", "*");
                            window.close();
                        }} else {{
                            document.body.innerHTML = "Login successful! You can close this tab.";
                        }}
                    </script>
                    <h1>Login Successful</h1>
                    <p>Closing window...</p>
                </body>
            </html>
            """,
            media_type="text/html"
        )
        
        resp.set_cookie(
            key="tableau_auth",
            value=access_token,
            httponly=True,
            secure=True,
            samesite="None",  # Critical for iframe/popup context in some browsers
            max_age=3600
        )
        
        return resp
        
    except Exception as e:
        print(f"Token exchange failed: {e}")
        if hasattr(e, 'response') and e.response:
             print(e.response.text)
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")

@router.get("/me")
def get_me(request: Request):
    """
    Returns the current authenticated user's status.
    """
    token = request.cookies.get("tableau_auth")
    if not token:
        return {"authenticated": False}
    
    # Ideally, we would validate the token against Tableau here or decode the JWT
    return {"authenticated": True, "user_id": "tableau_user"} 
