# Application Flow

[← Back to README](../README.md)

Detailed sequence and flowchart diagrams for every core user journey in Hangout, derived directly from the source code.

---

## Table of Contents

1. [Sign-Up Flow](#1-sign-up-flow)
2. [Sign-In Flow (with Lockout)](#2-sign-in-flow-with-lockout)
3. [Home Dashboard Load](#3-home-dashboard-load)
4. [Starting an Instant Meeting](#4-starting-an-instant-meeting)
5. [Joining via Room Code](#5-joining-via-room-code)
6. [WebRTC Connection Establishment (Multi-User)](#6-webrtc-connection-establishment-multi-user)
7. [In-Call Actions](#7-in-call-actions)
8. [Meeting Recording](#8-meeting-recording)
9. [Screen Sharing](#9-screen-sharing)
10. [Leaving a Call](#10-leaving-a-call)
11. [Recording & Notes Management on Dashboard](#11-recording--notes-management-on-dashboard)

---

## 1. Sign-Up Flow

```mermaid
sequenceDiagram
    actor User
    participant SignUp as sign_up.jsx
    participant API as POST /api/signup/
    participant DB as Django Auth DB

    User->>SignUp: Fill name, email, password → click SIGN UP
    SignUp->>API: axios.post({username, email, password})
    API->>DB: User.objects.create_user(...)
    DB-->>API: User created
    API-->>SignUp: 201 {message: "User created successfully"}
    SignUp->>SignUp: showToast("Signup successful!")
    Note over SignUp: setTimeout 1500ms
    SignUp->>User: navigate("/sign-in")
```

**Error path:** If the username already exists, the API returns `400 {error: "Username already exists"}` and the toast shows the error message.

---

## 2. Sign-In Flow (with Lockout)

```mermaid
sequenceDiagram
    actor User
    participant SignIn as sign_in.jsx
    participant API as POST /api/signin/
    participant DB as Django DB
    participant SS as sessionStorage

    User->>SignIn: Fill username/email + password → click SIGN IN
    SignIn->>API: axios.post({username, password})

    API->>DB: LoginAttempt.get_or_create(username)
    alt Account is locked
        DB-->>API: locked_until is in future
        API-->>SignIn: 429 {error, lockout_seconds_remaining}
        SignIn->>SS: setItem("lockoutUntil", Date.now() + remaining * 1000)
        SignIn->>SignIn: setLockoutTimeRemaining(remaining)
        SignIn->>User: Button shows "LOCKED (Xs)" countdown
    else Normal attempt
        API->>DB: authenticate(username, password)
        alt Credentials valid
            DB-->>API: User object
            API->>DB: Reset failed_attempts = 0
            API-->>SignIn: 200 {message, username}
            SignIn->>SS: setItem("username", username)
            SignIn->>SignIn: showToast("Login successful!")
            Note over SignIn: setTimeout 1500ms
            SignIn->>User: navigate("/home", {showPreloader: true})
        else Invalid credentials
            DB-->>API: None
            API->>DB: Increment failed_attempts
            Note over API: Attempt 5 → lock 1 min<br/>Attempt 6 → lock 10 min<br/>Attempt 7+ → lock 30 min
            API-->>SignIn: 401 or 429
            SignIn->>User: Toast error message
        end
    end
```

The lockout countdown is persisted in `sessionStorage` as a Unix timestamp (`lockoutUntil`) so it survives page refreshes. A `setInterval` in `useEffect` ticks down the displayed counter every second.

---

## 3. Home Dashboard Load

```mermaid
flowchart TD
    A[navigate to /home] --> B{username in sessionStorage?}
    B -- No --> C[navigate to /sign-in]
    B -- Yes --> D[Render Home with Preloader if showPreloader flag set]
    D --> E[Preloader animates through multilingual greetings]
    E --> F[onComplete callback → setShowPreloader false]
    F --> G[Dashboard renders]
    G --> H[useEffect: axios.get /api/recordings/username/]
    G --> I[useEffect: axios.get /api/notes/username/]
    H --> J[setRecordingsCount + setSavedRecordings]
    I --> K[setNotesCount + setSavedNotes]
    G --> L[WeatherCard: navigator.geolocation.getCurrentPosition]
    L --> M[fetch Open-Meteo + BigDataCloud APIs]
    M --> N[Render temperature, city, conditions]
```

---

## 4. Starting an Instant Meeting

```mermaid
flowchart TD
    A[User clicks 'Start call →'] --> B["handleNewCall()"]
    B --> C["roomId = Math.random().toString(36).substring(2,9)"]
    C --> D["setPreJoinRoomId(roomId)"]
    D --> E[Pre-Join Modal renders]
    E --> F{User toggles Camera?}
    F -- Yes --> G["navigator.mediaDevices.getUserMedia({video:true})"]
    G --> H{Permission granted?}
    H -- Yes --> I["setCamEnabled(true)"]
    H -- No --> J["alert + setCamEnabled(false)"]
    E --> K{User toggles Mic?}
    K -- Yes --> L["navigator.mediaDevices.getUserMedia({audio:true})"]
    L --> M{Permission granted?}
    M -- Yes --> N["setMicEnabled(true)"]
    M -- No --> O["alert + setMicEnabled(false)"]
    E --> P[User clicks 'Join Call']
    P --> Q["navigate('/call/roomId', {state:{camEnabled,micEnabled}})"]
```

---

## 5. Joining via Room Code

```mermaid
flowchart TD
    A[User types or pastes room code] --> B["setJoinCode(value)"]
    B --> C{joinCode not empty?}
    C -- No --> D[Join button inactive / greyed]
    C -- Yes --> E["handleJoinCall() → setPreJoinRoomId(joinCode)"]
    E --> F[Same Pre-Join Modal as Start flow]
    F --> G["navigate('/call/roomId', {state: camEnabled, micEnabled})"]
```

The join input also features a clipboard paste button that calls `navigator.clipboard.readText()`.

---

## 6. WebRTC Connection Establishment (Multi-User)

This sequence shows User B joining a room where User A is already present.

```mermaid
sequenceDiagram
    participant A as User A (Browser)
    participant WS as Django CallConsumer
    participant B as User B (Browser)

    Note over A: Already in room, WebSocket open

    B->>WS: WebSocket connect ws/call/{roomId}/
    WS->>WS: connect(): group_add(room_group)
    B->>WS: send {type:"ready", username:"UserB"}
    WS->>WS: cache username on connection
    WS-->>A: forward {type:"ready", sender:"UserB"}

    A->>A: initializePeerConnection("UserB", isCaller=true)
    A->>A: new RTCPeerConnection({iceServers:[stun]})
    A->>A: addTrack(localStream tracks)
    A->>A: createDataChannel("hangout-data") [forces negotiation]
    A->>A: onnegotiationneeded → createOffer()

    A->>WS: send {type:"offer", offer:SDP, target:"UserB"}
    WS-->>B: forward {type:"offer", ...}

    B->>B: initializePeerConnection("UserA", isCaller=false)
    B->>B: setRemoteDescription(offer)
    B->>B: createAnswer()
    B->>B: setLocalDescription(answer)
    B->>WS: send {type:"answer", answer:SDP, target:"UserA"}
    WS-->>A: forward {type:"answer", ...}
    A->>A: setRemoteDescription(answer)

    loop ICE negotiation
        A->>WS: send {type:"ice-candidate", candidate, target:"UserB"}
        WS-->>B: forward ice-candidate
        B->>B: addIceCandidate(candidate)
        B->>WS: send {type:"ice-candidate", candidate, target:"UserA"}
        WS-->>A: forward ice-candidate
        A->>A: addIceCandidate(candidate)
    end

    Note over A,B: P2P RTP media stream established
    A-->>B: Audio + Video frames (direct, not via server)
    B-->>A: Audio + Video frames (direct, not via server)

    B->>WS: send {type:"request-state", sender:"UserB"}
    WS-->>A: forward request-state
    A->>WS: send {type:"timer-sync", startTime, target:"UserB"}
    A->>WS: send {type:"media-status", isMicOn, isCameraOn, target:"UserB"}
```

**ICE candidate queuing:** If ICE candidates arrive before `setRemoteDescription` completes, they are pushed to `iceCandidateQueue[sender]` and flushed once the remote description is set.

---

## 7. In-Call Actions

### Mic / Camera Toggle

```mermaid
flowchart TD
    A["User clicks Mic/Camera button"] --> B{"localStream has track?"}
    B -- Yes --> C["track.enabled = !track.enabled"]
    C --> D["setIsMicOn / setIsCameraOn(track.enabled)"]
    D --> E["sessionStorage.setItem(state_key, value)"]
    E --> F["WS send {type:'media-status', isMicOn, isCameraOn}"]
    F --> G["Sync track.enabled on all RTCRtpSenders"]
    B -- No --> H["navigator.mediaDevices.getUserMedia(...)"]
    H --> I{Permission granted?}
    I -- Yes --> J["localStream.addTrack(newTrack)"]
    J --> K["pc.addTrack(newTrack) on all peers"]
    K --> L["setIsMicOn/setIsCameraOn(true)"]
    I -- No --> M["alert: access denied"]
```

### Chat Message

```mermaid
sequenceDiagram
    participant Sender as User A (Call.jsx)
    participant WS as CallConsumer
    participant Receiver as User B (Call.jsx)

    Sender->>Sender: User types message + presses Enter or Send
    Sender->>Sender: setMessages([...m, {from:'You', text, time}])
    Sender->>WS: WS send {type:'chat-message', text, time, sender:'UserA'}
    WS-->>Receiver: forward message (echo-filtered)
    Receiver->>Receiver: setMessages([...m, {from:'UserA', text, time}])
```

### Notes Save

```mermaid
sequenceDiagram
    participant User as User (Call.jsx)
    participant API as POST /api/notes/save/

    User->>User: Types in notes textarea
    User->>User: Clicks Save button
    User->>API: axios.post({room_id, username, content})
    API->>API: Room.get_or_create(room_id)
    API->>API: MeetingNote.objects.create(user, room, content)
    API-->>User: 200 {message: "Note saved successfully"}
    User->>User: setNotification("✅ Notes saved successfully!")
```

### Video Filters

```mermaid
sequenceDiagram
    participant User as User A (Call.jsx)
    participant WS as CallConsumer
    participant Peer as User B (Call.jsx)

    User->>User: Clicks filter chip (e.g. "Warm Sepia")
    User->>User: setActiveFilter("sepia")
    User->>User: Apply CSS class "sepia" to local <video>
    User->>WS: WS send {type:'change-filter', filter:'sepia', sender:'UserA'}
    WS-->>Peer: forward change-filter
    Peer->>Peer: setPeerFilter("sepia")
    Peer->>Peer: Apply CSS class "sepia" to User A's remote <video>
```

---

## 8. Meeting Recording

```mermaid
sequenceDiagram
    participant User as User (Call.jsx)
    participant Recorder as MediaRecorder API
    participant Canvas as Offscreen Canvas
    participant API as POST /api/recordings/upload/

    User->>User: Clicks Record button (isRecording = false)
    User->>Canvas: createElement('canvas') 1280×720
    User->>Canvas: requestAnimationFrame(drawFrame) loop starts
    Note over Canvas: drawFrame() reads all .stage-video,<br/>.sidebar-video, or .grid-video elements<br/>and paints them to the canvas
    User->>Recorder: canvas.captureStream(30fps) + audio tracks
    User->>Recorder: new MediaRecorder(combinedStream, {mimeType: 'video/webm;codecs=vp9,opus'})
    Recorder->>Recorder: start(1000ms timeslice)
    Recorder->>User: ondataavailable → push to recordedChunks[]
    User->>User: setIsRecording(true)

    User->>User: Clicks Record button again (isRecording = true)
    User->>Recorder: stop()
    Recorder->>User: onstop fires
    User->>Canvas: cancelAnimationFrame() — stop drawing loop
    User->>User: new Blob(recordedChunks, {type:'video/webm'})
    User->>API: axios.post(FormData{video_file, room_id, username})
    API->>API: User.objects.get(username)
    API->>API: Room.get_or_create(room_id)
    API->>API: MeetingRecording.objects.create(user, room, video_file)
    API-->>User: 200 {message: "Upload successful", id}
    User->>User: setNotification("✅ Recording saved!")
```

---

## 9. Screen Sharing

```mermaid
sequenceDiagram
    participant User as Sharer (Call.jsx)
    participant WS as CallConsumer
    participant Peer as Viewer (Call.jsx)

    User->>User: Clicks Screen Share button
    alt Another user is already sharing
        User->>User: alert("X is already sharing screen!")
    else No active sharer
        User->>User: navigator.mediaDevices.getDisplayMedia({video, audio})
        User->>User: Replace video track on all RTCRtpSenders
        Note over User: videoSender.replaceTrack(screenVideoTrack)<br/>maxBitrate set to 5 Mbps
        User->>User: localVideoRef.srcObject = screenStream
        User->>User: setIsScreenSharing(true), setActiveScreenSharer(myUsername)
        User->>WS: WS send {type:'screen-share-start', sender:username}
        WS-->>Peer: forward screen-share-start
        Peer->>Peer: setActiveScreenSharer("Sharer")
        Peer->>Peer: Layout switches to presenter(75%) + sidebar
    end

    Note over User: User stops sharing (button or browser "Stop" prompt)
    User->>User: screenStream.getTracks().forEach(stop)
    User->>User: videoSender.replaceTrack(originalCameraTrack)
    User->>User: setIsScreenSharing(false), setActiveScreenSharer(null)
    User->>WS: WS send {type:'screen-share-stop', sender:username}
    WS-->>Peer: forward screen-share-stop
    Peer->>Peer: setActiveScreenSharer(null)
    Peer->>Peer: Layout reverts to grid
```

---

## 10. Leaving a Call

```mermaid
sequenceDiagram
    participant User as Leaving User (Call.jsx)
    participant WS as CallConsumer
    participant Peer as Remaining Peer (Call.jsx)

    User->>User: Clicks End Call (red phone button)
    User->>User: sessionStorage.removeItem(call_start_*, cam_state_*, mic_state_*)
    User->>WS: wsRef.current.close()
    WS->>WS: disconnect(): group_send({type:'user-left', username})
    WS->>WS: group_discard(room_group, channel)
    WS-->>Peer: forward {type:'user-left', username}
    Peer->>Peer: handlePeerDisconnect(username)
    Peer->>Peer: peerConnections[username].close() + delete entry
    Peer->>Peer: setRemoteStreams(filter out username)
    Peer->>Peer: setNotification("X has left the meeting")
    User->>User: navigate('/home')
    User->>User: useEffect cleanup: stop localStream tracks, stop screenStream, stop mediaRecorder
```

---

## 11. Recording & Notes Management on Dashboard

```mermaid
flowchart TD
    A[User opens Recordings modal] --> B["axios.get /api/recordings/username/"]
    B --> C["Server: delete expired recordings on-the-fly\n(expires_at <= now)"]
    C --> D["Return active recordings array\n{id, room_id, file_url, created_at, days_remaining}"]
    D --> E[Render recording list]
    E --> F{User action}
    F -- Play --> G["Open file_url in new tab (browser native video player)"]
    F -- Delete --> H["axios.delete /api/recordings/delete/id/"]
    H --> I["Server: recording.video_file.delete(save=False)"]
    I --> J["recording.delete()"]
    J --> K["setSavedRecordings(filter out id)"]

    L[User opens Notes modal] --> M["axios.get /api/notes/username/"]
    M --> N["Return notes array {id, room_id, content, created_at}"]
    N --> O[Render notes list]
    O --> P{User action}
    P -- Copy --> Q["navigator.clipboard.writeText(content)"]
    P -- Delete --> R["axios.delete /api/notes/delete/id/"]
    R --> S["Server: note.delete()"]
    S --> T["setSavedNotes(filter out id)"]
```
