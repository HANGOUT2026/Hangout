import os

with open('frontend/src/pages/Call.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add lucide-react imports
content = content.replace(
    "import axios from 'axios';",
    "import axios from 'axios';\nimport { Mic, MicOff, Video, VideoOff, Monitor, MessageSquare, FileText, Sliders, PhoneOff, Copy, Check, Music, X, Send, Circle } from 'lucide-react';"
)

filters_block = """    const filters = [
        { id: "none", label: "Normal", icon: "✨", style: "" },
        { id: "sepia", label: "Warm Sepia", icon: "🌅", style: "sepia" },
        { id: "grayscale", label: "Mono Black", icon: "🎬", style: "grayscale" },
        { id: "invert", label: "Cyber X-Ray", icon: "🔮", style: "invert" },
        { id: "blur", label: "Soft Focus", icon: "blur-sm" },
        { id: "hue", label: "Neon Pop", icon: "🌈", style: "hue-rotate-90" }
    ];"""

new_states_block = filters_block + """

    const [showFilters, setShowFilters] = useState(false);
    const [panel, setPanel] = useState(null);
    const [copied, setCopied] = useState(false);
    const [notes, setNotes] = useState("");
    const [notesCopied, setNotesCopied] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [messages, setMessages] = useState([]);
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setElapsed((e) => e + 1), 1000);
        return () => clearInterval(id);
    }, []);

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
        try { navigator.clipboard.writeText(roomId); } catch {}
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const copyNotes = () => {
        try { navigator.clipboard.writeText(notes); } catch {}
        setNotesCopied(true);
        setTimeout(() => setNotesCopied(false), 2000);
    };

    const togglePanel = (name) => {
        setPanel((p) => (p === name ? null : name));
        setShowFilters(false);
    };

    const toggleFilters = () => {
        setShowFilters((f) => !f);
    };
"""

content = content.replace(filters_block, new_states_block)

content = content.replace(
    "case 'change-filter':\n                    setPeerFilter(data.filter);\n                    break;\n                case 'music-status':",
    "case 'change-filter':\n                    setPeerFilter(data.filter);\n                    break;\n                case 'chat-message':\n                    setMessages((m) => [...m, { from: data.sender, text: data.text, time: data.time }]);\n                    if (panel !== 'chat') setNotification(`New message from ${data.sender}`);\n                    setTimeout(() => setNotification(''), 3000);\n                    break;\n                case 'music-status':"
)

with open('frontend/src/new_ui.txt', 'r', encoding='utf-8') as f:
    new_ui = f.read()

idx = content.find("return (\n        <div className=\"flex flex-col items-center justify-between min-h-screen")
if idx == -1:
    idx = content.find("return (")
    
content = content[:idx] + new_ui

with open('frontend/src/pages/Call.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
