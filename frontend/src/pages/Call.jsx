import React, { useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE_URL, WS_BASE_URL } from "../lib/utils";
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Mic, MicOff, Video, VideoOff, Monitor, MessageSquare, FileText, Sliders, PhoneOff, Copy, Check, Music, X, Send, Circle, Save, Maximize, Minimize } from 'lucide-react';

export default function Call() {
    const { roomId } = useParams();
    const navigate = useNavigate();

    // --- 1. Static Configuration ---
    const filters = [
        { id: "none", label: "Normal", icon: "✨", style: "" },
        { id: "sepia", label: "Warm Sepia", icon: "🌅", style: "sepia" },
        { id: "grayscale", label: "Mono Black", icon: "🎬", style: "grayscale" },
        { id: "invert", label: "Cyber X-Ray", icon: "🔮", style: "invert" },
        { id: "blur", label: "Soft Focus", icon: "blur-sm", style: "blur" },
        { id: "hue", label: "Neon Pop", icon: "🌈", style: "hue-rotate-90" }
    ];

    
    
    // --- 2. Element References ---
    const [activeFilter, setActiveFilter] = useState('none');
    const [peerFilter, setPeerFilter] = useState('none');
    const iceCandidateQueue = useRef({});
    
    // WebRTC References
    const peerConnectionsRef = useRef({});
    const localStreamRef = useRef(null);
    const screenStreamRef = useRef(null);
    const screenSendersRef = useRef({}); // Track screen share senders per peer
    const wsRef = useRef(null);
    const localVideoRef = useRef(null);
    const fileInputRef = useRef(null);
    const localAudioElementRef = useRef(new Audio());
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const animationFrameIdRef = useRef(null);

    // --- 3. Multi-User Connection Maps ---
    const peerConnectionsRef = useRef({}); 
    const iceCandidateQueue = useRef({});

    // --- 4. Application State ---
    const [isRecording, setIsRecording] = useState(false);
    // eslint-disable-next-line no-unused-vars
    const [uploadedFileName, setUploadedFileName] = useState("");
    
    const [showMusicCard, setShowMusicCard] = useState(false);
    const [musicVolume] = useState(0.2);


    const [isMicOn, setIsMicOn] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const isScreenSharingRef = useRef(false);
    useEffect(() => { isScreenSharingRef.current = isScreenSharing; }, [isScreenSharing]);

    const [activeScreenSharer, setActiveScreenSharer] = useState(null);
    const [isMaximized, setIsMaximized] = useState(false);
    const [activeFilter, setActiveFilter] = useState("none"); 
    const [peerFilter, setPeerFilter] = useState("none");
    const [remoteStreams, setRemoteStreams] = useState([]); // Tracks mesh participants
    const [myUsername, setMyUsername] = useState("");
    const [myDisplayName, setMyDisplayName] = useState("");
    const [notification, setNotification] = useState("");

    const [showFilters, setShowFilters] = useState(false);
    const [panel, setPanel] = useState(null);
    const [copied, setCopied] = useState(false);
    const [notes, setNotes] = useState("");
    const [notesCopied, setNotesCopied] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [messages, setMessages] = useState([]);

    const getCallStartTime = useCallback(() => {
        const key = `call_start_${roomId}`;
        let st = sessionStorage.getItem(key);
        if (!st) {
            st = Date.now().toString();
            sessionStorage.setItem(key, st);
        }
        return parseInt(st, 10);
    }, [roomId]);

    const [elapsed, setElapsed] = useState(() => {
        const start = getCallStartTime();
        return Math.floor((Date.now() - start) / 1000);
    });

    // --- Validation on mount ---
    useEffect(() => {
        const validateRoomOnMount = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/validate-room/${roomId}/`);
                if (!response.data.exists) {
                    alert("This meeting does not exist.");
                    navigate("/home");
                }
            } catch (err) {
                alert("This meeting does not exist.");
                navigate("/home");
            }
        };
        if (roomId) {
            validateRoomOnMount();
        }
    }, [roomId, navigate]);

    // --- Timers & UI Helpers ---
    useEffect(() => {
        const start = getCallStartTime();
        const id = setInterval(() => {
            setElapsed(Math.floor((Date.now() - start) / 1000));
        }, 1000);
        return () => clearInterval(id);
    }, [getCallStartTime]);

    const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

    const sendChat = () => {
        if (!chatInput.trim()) return;
        const now = new Date();
        const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
        const msg = { from: "You", text: chatInput.trim(), time };
        setMessages((m) => [...m, msg]);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'chat-message', text: chatInput.trim(), time, sender: myUsername }));
        }
        setChatInput("");
    };

    const copyRoom = () => {
        try { navigator.clipboard.writeText(roomId); } catch (err) { console.error("Copy failed", err); }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const copyNotes = () => {
        try { navigator.clipboard.writeText(notes); } catch (err) { console.error("Copy failed", err); }
        setNotesCopied(true);
        setTimeout(() => setNotesCopied(false), 2000);
    };

    const togglePanel = (name) => {
        setPanel((p) => (p === name ? null : name));
        setShowFilters(false);
    };

    const toggleFilters = () => setShowFilters((f) => !f);

    // --- Recording Engine ---
    const toggleRecording = async () => {
        if (!isRecording) {
            try {
                recordedChunksRef.current = [];
                
                const CANVAS_WIDTH = 1280;
                const CANVAS_HEIGHT = 720;
                const canvas = document.createElement('canvas');
                canvas.width = CANVAS_WIDTH;
                canvas.height = CANVAS_HEIGHT;
                const ctx = canvas.getContext('2d');

                const drawFrame = () => {
                    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
                    
                    ctx.fillStyle = "#0D0E14";
                    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                    
                    const drawCell = (v, x, y, drawW, drawH) => {
                        if (v.videoWidth > 0 && v.readyState >= 2 && v.style.display !== "none") {
                            ctx.drawImage(v, x, y, drawW, drawH);
                        } else {
                            ctx.fillStyle = "#111218";
                            ctx.fillRect(x, y, drawW, drawH);
                        }
                        const name = v.getAttribute('data-username');
                        if (name) {
                            ctx.fillStyle = "rgba(26,28,30,0.8)";
                            ctx.font = "600 12px sans-serif";
                            const textW = ctx.measureText(name).width + 24;
                            ctx.fillRect(x + 12, y + drawH - 36, textW, 24);
                            ctx.fillStyle = "#FFFFFF";
                            ctx.fillText(name, x + 24, y + drawH - 20);
                        }
                    };

                    const stageVideo = document.querySelector('.stage-video');
                    if (stageVideo) {
                        drawCell(stageVideo, 16, 16, CANVAS_WIDTH * 0.75 - 24, CANVAS_HEIGHT - 32);
                        
                        const sidebarVideos = Array.from(document.querySelectorAll('.sidebar-video'));
                        const sidebarX = CANVAS_WIDTH * 0.75 + 8;
                        const sidebarWidth = CANVAS_WIDTH * 0.25 - 24;
                        const sidebarHeight = sidebarWidth * (9/16);
                        
                        sidebarVideos.forEach((v, i) => {
                            const yPos = 16 + i * (sidebarHeight + 16);
                            if (yPos + sidebarHeight < CANVAS_HEIGHT) {
                                drawCell(v, sidebarX, yPos, sidebarWidth, sidebarHeight);
                            }
                        });
                    } else {
                        const gridVideos = Array.from(document.querySelectorAll('.grid-video'));
                        const count = gridVideos.length;
                        if (count > 0) {
                            const getGridDim = (c) => {
                                if (c === 1) return { cols: 1, rows: 1 };
                                if (c === 2) return { cols: 2, rows: 1 };
                                if (c <= 4) return { cols: 2, rows: 2 };
                                if (c <= 6) return { cols: 3, rows: 2 };
                                if (c <= 9) return { cols: 3, rows: 3 };
                                return { cols: 4, rows: Math.ceil(c / 4) };
                            };
                            const dim = getGridDim(count);
                            const cellW = (CANVAS_WIDTH - 32 - (dim.cols - 1) * 16) / dim.cols;
                            const cellH = (CANVAS_HEIGHT - 32 - (dim.rows - 1) * 16) / dim.rows;

                            gridVideos.forEach((v, i) => {
                                const row = Math.floor(i / dim.cols);
                                const col = i % dim.cols;
                                
                                const cellAspect = cellW / cellH;
                                let drawW = cellW;
                                let drawH = cellH;
                                if (16/9 > cellAspect) {
                                    drawH = cellW * (9/16);
                                } else {
                                    drawW = cellH * (16/9);
                                }
                                
                                const x = 16 + col * (cellW + 16) + (cellW - drawW) / 2;
                                const y = 16 + row * (cellH + 16) + (cellH - drawH) / 2;
                                
                                drawCell(v, x, y, drawW, drawH);
                            });
                        }
                    }
                    
                    animationFrameIdRef.current = requestAnimationFrame(drawFrame);
                };

                const canvasStream = canvas.captureStream(30);
                const combinedStream = new MediaStream();
                
                // Add the dynamically painted video track
                canvasStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));

                // Mix all audio tracks (local mic + remote peers)
                if (localStreamRef.current) {
                    localStreamRef.current.getAudioTracks().forEach(t => combinedStream.addTrack(t));
                }
                remoteStreams.forEach((peer) => {
                    if (peer.stream) peer.stream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
                });

                let options = { mimeType: 'video/webm;codecs=vp9,opus' };
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options = { mimeType: 'video/webm;codecs=vp8,opus' };
                    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                        options = { mimeType: 'video/webm' };
                        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                            options = { mimeType: '' }; // Let browser choose default
                        }
                    }
                }
                
                const recorder = new MediaRecorder(combinedStream, options);

                recorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
                };

                recorder.onstop = async () => {
                    setNotification("Saving and uploading meeting recording...");
                    
                    // Stop the drawing loop
                    if (animationFrameIdRef.current) {
                        cancelAnimationFrame(animationFrameIdRef.current);
                        animationFrameIdRef.current = null;
                    }

                    const blob = new Blob(recordedChunksRef.current, { type: options.mimeType || 'video/webm' });
                    
                    const formData = new FormData();
                    formData.append('video_file', blob, `meeting-${roomId}-${Date.now()}.webm`);
                    formData.append('room_id', roomId);
                    formData.append('username', myUsername);

                    try {
                        await axios.post(`${API_BASE_URL}/api/recordings/upload/`, formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        setNotification("✅ Recording successfully saved to your account!");
                    } catch (err) {
                        console.error("Failed to upload recording file asset:", err);
                        setNotification("✕ Failed to upload recording file.");
                    }
                    setTimeout(() => setNotification(""), 2000);
                };

                mediaRecorderRef.current = recorder;
                recorder.start(1000);
                setIsRecording(true);
                drawFrame(); // Boot up the canvas painter
                setNotification("🔴 Recording started!");
                setTimeout(() => setNotification(""), 2000);
            } catch (err) {
                console.error("Failed to boot recording engine constraints:", err);
                alert(`Recording failed to start: ${err.message}`);
            }
        } else {
            if (mediaRecorderRef.current) {
                mediaRecorderRef.current.stop();
                setIsRecording(false);
            }
        }
    };

    // --- Media Action Controls ---
    const handleMusicFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setUploadedFileName(file.name);
            const fileUrl = URL.createObjectURL(file);
            localAudioElementRef.current.src = fileUrl;
            localAudioElementRef.current.loop = true;
            await localAudioElementRef.current.play();
            await localAudioElementRef.current.play();

            const captureStream = localAudioElementRef.current.captureStream ? localAudioElementRef.current.captureStream() : localAudioElementRef.current.mozCaptureStream();
            const audioFileTrack = captureStream.getAudioTracks()[0];

            if (audioFileTrack) {
                const musicStream = new MediaStream([audioFileTrack]);
                Object.keys(peerConnectionsRef.current).forEach((username) => {
                    const pc = peerConnectionsRef.current[username];
                    pc.addTrack(audioFileTrack, musicStream);
                });
                wsRef.current?.send(JSON.stringify({ type: 'music-status', status: 'started', sender: myUsername }));
            }
        } catch (err) { console.error(err); }
    };

    const startSystemAudioShare = async (url) => {
        // Open the selected music service
        window.open(url, '_blank');
        
        try {
            // Prompt the user to share the new tab's audio
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            const audioTrack = stream.getAudioTracks()[0];
            
            if (audioTrack) {
                const sysAudioStream = new MediaStream([audioTrack]);
                // Add the audio track to all peers
                Object.keys(peerConnectionsRef.current).forEach((username) => {
                    const pc = peerConnectionsRef.current[username];
                    pc.addTrack(audioTrack, sysAudioStream);
                });
                setShowMusicCard(false);
                wsRef.current?.send(JSON.stringify({ type: 'music-status', status: 'started', sender: myUsername }));
                
                audioTrack.onended = () => {
                    wsRef.current?.send(JSON.stringify({ type: 'music-status', status: 'stopped', sender: myUsername }));
                };
            }
        } catch (err) {
            console.error("Failed to share system audio:", err);
        }
    };

    const handleFilterChange = (filterId) => {
        setActiveFilter(filterId);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'change-filter', filter: filterId, sender: myUsername }));
        }
    };

    const toggleMic = async () => { 
        if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) { 
            const audioTrack = localStreamRef.current.getAudioTracks()[0]; 
            audioTrack.enabled = !audioTrack.enabled; 
            setIsMicOn(audioTrack.enabled); 
            sessionStorage.setItem(`mic_state_${roomId}`, audioTrack.enabled);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'media-status', sender: sessionStorage.getItem('username'), isMicOn: audioTrack.enabled, isCameraOn: sessionStorage.getItem(`cam_state_${roomId}`) === 'true' }));
            }
            
            // Sync track state changes across all active mesh users
            Object.keys(peerConnectionsRef.current).forEach((username) => {
                const pc = peerConnectionsRef.current[username];
                const senders = pc.getSenders();
                const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
                if (audioSender) {
                    audioSender.track.enabled = audioTrack.enabled;
                }
            });
        } else {
            // Need to request access dynamically
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const newAudioTrack = stream.getAudioTracks()[0];
                
                if (!localStreamRef.current) localStreamRef.current = new MediaStream();
                localStreamRef.current.addTrack(newAudioTrack);
                
                setIsMicOn(true);
                sessionStorage.setItem(`mic_state_${roomId}`, 'true');
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'media-status', sender: sessionStorage.getItem('username'), isMicOn: true, isCameraOn: sessionStorage.getItem(`cam_state_${roomId}`) === 'true' }));
                }

                // Add to all existing peer connections
                Object.keys(peerConnectionsRef.current).forEach((username) => {
                    const pc = peerConnectionsRef.current[username];
                    pc.addTrack(newAudioTrack, localStreamRef.current);
                });
            } catch (err) {
                console.error("Failed to dynamically get microphone", err);
                alert("Microphone access denied or unavailable.");
            }
        }
    };
    
    const toggleCamera = async () => { 
        if (localStreamRef.current && localStreamRef.current.getVideoTracks().length > 0) { 
            const videoTrack = localStreamRef.current.getVideoTracks()[0]; 
            videoTrack.enabled = !videoTrack.enabled; 
            setIsCameraOn(videoTrack.enabled); 
            sessionStorage.setItem(`cam_state_${roomId}`, videoTrack.enabled);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'media-status', sender: sessionStorage.getItem('username'), isMicOn: sessionStorage.getItem(`mic_state_${roomId}`) === 'true', isCameraOn: videoTrack.enabled }));
            }
            
            // Sync track state changes across all active mesh users
            Object.keys(peerConnectionsRef.current).forEach((username) => {
                const pc = peerConnectionsRef.current[username];
                const senders = pc.getSenders();
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                if (videoSender) {
                    videoSender.track.enabled = videoTrack.enabled;
                }
            });
        } else {
            // Need to request access dynamically
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                const newVideoTrack = stream.getVideoTracks()[0];
                
                if (!localStreamRef.current) localStreamRef.current = new MediaStream();
                localStreamRef.current.addTrack(newVideoTrack);
                
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = localStreamRef.current;
                }

                setIsCameraOn(true);
                sessionStorage.setItem(`cam_state_${roomId}`, 'true');
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'media-status', sender: sessionStorage.getItem('username'), isMicOn: sessionStorage.getItem(`mic_state_${roomId}`) === 'true', isCameraOn: true }));
                }

                // Add to all existing peer connections
                Object.keys(peerConnectionsRef.current).forEach((username) => {
                    const pc = peerConnectionsRef.current[username];
                    pc.addTrack(newVideoTrack, localStreamRef.current);
                });
            } catch (err) {
                console.error("Failed to dynamically get camera", err);
                alert("Camera access denied or unavailable.");
            }
        }
    };

    // --- WebRTC Mesh Hub Setup ---
    const initializePeerConnection = (peerUsername, isCaller, currentUsername) => {
        if (peerConnectionsRef.current[peerUsername]) return peerConnectionsRef.current[peerUsername];

        // Ensure user is visible in UI immediately, even if they have no active tracks yet
        setRemoteStreams((prev) => {
            if (prev.find(p => p.username === peerUsername)) return prev;
            return [...prev, { username: peerUsername, displayName: peerUsername, stream: null }];
        });

        const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

        // Add local tracks to this new connection
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
        }

        // If we are currently screen sharing, add those tracks too
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => {
                const sender = pc.addTrack(track, screenStreamRef.current);
                if (!screenSendersRef.current[peerUsername]) screenSendersRef.current[peerUsername] = [];
                screenSendersRef.current[peerUsername].push(sender);
            });
        }

        // Handle incoming remote tracks
        pc.ontrack = (event) => {
            console.log("Track received from:", peerUsername, event.streams[0]);
            
            setRemoteStreams((prev) => {
                const existingIndex = prev.findIndex(p => p.username === peerUsername);
                if (existingIndex >= 0) {
                    const currentStream = prev[existingIndex].stream;
                    const peerObj = prev[existingIndex];
                    
                    // Handle auxiliary streams (e.g. streaming music or screen share)
                    if (currentStream && currentStream.id !== event.streams[0].id) {
                        if (event.track.kind === 'video') {
                            // This is likely the screen share stream
                            const newArray = [...prev];
                            newArray[existingIndex] = { ...peerObj, screenStream: event.streams[0] };
                            return newArray;
                        } else if (event.track.kind === 'audio') {
                            if (!window[`aux_audio_${event.streams[0].id}`]) {
                                window[`aux_audio_${event.streams[0].id}`] = true;
                                const audio = new Audio();
                                audio.srcObject = event.streams[0];
                                audio.play().catch(e => console.error("Aux audio play failed:", e));
                            }
                        }
                        return prev; // Do not overwrite main stream
                    }
                    
                    // Main stream update (camera/mic)
                    if (currentStream !== event.streams[0]) {
                        const newArray = [...prev];
                        newArray[existingIndex] = { ...peerObj, stream: event.streams[0] };
                        return newArray;
                    }
                    return prev;
                }
                
                // Fallback, just in case
                return [...prev, { username: peerUsername, displayName: peerUsername, stream: event.streams[0] }];
            });
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                wsRef.current.send(JSON.stringify({
                    type: 'ice-candidate', candidate: event.candidate, sender: currentUsername, target: peerUsername
                }));
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log("ICE Connection State with", peerUsername, ":", pc.iceConnectionState);
        };

        let isNegotiating = false;
        pc.onsignalingstatechange = () => {
            isNegotiating = (pc.signalingState !== "stable");
        };

        pc.onnegotiationneeded = async () => {
            if (isNegotiating) return;
            isNegotiating = true;
            try {
                const offer = await pc.createOffer();
                if (pc.signalingState !== "stable") return;
                await pc.setLocalDescription(offer);
                wsRef.current.send(JSON.stringify({ type: 'offer', offer: pc.localDescription, sender: currentUsername, target: peerUsername }));
            } catch (err) {
                console.error("Negotiation error:", err);
            } finally {
                isNegotiating = false;
            }
        };

        peerConnectionsRef.current[peerUsername] = pc;

        if (isCaller) {
            // Force negotiation even if no tracks are present initially
            pc.createDataChannel("hangout-data");
        }
        return pc;
    };

    // --- WebSocket Signal Multiplexer ---
    const connectWebSocket = (username) => {
        wsRef.current = new WebSocket(`${WS_BASE_URL}/ws/call/${roomId}/`);
        
        // Wrap send for logging
        const originalSend = wsRef.current.send.bind(wsRef.current);
        wsRef.current.send = (msg) => {
            console.log("WS SEND:", JSON.parse(msg).type);
            originalSend(msg);
        };

        wsRef.current.onopen = () => {
            console.log("WS OPEN");
            const dn = sessionStorage.getItem('displayName') || username;
            wsRef.current.send(JSON.stringify({ type: 'ready', username: username, displayName: dn, sender: username }));
            wsRef.current.send(JSON.stringify({ type: 'request-state', sender: username }));
            
            // Broadcast initial media status so existing peers know our state immediately
            wsRef.current.send(JSON.stringify({ 
                type: 'media-status', 
                sender: username, 
                isMicOn: sessionStorage.getItem(`mic_state_${roomId}`) === 'true', 
                isCameraOn: sessionStorage.getItem(`cam_state_${roomId}`) === 'true' 
            }));
        };

        wsRef.current.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // Ignore echo
                if (data.sender === username) return;
                
                console.log("WS RECV:", data.type, "from", data.sender, "target", data.target);
                
                // Multiplexing check: only process if intended for me
                if (data.target && data.target !== username) return;

                switch (data.type) {
                    case 'ready':
                        initializePeerConnection(data.sender, true, username);
                        // Store the display name if provided
                        if (data.displayName) {
                            setRemoteStreams((prev) =>
                                prev.map(p => p.username === data.sender
                                    ? { ...p, displayName: data.displayName }
                                    : p
                                )
                            );
                        }
                        // Reply with our display name so the newcomer knows ours
                        wsRef.current.send(JSON.stringify({ type: 'display-name', displayName: sessionStorage.getItem('displayName') || username, sender: username, target: data.sender }));
                        break;
                    case 'offer': {
                        const pcOffer = initializePeerConnection(data.sender, false, username);
                        await pcOffer.setRemoteDescription(new RTCSessionDescription(data.offer));
                        
                        if (iceCandidateQueue.current[data.sender]) {
                            for (const candidate of iceCandidateQueue.current[data.sender]) {
                                try { await pcOffer.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { console.warn(e); }
                            }
                            iceCandidateQueue.current[data.sender] = [];
                        }
                        
                        const answer = await pcOffer.createAnswer();
                        await pcOffer.setLocalDescription(answer);
                        wsRef.current.send(JSON.stringify({
                            type: 'answer', answer: answer, sender: username, target: data.sender
                        }));
                        break;
                    }
                    case 'answer': {
                        const pcAnswer = peerConnectionsRef.current[data.sender];
                        if (pcAnswer) {
                            await pcAnswer.setRemoteDescription(new RTCSessionDescription(data.answer));
                            if (iceCandidateQueue.current[data.sender]) {
                                for (const candidate of iceCandidateQueue.current[data.sender]) {
                                    try { await pcAnswer.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { console.warn(e); }
                                }
                                iceCandidateQueue.current[data.sender] = [];
                            }
                        }
                        break;
                    }
                    case 'ice-candidate': {
                        let pcIce = peerConnectionsRef.current[data.sender];
                        if (!pcIce) {
                             pcIce = initializePeerConnection(data.sender, false, username);
                        }
                        if (pcIce.remoteDescription) {
                            try { await pcIce.addIceCandidate(new RTCIceCandidate(data.candidate)); }
                            catch (e) { console.error("ICE error:", e); }
                        } else {
                            if (!iceCandidateQueue.current[data.sender]) iceCandidateQueue.current[data.sender] = [];
                            iceCandidateQueue.current[data.sender].push(data.candidate);
                        }
                        break;
                    }
                    case 'screen-share-start':
                        setActiveScreenSharer(data.sender);
                        break;
                    case 'screen-share-stop':
                        setActiveScreenSharer((prev) => prev === data.sender ? null : prev);
                        break;
                    case 'request-state':
                        if (isScreenSharingRef.current) {
                            wsRef.current.send(JSON.stringify({ type: 'screen-share-start', sender: username }));
                        }
                        wsRef.current.send(JSON.stringify({ type: 'timer-sync', startTime: getCallStartTime(), sender: username, target: data.sender }));
                        wsRef.current.send(JSON.stringify({ 
                            type: 'media-status', 
                            sender: username, 
                            target: data.sender,
                            isMicOn: sessionStorage.getItem(`mic_state_${roomId}`) === 'true', 
                            isCameraOn: sessionStorage.getItem(`cam_state_${roomId}`) === 'true' 
                        }));
                        // Share our display name with the requester
                        wsRef.current.send(JSON.stringify({ type: 'display-name', displayName: sessionStorage.getItem('displayName') || username, sender: username, target: data.sender }));
                        break;
                    case 'timer-sync': {
                        const currentStart = getCallStartTime();
                        if (data.startTime < currentStart) {
                            sessionStorage.setItem(`call_start_${roomId}`, data.startTime);
                            setElapsed(Math.floor((Date.now() - data.startTime) / 1000));
                        }
                        break;
                    }
                    case 'user-left':
                        handlePeerDisconnect(data.username || data.sender);
                        break;
                    case 'chat-message':
                        setMessages((m) => [...m, { from: data.sender, text: data.text, time: data.time }]);
                        break;
                    case 'change-filter':
                        setPeerFilter(data.filter);
                        break;
                    case 'music-status':
                        break;
                    case 'display-name':
                        setRemoteStreams((prev) =>
                            prev.map(p => p.username === data.sender ? { ...p, displayName: data.displayName } : p)
                        );
                        break;
                    case 'media-status':
                        setRemoteStreams((prev) => 
                            prev.map(p => p.username === data.sender ? { ...p, isMicOn: data.isMicOn, isCameraOn: data.isCameraOn } : p)
                        );
                        break;
                }
            } catch (error) {
                console.error("Websocket handler error:", error);
            }
        };
    };

    const toggleScreenShare = async () => {
        try {
            if (!isScreenSharing) {
                if (activeScreenSharer) {
                    alert(`${activeScreenSharer} is already sharing their screen!`);
                    return;
                }
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
                    video: { width: { ideal: 1920, max: 3840 }, height: { ideal: 1080, max: 2160 }, frameRate: { ideal: 30 } },
                    audio: true
                });
                screenStreamRef.current = screenStream;
                const screenVideoTrack = screenStream.getVideoTracks()[0];
                const screenAudioTrack = screenStream.getAudioTracks()[0];
                screenVideoTrack.contentHint = 'detail'; // Prioritize resolution over framerate for crisp text

                Object.keys(peerConnectionsRef.current).forEach((username) => {
                    const pc = peerConnectionsRef.current[username];
                    
                    // Create separate senders for the screen share stream
                    const videoSender = pc.addTrack(screenVideoTrack, screenStream);
                    let audioSender = null;
                    if (screenAudioTrack) {
                        audioSender = pc.addTrack(screenAudioTrack, screenStream);
                    }
                    
                    screenSendersRef.current[username] = [videoSender, audioSender].filter(Boolean);

                    // Boost bitrate to maximize quality over WebRTC
                    try {
                        const params = videoSender.getParameters();
                        if (!params.encodings) params.encodings = [{}];
                        params.encodings[0].maxBitrate = 5000000; // 5 Mbps
                        videoSender.setParameters(params);
                    } catch (e) {
                        console.warn("Could not set maxBitrate on screen share", e);
                    }
                });

                if (localVideoRef.current) { localVideoRef.current.srcObject = screenStream; }
                setIsScreenSharing(true);
                setActiveScreenSharer(myUsername);
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'screen-share-start', sender: myUsername }));
                }
                screenVideoTrack.onended = () => stopScreenSharing();
            } else { stopScreenSharing(); }
        } catch (err) { console.error(err); }
    };

    const stopScreenSharing = async () => {
        if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(track => track.stop()); screenStreamRef.current = null; }
        
        Object.keys(peerConnectionsRef.current).forEach((username) => {
            const pc = peerConnectionsRef.current[username];
            const senders = screenSendersRef.current[username] || [];
            senders.forEach(sender => {
                try { pc.removeTrack(sender); } catch(e) { console.error(e); }
            });
            delete screenSendersRef.current[username];
        });
        
        if (localVideoRef.current && localStreamRef.current) { 
            localVideoRef.current.srcObject = localStreamRef.current; 
        }
        setIsScreenSharing(false);
        setActiveScreenSharer(null);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'screen-share-stop', sender: myUsername }));
        }
    };

    const handlePeerDisconnect = (leftUsername) => {
        setNotification(`${leftUsername || "A participant"} has left the meeting`);
        setTimeout(() => setNotification(""), 2000);
        if (peerConnectionsRef.current[leftUsername]) {
            peerConnectionsRef.current[leftUsername].close();
            delete peerConnectionsRef.current[leftUsername];
        }
        setRemoteStreams((prevStreams) => prevStreams.filter((item) => item.username !== leftUsername));
        setActiveScreenSharer((prev) => prev === leftUsername ? null : prev);
    };

    // --- On-Mount Initializer ---
    const location = useLocation();
    
    useEffect(() => {
        const storedUsername = sessionStorage.getItem('username');
        if (!storedUsername) {
            alert("Access denied. Please log in first.");
            navigate('/sign-in', { replace: true });
            return;
        }
        setMyUsername(storedUsername);
        const storedDisplayName = sessionStorage.getItem('displayName') || storedUsername.split('@')[0];
        setMyDisplayName(storedDisplayName);

        const camKey = `cam_state_${roomId}`;
        const micKey = `mic_state_${roomId}`;

        let savedCam = sessionStorage.getItem(camKey);
        let camEnabled = savedCam !== null ? savedCam === 'true' : (location.state?.camEnabled || false);

        let savedMic = sessionStorage.getItem(micKey);
        let micEnabled = savedMic !== null ? savedMic === 'true' : (location.state?.micEnabled || false);
        
        sessionStorage.setItem(camKey, camEnabled);
        sessionStorage.setItem(micKey, micEnabled);
        
        if (camEnabled || micEnabled) {
            navigator.mediaDevices.getUserMedia({ video: camEnabled, audio: micEnabled })
                .then((mediaStream) => {
                    localStreamRef.current = mediaStream;
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = mediaStream;
                    }
                    setIsCameraOn(camEnabled);
                    setIsMicOn(micEnabled);
                    connectWebSocket(storedUsername);
                })
                .catch(err => {
                    console.error("Error accessing media constraints:", err);
                    connectWebSocket(storedUsername); // fallback to view-only
                });
        } else {
            // View-only mode
            connectWebSocket(storedUsername);
        }

        if (localAudioElementRef.current) {
            localAudioElementRef.current.volume = musicVolume;
        }

        return () => {
            wsRef.current?.close();
            localStreamRef.current?.getTracks().forEach(track => track.stop());
            screenStreamRef.current?.getTracks().forEach(track => track.stop());
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") { mediaRecorderRef.current.stop(); }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, navigate]);

    useEffect(() => {
        const audioEl = localAudioElementRef.current;
        return () => {
            if (audioEl) { audioEl.pause(); }
        };
    }, []);

    // Derived Render Variables
    const localFilterClass = filters.find(f => f.id === activeFilter)?.style || "";

    const totalUsers = remoteStreams.length + 1;

    const getGridDimensions = (count) => {
        if (count === 1) return { cols: 1, rows: 1 };
        if (count === 2) return { cols: 2, rows: 1 };
        if (count <= 4) return { cols: 2, rows: 2 };
        if (count <= 6) return { cols: 3, rows: 2 };
        if (count <= 9) return { cols: 3, rows: 3 };
        return { cols: 4, rows: Math.ceil(count / 4) };
    };

    const getCardStyle = (isSidebarItem = false) => {
        let baseStyle = {
            position: "relative",
            borderRadius: 14,
            overflow: "hidden",
            background: "#111218",
            border: "1.5px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            aspectRatio: "16/9",
            transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
        };

        if (isSidebarItem) {
            baseStyle.width = "100%";
            baseStyle.height = "auto";
            baseStyle.flexShrink = 0;
            return baseStyle;
        }

        // For main grid, use dynamic sizing that respects grid boundaries
        baseStyle.width = "100%";
        baseStyle.height = "auto";
        baseStyle.maxWidth = "100%";
        baseStyle.maxHeight = "100%";
        baseStyle.placeSelf = "center";
        
        // Ensure that for a single user, it doesn't scale infinitely large
        if (totalUsers === 1) {
            baseStyle.maxWidth = "900px";
        }

        return baseStyle;
    };

    return (
    <div
      style={{
        minHeight: "100vh",
        maxHeight: "100vh",
        background: "#09090D",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "'Inter', sans-serif",
        color: "#E2E8F0",
      }}
    >
      <input type="file" ref={fileInputRef} onChange={handleMusicFileChange} accept="audio/*" className="hidden" />
      
      {showMusicCard && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
            <div style={{ background: "#111218", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "32px", width: "400px", maxWidth: "90%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", position: "relative" }}>
                <button onClick={() => setShowMusicCard(false)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "#9CA3AF", cursor: "pointer" }}><X size={20} /></button>
                <h3 style={{ margin: "0 0 24px 0", fontSize: 20, fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: 10 }}><Music size={24} color="#10B981" /> Stream Music</h3>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <img src="https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_RGB_Green.png" alt="Spotify" style={{ height: 24, objectFit: "contain" }} />
                        </div>
                        <button onClick={() => startSystemAudioShare('https://open.spotify.com')} style={{ background: "#1DB954", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 500, cursor: "pointer", fontSize: 14 }}>Open</button>
                    </div>
                    
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6a/Youtube_Music_icon.svg" alt="YouTube Music Logo" style={{ height: 24, objectFit: "contain" }} />
                            <span style={{ color: "#fff", fontWeight: 600, fontSize: 16 }}>YouTube Music</span>
                        </div>
                        <button onClick={() => startSystemAudioShare('https://music.youtube.com')} style={{ background: "#FF0000", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 500, cursor: "pointer", fontSize: 14 }}>Open</button>
                    </div>
                </div>
                <div style={{ marginTop: 20, fontSize: 12, color: "#9CA3AF", textAlign: "center", lineHeight: 1.5 }}>
                    After clicking Open, please select the newly opened tab and ensure <strong>"Share tab audio"</strong> is checked in the browser prompt.
                </div>
            </div>
        </div>
      )}

      {notification && (
          <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 100, background: "rgba(59, 130, 246, 0.9)", backdropFilter: "blur(10px)", border: "1px solid #3b82f6", color: "#fff", fontWeight: 500, padding: "12px 24px", borderRadius: 999, boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
              {notification}
          </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes bounce-dot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.25; }
          40%            { transform: translateY(-5px); opacity: 1;    }
        }
        @keyframes glow-ring {
          0%, 100% { opacity: 0.18; transform: translate(-50%,-50%) scale(1);    }
          50%       { opacity: 0.05; transform: translate(-50%,-50%) scale(1.18); }
        }
        @keyframes panel-in {
          from { transform: translateX(10px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes tray-up {
          from { transform: translateY(6px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
        @keyframes rec-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }

        .card-wrapper:hover .hover-btn, .card-wrapper:hover .hover-overlay {
          opacity: 1;
          pointer-events: auto;
        }
        .card-wrapper:hover .hover-btn {
          transform: translate(-50%, -50%) scale(1);
        }
        .hover-btn {
          opacity: 0;
          pointer-events: none;
          transform: translate(-50%, -50%) scale(0.95);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hover-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(8px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 5;
        }

        .d1 { animation: bounce-dot 1.5s ease-in-out 0.0s infinite; }
        .d2 { animation: bounce-dot 1.5s ease-in-out 0.2s infinite; }
        .d3 { animation: bounce-dot 1.5s ease-in-out 0.4s infinite; }

        .hbtn {
          display: flex; align-items: center; gap: 7px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px; padding: 6px 14px;
          cursor: pointer; transition: background 0.15s;
          font-family: 'Inter', sans-serif;
          font-size: 13px; font-weight: 500; color: #64748B;
          outline: none;
        }
        .hbtn:hover { background: rgba(255,255,255,0.09); color: #94A3B8; }

        .cb {
          display: flex; align-items: center; justify-content: center;
          width: 44px; height: 44px; border-radius: 50%;
          border: none; cursor: pointer; outline: none;
          transition: transform 0.15s, background 0.15s, color 0.15s;
          flex-shrink: 0;
        }
        .cb:hover  { transform: scale(1.08); }
        .cb:active { transform: scale(0.94); }
        .cb:focus-visible { box-shadow: 0 0 0 2px #10B981; }

        .cb-default { background: rgba(255,255,255,0.07); color: #94A3B8; }
        .cb-default:hover { background: rgba(255,255,255,0.12); }
        .cb-active  { background: rgba(16,185,129,0.16); color: #10B981; }
        .cb-active:hover  { background: rgba(16,185,129,0.24); }
        .cb-danger  { background: rgba(239,68,68,0.14); color: #EF4444; }
        .cb-danger:hover  { background: rgba(239,68,68,0.22); }
        .cb-end {
          width: 48px; height: 48px;
          background: #EF4444; color: #fff;
          box-shadow: 0 4px 18px rgba(239,68,68,0.35);
        }
        .cb-end:hover { background: #DC2626; }

        .fchip {
          padding: 5px 13px; border-radius: 999px; border: none;
          cursor: pointer; font-size: 12px; font-weight: 500;
          font-family: 'Inter', sans-serif; white-space: nowrap;
          transition: background 0.15s, color 0.15s;
        }
        .fchip-off {
          background: rgba(255,255,255,0.05); color: #6B7280;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .fchip-off:hover { background: rgba(255,255,255,0.09); color: #94A3B8; }
        .fchip-on {
          background: rgba(16,185,129,0.15); color: #10B981;
          border: 1px solid rgba(16,185,129,0.3);
        }

        .ptab {
          padding: 5px 14px; border-radius: 999px; border: none;
          cursor: pointer; font-size: 12px; font-weight: 600;
          font-family: 'Inter', sans-serif; text-transform: capitalize;
          transition: background 0.15s, color 0.15s;
        }
        .ptab-off { background: transparent; color: #4A5568; }
        .ptab-off:hover { color: #94A3B8; }
        .ptab-on  { background: rgba(255,255,255,0.09); color: #E2E8F0; }

        .notes-ta {
          background: transparent; border: none; outline: none;
          resize: none; width: 100%; flex: 1; min-height: 0;
          color: #CBD5E1; font-family: 'Inter', sans-serif;
          font-size: 13.5px; line-height: 1.75;
        }
        .notes-ta::placeholder { color: #2D3748; }

        .chat-input {
          flex: 1; background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px; padding: 8px 14px;
          color: #E2E8F0; font-size: 13px;
          font-family: 'Inter', sans-serif; outline: none;
          transition: border-color 0.15s;
        }
        .chat-input:focus { border-color: rgba(16,185,129,0.35); }
        .chat-input::placeholder { color: #374151; }

        .send-btn {
          width: 34px; height: 34px; border-radius: 50%;
          background: #10B981; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: background 0.15s;
        }
        .send-btn:hover { background: #059669; }

        .rec-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #EF4444;
          box-shadow: 0 0 6px #EF4444;
          animation: rec-blink 1.8s ease-in-out infinite;
          flex-shrink: 0;
        }
      `}</style>

      <header
        style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "11px 20px", flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(9,9,13,0.92)",
          backdropFilter: "blur(10px)", zIndex: 30,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "'Pramukh Rounded', sans-serif", fontWeight: 800, fontStyle: "italic", fontSize: 30, color: "#FDFBD4", letterSpacing: "1px" }}>HANGOUT</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="hbtn" onClick={copyRoom}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#10B981", letterSpacing: "0.07em" }}>{roomId}</span>
            {copied ? <Check size={12} strokeWidth={2.5} color="#10B981" /> : <Copy size={12} strokeWidth={2} />}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 999, padding: "6px 13px" }}>
            <span className="rec-dot" />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="hbtn" onClick={() => setShowMusicCard(true)}>
            <Music size={13} strokeWidth={1.75} /> Stream Music
          </button>
        </div>
      </header>

      <div
        style={{
          flex: 1, display: "flex",
          padding: "16px 20px", gap: 14,
          overflow: "hidden", minHeight: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            display: activeScreenSharer ? "flex" : "grid",
            gridTemplateColumns: activeScreenSharer ? undefined : `repeat(${getGridDimensions(totalUsers).cols}, 1fr)`,
            gridTemplateRows: activeScreenSharer ? undefined : `repeat(${getGridDimensions(totalUsers).rows}, 1fr)`,
            flexDirection: activeScreenSharer ? "row" : undefined,
            alignItems: activeScreenSharer ? "stretch" : "center",
            justifyContent: "center",
            alignContent: "center",
            gap: "16px",
            padding: "16px",
            minHeight: 0,
            overflow: "hidden", // Never scroll horizontally or vertically
            background: "#0D0E14",
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.05)"
          }}
        >
          <div style={activeScreenSharer ? { flex: isMaximized ? "1" : "0 0 calc(75% - 8px)", height: "100%", position: "relative", borderRadius: 14, overflow: "hidden", background: "#111218", border: "1.5px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", transition: "flex 0.3s ease" } : getCardStyle()} className="card-wrapper">
            
            {/* The Local Video is always in the DOM for WebRTC bindings, but hidden if someone else is sharing */}
            <video
              data-username={`${myDisplayName} (You)`}
              ref={(el) => {
                localVideoRef.current = el;
                const activeStream = isScreenSharing ? screenStreamRef.current : localStreamRef.current;
                if (el && activeStream && el.srcObject !== activeStream) {
                  el.srcObject = activeStream;
                }
              }}
              autoPlay
              playsInline
              muted
              className={`${localFilterClass} ${activeScreenSharer ? (activeScreenSharer === myUsername ? 'stage-video' : 'hidden-video') : 'grid-video'}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: activeScreenSharer === myUsername ? "fill" : "cover",
                transform: activeScreenSharer === myUsername ? "none" : "scaleX(-1)",
                display: ((isCameraOn || isScreenSharing) && (activeScreenSharer === myUsername || !activeScreenSharer)) ? "block" : "none",
              }}
            />

            {/* Remote Sharer Video */}
            {activeScreenSharer && activeScreenSharer !== myUsername && (
              (() => {
                const sharer = remoteStreams.find(p => p.username === activeScreenSharer);
                const currentPeerFilterStyle = filters.find(f => f.id === peerFilter)?.style || "";
                // Use screenStream if available, fallback to regular stream
                const renderStream = sharer?.screenStream || sharer?.stream;
                return renderStream ? (
                  <video
                    data-username={`${sharer.username} (Presenting)`}
                    autoPlay playsInline
                    ref={(el) => { if (el && el.srcObject !== renderStream) el.srcObject = renderStream; }}
                    className={`${currentPeerFilterStyle} stage-video`}
                    style={{ width: "100%", height: "100%", objectFit: "fill" }}
                  />
                ) : null;
              })()
            )}

            {activeScreenSharer && <div className="hover-overlay" />}
            
            {(activeScreenSharer === myUsername || !activeScreenSharer) && !(isCameraOn || isScreenSharing) && <VideoOff size={24} color="#2D3748" />}
            
            <div style={{ position: "absolute", bottom: 12, left: 12, background: "rgba(26,28,30,0.8)", padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
               {activeScreenSharer === myUsername ? `Your Screen` : (activeScreenSharer ? (() => { const sharer = remoteStreams.find(p => p.username === activeScreenSharer); return `${sharer?.displayName || activeScreenSharer}'s Screen`; })() : `${myDisplayName} (You)`)}
               {!activeScreenSharer || activeScreenSharer === myUsername ? (
                 isMicOn ? <Mic size={14} color="#10B981" /> : <MicOff size={14} color="#EF4444" />
               ) : (
                 (() => {
                   const sharer = remoteStreams.find(p => p.username === activeScreenSharer);
                   return sharer ? (
                     sharer.isMicOn !== false ? <Mic size={14} color="#10B981" /> : <MicOff size={14} color="#EF4444" />
                   ) : null;
                 })()
               )}
            </div>

            {activeScreenSharer === myUsername && (
              <div className="hover-btn" style={{ position: "absolute", top: "50%", left: "50%", display: "flex", gap: 12, zIndex: 10 }}>
                <button onClick={stopScreenSharing} style={{ background: "rgba(239, 68, 68, 0.9)", border: "none", padding: "10px 20px", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 24px rgba(239, 68, 68, 0.4)", backdropFilter: "blur(4px)" }}>
                  <Monitor size={16} strokeWidth={2} /> Stop Sharing
                </button>
                <button onClick={() => setIsMaximized(prev => !prev)} style={{ background: "rgba(255, 255, 255, 0.15)", border: "1px solid rgba(255,255,255,0.1)", padding: "10px 20px", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)", backdropFilter: "blur(4px)" }}>
                  {isMaximized ? <Minimize size={16} strokeWidth={2} /> : <Maximize size={16} strokeWidth={2} />} {isMaximized ? "Minimize" : "Fullscreen"}
                </button>
              </div>
            )}
            
            {activeScreenSharer && activeScreenSharer !== myUsername && (
              <div className="hover-btn" style={{ position: "absolute", top: "50%", left: "50%", display: "flex", gap: 12, zIndex: 10 }}>
                <button onClick={() => setIsMaximized(prev => !prev)} style={{ background: "rgba(255, 255, 255, 0.15)", border: "1px solid rgba(255,255,255,0.1)", padding: "10px 20px", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)", backdropFilter: "blur(4px)" }}>
                  {isMaximized ? <Minimize size={16} strokeWidth={2} /> : <Maximize size={16} strokeWidth={2} />} {isMaximized ? "Minimize" : "Fullscreen"}
                </button>
              </div>
            )}
          </div>

          {activeScreenSharer ? (
            <div style={{ display: isMaximized ? "none" : "flex", flex: "1", flexDirection: "column", gap: "16px", overflowY: "auto", height: "100%", paddingRight: "4px" }}>
              {activeScreenSharer !== myUsername && (
                <div style={getCardStyle(true)}>
                  <video
                      data-username={`${myDisplayName} (You)`}
                      autoPlay playsInline muted
                    ref={(el) => { if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) el.srcObject = localStreamRef.current; }}
                    className={`${localFilterClass} sidebar-video`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: isCameraOn ? "block" : "none" }}
                  />
                  {!isCameraOn && <VideoOff size={24} color="#2D3748" />}
                  <div style={{ position: "absolute", bottom: 12, left: 12, background: "rgba(26,28,30,0.8)", padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                     {myDisplayName} (You)
                     {isMicOn ? <Mic size={14} color="#10B981" /> : <MicOff size={14} color="#EF4444" />}
                  </div>
                </div>
              )}
              {remoteStreams.filter(p => p.username !== activeScreenSharer).map((peer) => {
                const currentPeerFilterStyle = filters.find(f => f.id === peerFilter)?.style || "";
                return (
                  <div key={peer.username} style={getCardStyle(true)}>
                    <video
                      data-username={peer.displayName || peer.username}
                      autoPlay
                      playsInline
                      ref={(el) => { if (el && el.srcObject !== peer.stream) el.srcObject = peer.stream; }}
                      className={`${currentPeerFilterStyle} sidebar-video`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: peer.isCameraOn !== false ? "block" : "none" }}
                    />
                    {peer.isCameraOn === false && <VideoOff size={24} color="#2D3748" />}
                    <div style={{ position: "absolute", bottom: 12, left: 12, background: "rgba(26,28,30,0.8)", padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                       👤 {peer.displayName || peer.username}
                       {peer.isMicOn !== false ? <Mic size={14} color="#10B981" /> : <MicOff size={14} color="#EF4444" />}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            remoteStreams.map((peer) => {
              const currentPeerFilterStyle = filters.find(f => f.id === peerFilter)?.style || "";
              return (
                <div key={peer.username} style={getCardStyle()}>
                  <video
                    data-username={peer.displayName || peer.username}
                    autoPlay
                    playsInline
                    ref={(el) => { if (el && el.srcObject !== peer.stream) el.srcObject = peer.stream; }}
                    className={`${currentPeerFilterStyle} grid-video`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: peer.isCameraOn !== false ? "block" : "none" }}
                  />
                  {peer.isCameraOn === false && <VideoOff size={24} color="#2D3748" />}
                  <div style={{ position: "absolute", bottom: 12, left: 12, background: "rgba(26,28,30,0.8)", padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                     👤 {peer.displayName || peer.username}
                     {peer.isMicOn !== false ? <Mic size={14} color="#10B981" /> : <MicOff size={14} color="#EF4444" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {panel && (
          <div
            style={{
              width: 288, flexShrink: 0,
              borderRadius: 18, background: "#0D0E14",
              border: "1px solid rgba(255,255,255,0.06)",
              display: "flex", flexDirection: "column",
              overflow: "hidden", animation: "panel-in 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 14px", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.04)", borderRadius: 999, padding: 3 }}>
                {["notes", "chat"].map((tab) => (
                  <button key={tab} className={`ptab ${panel === tab ? "ptab-on" : "ptab-off"}`} onClick={() => setPanel(tab)}>{tab}</button>
                ))}
              </div>
              <button onClick={() => setPanel(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#2D3748", display: "flex", padding: 5, borderRadius: 6, outline: "none" }}><X size={15} strokeWidth={2} /></button>
            </div>

            {panel === "notes" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 16px", overflow: "hidden" }}>
                <textarea className="notes-ta" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={"Take notes here...\n\n• Key discussion points\n• Action items\n• Follow-ups"} />
                <div style={{ paddingTop: 10, marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: "#2D3748" }}>{notes.length} chars</span>
                  {notes && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={copyNotes} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 11, color: notesCopied ? "#10B981" : "#4B5563", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, outline: "none" }}>
                        {notesCopied ? <><Check size={11} strokeWidth={2.5} /> Copied</> : <><Copy size={11} strokeWidth={2} /> Copy</>}
                      </button>
                      <button onClick={async () => {
                        if (!notes.trim()) { setNotification("Notes are empty!"); setTimeout(() => setNotification(""), 2000); return; }
                        try {
                          await axios.post(`${API_BASE_URL}/api/notes/save/`, { room_id: roomId, username: myUsername, content: notes });
                          setNotification("✅ Notes saved successfully!");
                        } catch (err) { console.error(err); setNotification("✕ Failed to save notes."); }
                        setTimeout(() => setNotification(""), 2000);
                      }} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 11, color: "#4B5563", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, outline: "none" }} onMouseEnter={(e) => e.currentTarget.style.color = "#10B981"} onMouseLeave={(e) => e.currentTarget.style.color = "#4B5563"}><Save size={11} strokeWidth={2} /> Save</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {panel === "chat" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {messages.map((m, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: m.from === "You" ? "row-reverse" : "row", gap: 8, alignItems: "flex-end" }}>
                      {m.from !== "You" && <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#818CF8", flexShrink: 0 }}>{m.from[0]}</div>}
                      <div>
                        {m.from !== "You" && <p style={{ fontSize: 10, color: "#4B5563", marginBottom: 3, paddingLeft: 2 }}>{m.from}</p>}
                        <div style={{ padding: "8px 12px", borderRadius: 12, background: m.from === "You" ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.05)", border: m.from === "You" ? "1px solid rgba(16,185,129,0.18)" : "1px solid rgba(255,255,255,0.05)", fontSize: 13, color: "#CBD5E1", lineHeight: 1.5, maxWidth: 200, wordBreak: "break-word" }}>{m.text}</div>
                        <p style={{ fontSize: 10, color: "#2D3748", marginTop: 3, textAlign: m.from === "You" ? "right" : "left", paddingLeft: m.from !== "You" ? 2 : 0 }}>{m.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                  <input className="chat-input" type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Message…" />
                  <button className="send-btn" onClick={sendChat}><Send size={14} color="#fff" strokeWidth={2} /></button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showFilters && (
        <div style={{ display: "flex", justifyContent: "center", padding: "0 20px 10px", flexShrink: 0, animation: "tray-up 0.2s ease" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", background: "rgba(13,14,20,0.94)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 999, padding: "8px 14px" }}>
            {filters && filters.map((f) => (
              <button key={f.id} className={`fchip ${activeFilter === f.id ? "fchip-on" : "fchip-off"}`} onClick={() => handleFilterChange(f.id)}>{f.label}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "0 20px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(13,14,20,0.88)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 999, padding: "9px 16px", boxShadow: "0 10px 48px rgba(0,0,0,0.45)" }}>
          <button className={`cb ${!isMicOn ? "cb-danger" : "cb-default"}`} onClick={toggleMic} title={isMicOn ? "Mute mic" : "Unmute mic"}>
            {isMicOn ? <Mic size={17} strokeWidth={1.75} /> : <MicOff size={17} strokeWidth={1.75} />}
          </button>

          <button className={`cb ${!isCameraOn ? "cb-danger" : "cb-default"}`} onClick={toggleCamera} title={isCameraOn ? "Stop camera" : "Start camera"}>
            {isCameraOn ? <Video size={17} strokeWidth={1.75} /> : <VideoOff size={17} strokeWidth={1.75} />}
          </button>

          <button className={`cb ${isScreenSharing ? "cb-active" : "cb-default"}`} onClick={toggleScreenShare} title={isScreenSharing ? "Stop sharing" : "Share screen"}>
            <Monitor size={17} strokeWidth={1.75} />
          </button>
          
          <button className={`cb ${isRecording ? "cb-danger" : "cb-default"}`} onClick={toggleRecording} title={isRecording ? "Stop recording" : "Record meeting"}>
            <Circle size={17} strokeWidth={1.75} fill={isRecording ? "#EF4444" : "transparent"} color={isRecording ? "#EF4444" : "currentColor"} />
          </button>

          <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.07)", margin: "0 4px", flexShrink: 0 }} />

          <button className={`cb ${panel === "chat" ? "cb-active" : "cb-default"}`} onClick={() => togglePanel("chat")} title="Chat"><MessageSquare size={17} strokeWidth={1.75} /></button>
          <button className={`cb ${panel === "notes" ? "cb-active" : "cb-default"}`} onClick={() => togglePanel("notes")} title="Notes"><FileText size={17} strokeWidth={1.75} /></button>
          <button className={`cb ${showFilters ? "cb-active" : "cb-default"}`} onClick={toggleFilters} title="Filters"><Sliders size={17} strokeWidth={1.75} /></button>

          <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.07)", margin: "0 4px", flexShrink: 0 }} />

          <button className="cb cb-end" title="End call" onClick={() => { sessionStorage.removeItem(`call_start_${roomId}`); sessionStorage.removeItem(`cam_state_${roomId}`); sessionStorage.removeItem(`mic_state_${roomId}`); if (wsRef.current) wsRef.current.close(); navigate('/home'); }}><PhoneOff size={17} strokeWidth={2} /></button>
        </div>
      </div>
    </div>
  );
}