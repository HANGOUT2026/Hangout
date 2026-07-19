import json
from channels.generic.websocket import AsyncWebsocketConsumer

class CallConsumer(AsyncWebsocketConsumer):
    
    async def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"]["room_id"]
        self.room_group_name = f"call_{self.room_name}"

        # Initialize an empty username tracker on this specific channel connection
        self.username = "Someone"

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        # Broadcast to the group that this specific user has disconnected
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "signal_message",
                "message": {"type": "user-left", "username": self.username},
                "sender_channel": self.channel_name,
                "sender_username": self.username,
            },
        )

        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)

        # Cache the user's username on the connection instance when they send their 'ready' packet
        if data.get("type") == "ready":
            self.username = data.get("username", "Someone")

        # Extract the target mapping if it exists
        target_user = data.get("target")

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "signal_message", 
                "message": data, 
                "sender_channel": self.channel_name,
                "sender_username": self.username,
                "target_user": target_user # <--- Propagate target user mapping down to the group broadcast
            },
        )

    async def signal_message(self, event):
        message = event["message"]
        sender_channel = event["sender_channel"]
        target_user = event.get("target_user")

        import sys
        print(f"SIGNAL {message.get('type')} from {sender_channel} to target {target_user} (my username: {self.username})")
        sys.stdout.flush()

        # 1. Block echo reflections: Don't send the data back to the browser that uploaded it
        if self.channel_name == sender_channel:
            return

        # 2. Multiplex target filtering: If the payload specifies a targeted recipient, 
        # ensure ONLY that user forwards the packet to their frontend WebRTC layer.
        if target_user and target_user != self.username:
            return

        # Explicitly forward the targeted message down the socket pipe
        print(f"Forwarding {message.get('type')} to {self.username}")
        sys.stdout.flush()
        await self.send(text_data=json.dumps(message))