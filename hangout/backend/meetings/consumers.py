import json
from channels.generic.websocket import AsyncWebsocketConsumer
from django.core.cache import cache
from asgiref.sync import sync_to_async

class CallConsumer(AsyncWebsocketConsumer):
    
    async def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"]["room_id"]
        self.room_group_name = f"call_{self.room_name}"

        # Initialize an empty username tracker on this specific channel connection
        self.username = "Someone"

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        
        # Mark this room as active in the cache for 24 hours so validate_room can see it!
        await sync_to_async(cache.set)(f"active_room_{self.room_name}", True, timeout=86400)
        
        await self.accept()

    async def disconnect(self, close_code):
        # Broadcast to the group that this specific user has disconnected
        peer_id = getattr(self, "peer_id", self.username)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "signal_message",
                "message": {"type": "user-left", "sender": peer_id},
                "sender_channel": self.channel_name,
                "sender_username": peer_id,
            },
        )

        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)

        # Cache the user's peer_id on the connection instance when they send their 'ready' packet
        if data.get("type") == "ready":
            self.username = data.get("username", "Someone")
            self.peer_id = data.get("sender", "Unknown")

        # Extract the target mapping if it exists
        target_user = data.get("target")

        peer_id = getattr(self, "peer_id", self.username)
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "signal_message", 
                "message": data, 
                "sender_channel": self.channel_name,
                "sender_username": peer_id,
                "target_user": target_user # <--- Propagate target user mapping down to the group broadcast
            },
        )

    async def signal_message(self, event):
        message = event["message"]
        sender_channel = event["sender_channel"]
        target_user = event.get("target_user")

        my_peer_id = getattr(self, "peer_id", self.username)
        import sys
        print(f"SIGNAL {message.get('type')} from {sender_channel} to target {target_user} (my peer_id: {my_peer_id})")
        sys.stdout.flush()

        # 1. Block echo reflections: Don't send the data back to the browser that uploaded it
        if self.channel_name == sender_channel:
            return

        # 2. Multiplex target filtering: If the payload specifies a targeted recipient, 
        # ensure ONLY that user forwards the packet to their frontend WebRTC layer.
        if target_user and target_user != my_peer_id:
            return

        # Explicitly forward the targeted message down the socket pipe
        print(f"Forwarding {message.get('type')} to {my_peer_id}")
        sys.stdout.flush()
        await self.send(text_data=json.dumps(message))