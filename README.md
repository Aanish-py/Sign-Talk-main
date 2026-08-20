# 🤟 Sign-Talk

> **Real-time Sign Language to Text/Speech Translator**

Sign-Talk is an AI-powered sign language recognition system that uses a camera to detect hand gestures and translates them into text or speech in real time — making communication more accessible for the deaf and hard-of-hearing community.

---

## ✨ Features

- 🎥 **Real-time gesture detection** via webcam
- 🤖 **AI-powered recognition** using deep learning models
- 📝 **Sign-to-Text** conversion with live output
- 🔊 **Text-to-Speech** output for translated gestures
- 🖐️ **Hand landmark tracking** with MediaPipe
- ⚡ **Fast & lightweight** inference pipeline

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3.x |
| Computer Vision | OpenCV |
| Hand Tracking | MediaPipe |
| Deep Learning | TensorFlow / PyTorch |
| Text-to-Speech | pyttsx3 / gTTS |

---

## 📦 Installation

### Prerequisites
- Python 3.8 or higher
- A working webcam
- pip

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-username/Sign-Talk.git
cd Sign-Talk

# 2. Create a virtual environment
python -m venv venv
source venv/bin/activate      # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt
```

---

## 🚀 Usage

```bash
# Run the main application
python main.py
```

- Position your hand in front of the camera
- Perform a sign language gesture
- The recognized text will appear on screen and be spoken aloud

---

## 📁 Project Structure

```
Sign-Talk/
├── main.py              # Entry point
├── model/               # Trained ML models
├── data/                # Training datasets
├── utils/               # Helper functions
├── requirements.txt     # Python dependencies
└── README.md            # Project documentation
```

---

## 🧠 How It Works

```
Camera Input → Hand Detection (MediaPipe)
            → Landmark Extraction
            → Gesture Classification (ML Model)
            → Text Output
            → Speech Synthesis
```

1. **Capture** — Webcam frames are captured using OpenCV
2. **Detect** — MediaPipe identifies hand landmarks in each frame
3. **Classify** — A trained deep learning model maps landmarks to gestures
4. **Output** — The predicted sign is converted to text and optionally spoken aloud

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Sign-Talk Team**

---

> _Bridging the communication gap, one gesture at a time._ 🤟
# 🤟 SignSpeak — Real-Time ISL Sign-to-Speech Video Calling System

> **Engineering Design & Innovation (EDI) Project MVP**  
> An accessible, peer-to-peer WebRTC video calling application with in-browser Indian Sign Language (ISL) static key-pose recognition, Text-to-Speech (TTS) voice generation, and real-time Speech-to-Text (STT) live captions.

---

## 📌 Project Overview & Educational Scope

SignSpeak bridges conversations between Deaf and Hearing individuals over live video calls without requiring any external hardware or server-side video streaming.

- **100% Client-Side Machine Learning**: All landmark extraction and neural network inference execute locally in the user's browser using WebAssembly and WebGL. No raw video frames are ever recorded or transmitted to a server.
- **Two-Way Real-Time Translation**:
  - **Deaf $\to$ Hearing**: Hand poses held in front of the webcam are classified and spoken aloud in real-time via the Web Speech API (`SpeechSynthesis`).
  - **Hearing $\to$ Deaf**: Voice from the hearing user's microphone is transcribed into real-time live captions displayed directly on the screen.
- **Peer-to-Peer WebRTC**: Low-latency direct media streaming and DataChannel messaging between participants.

> ⚠️ **Educational Limitation Notice**:  
> This MVP demo uses **simplified static hand-pose approximations** of words for recognition. It recognizes a predefined vocabulary of 10 static signs held in view of the webcam. It is an educational engineering prototype and **not** a linguistically complete rendering of natural, fluent Indian Sign Language (ISL).

---

## 🎯 Supported 10-Sign Vocabulary

| ID | Sign | Spoken Text | Pose Description |
| :--- | :--- | :--- | :--- |
| `0` | **HELLO 👋** | "Hello" | Open flat palm facing the camera upright |
| `1` | **YES 👍** | "Yes" | Closed fist with thumb pointing upward |
| `2` | **NO 👎** | "No" | Closed fist with thumb pointing downward |
| `3` | **THANK YOU 🙏** | "Thank you" | Flat open hand with fingers upright near chest |
| `4` | **PLEASE 🤲** | "Please" | Open flat palm facing inward towards chest |
| `5` | **HELP 🆘** | "Help" | Thumbs-up hand resting on open flat base palm |
| `6` | **SORRY ✊** | "Sorry" | Closed fist held over chest |
| `7` | **STOP 🛑** | "Stop" | Open vertical palm facing forward with spread fingers |
| `8` | **GOOD 👌** | "Good" | Index finger touching tip of thumb (OK sign) |
| `9` | **LOVE 🤟** | "I love you" | Thumb, index, and pinky extended upward (ILY sign) |

---

## 🏗️ System Architecture

```
                                  +---------------------------+
                                  |   Signaling Server (WS)   |
                                  | Express + Socket.IO (:5000)|
                                  +-------------+-------------+
                                                | SDP / ICE Relay
                     +--------------------------+--------------------------+
                     |                                                     |
                     v                                                     v
       +----------------------------+                        +----------------------------+
       |     Deaf Signer Tab        |                        |    Hearing Speaker Tab     |
       +----------------------------+                        +----------------------------+
       | 1. MediaPipe Hands (21 pts)|                        | 1. WebRTC Remote Video     |
       | 2. Landmark Normalization  |     WebRTC Video &     | 2. Web Speech TTS Engine   |
       | 3. TensorFlow.js Classifier| =====================> |    (Speaks Sign Aloud)     |
       | 4. Anti-Flicker Filter     |      DataChannel       | 3. Web Speech STT Engine   |
       | 5. Live Captions Receiver  | <===================== |    (Transcribes Voice)     |
       +----------------------------+                        +----------------------------+
```

---

## 🚀 Getting Started & Local Setup

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- A modern browser with WebRTC and Web Speech API support (Google Chrome or Microsoft Edge recommended)
- A working webcam and microphone

### 2. Start the Signaling Server
Open a terminal in the project root:
```bash
cd server
npm install
npm start
```
*The signaling server will start on `http://localhost:5000`.*

### 3. Start the Frontend Application
Open a second terminal:
```bash
cd frontend
npm install
npm run dev
```
*Open `http://localhost:5173` in your browser.*

---

## 📱 Application Modules & Pages

1. **🏠 Home / Landing (`Landing.jsx`)**:
   - Project overview, educational limitation disclosure, architecture breakdown, and full vocabulary reference.
2. **📷 Live Studio & Hardware Diagnostic (`CameraPreview.jsx`)**:
   - Local webcam & mic tester with real-time MediaPipe hand tracking, 21-point glowing skeleton visualizer, AI confidence HUD, TTS audio tester, and STT live speech caption tester.
3. **🧠 AI Studio & Dataset Collector (`DataCollector.jsx`)**:
   - Collect custom landmark frames for any sign, train the TensorFlow.js neural network client-side in 1–2 seconds, inspect live loss/accuracy curves, and export/import JSON datasets.
4. **📹 Video Calling Room (`Room.jsx`)**:
   - Peer-to-peer 2-way WebRTC video room with role-adaptive interface (Deaf vs Hearing vs Unified), real-time sign-to-speech triggers, live speech captions overlay, in-call chat, and sign timeline history.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite 5, Vanilla CSS Design System (Dark theme, glassmorphism, responsive grids)
- **Computer Vision & Tracking**: `@mediapipe/tasks-vision` (MediaPipe Hands WASM + GPU acceleration)
- **Machine Learning**: `@tensorflow/tfjs` (Sequential Neural Network, IndexedDB persistence)
- **Speech Synthesis & Recognition**: Web Speech API (`SpeechSynthesis` & `webkitSpeechRecognition`)
- **Video & Signaling**: WebRTC (`RTCPeerConnection`, `RTCDataChannel`), `socket.io-client`, `express`, `socket.io`

---

## 👥 Authors
- **Abhang Kashid** & Team (Semester 3 Engineering Design & Innovation — EDI)
