# core/asgi.py
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import meetings.routing  # Ensure your routing file is referenced here

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# Initialize the ASGI application early to ensure routing configurations load cleanly
django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter(
    {
        # CRITICAL: Routes standard HTTP requests (like Axios POST) to your core/urls.py
        "http": django_asgi_app,
        # Routes real-time WebSocket requests to your consumers
        "websocket": AuthMiddlewareStack(
            URLRouter(meetings.routing.websocket_urlpatterns)
        ),
    }
)
