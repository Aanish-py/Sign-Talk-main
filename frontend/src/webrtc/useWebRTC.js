import { useState, useEffect, useRef, useCallback } from 'react';
import { signalingService } from './signalingService';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

/**
 * useWebRTC Hook
 * 
 * Manages complete WebRTC PeerConnection lifecycle, STUN negotiation,
 * RTCDataChannel synchronization, and remote stream handling.
 */
export function useWebRTC(roomId, localStream, role = 'unified', callbacks = {}) {
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected'|'signaling'|'connecting'|'connected'|'failed'
  const [remoteStream, setRemoteStream] = useState(null);
  const [remotePeerInfo, setRemotePeerInfo] = useState(null);
  const [isDataChannelReady, setIsDataChannelReady] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);

  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const remoteSocketIdRef = useRef(null);
  const iceCandidateQueueRef = useRef([]);
  const isInitiatorRef = useRef(false);

  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  // Setup RTCDataChannel message handling
  const setupDataChannelEvents = useCallback((channel) => {
    channel.onopen = () => {
      console.log('[WebRTC] DataChannel opened.');
      setIsDataChannelReady(true);
    };

    channel.onclose = () => {
      console.log('[WebRTC] DataChannel closed.');
      setIsDataChannelReady(false);
    };

    channel.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { type, data } = payload;

        if (type === 'sign-event' && callbacksRef.current.onRemoteSignReceived) {
          callbacksRef.current.onRemoteSignReceived(data);
        } else if (type === 'speech-transcript' && callbacksRef.current.onRemoteTranscriptReceived) {
          callbacksRef.current.onRemoteTranscriptReceived(data);
        } else if (type === 'chat-message') {
          setChatMessages((prev) => [...prev, data]);
          if (callbacksRef.current.onChatMessageReceived) {
            callbacksRef.current.onChatMessageReceived(data);
          }
        }
      } catch (err) {
        console.warn('[WebRTC] DataChannel message parse error:', err);
      }
    };

    dataChannelRef.current = channel;
  }, []);

  // Create PeerConnection instance
  const createPeerConnection = useCallback((targetSocketId) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    console.log(`[WebRTC] Creating RTCPeerConnection for target: ${targetSocketId}`);
    const pc = new RTCPeerConnection(RTC_CONFIG);
    remoteSocketIdRef.current = targetSocketId;

    // Attach local media stream tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle inbound remote media tracks
    pc.ontrack = (event) => {
      console.log('[WebRTC] Inbound remote track received:', event.track.kind);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else {
        const inboundStream = new MediaStream([event.track]);
        setRemoteStream(inboundStream);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signalingService.sendIceCandidate(targetSocketId, event.candidate, roomId);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected');
      } else if (pc.connectionState === 'connecting') {
        setConnectionStatus('connecting');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        setConnectionStatus('disconnected');
        setRemoteStream(null);
      } else if (pc.connectionState === 'failed') {
        setConnectionStatus('failed');
      }
    };

    // Handle inbound DataChannel created by initiator
    pc.ondatachannel = (event) => {
      console.log('[WebRTC] Received inbound DataChannel from peer.');
      setupDataChannelEvents(event.channel);
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [localStream, roomId, setupDataChannelEvents]);

  // Initiate WebRTC Call (Offer)
  const initiateCall = useCallback(async (targetSocketId) => {
    try {
      isInitiatorRef.current = true;
      const pc = createPeerConnection(targetSocketId);

      // Create DataChannel as caller
      const dc = pc.createDataChannel('signspeak-channel', { ordered: true });
      setupDataChannelEvents(dc);

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);

      console.log('[WebRTC] Sending SDP offer to:', targetSocketId);
      signalingService.sendOffer(targetSocketId, offer, roomId);
      setConnectionStatus('connecting');
    } catch (err) {
      console.error('[WebRTC] Error initiating call offer:', err);
    }
  }, [createPeerConnection, roomId, setupDataChannelEvents]);

  // Handle incoming Offer
  const handleReceiveOffer = useCallback(async ({ senderSocketId, sdp }) => {
    try {
      console.log('[WebRTC] Handling SDP offer from:', senderSocketId);
      isInitiatorRef.current = false;
      const pc = createPeerConnection(senderSocketId);

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      // Process queued ICE candidates
      while (iceCandidateQueueRef.current.length > 0) {
        const candidate = iceCandidateQueueRef.current.shift();
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log('[WebRTC] Sending SDP answer back to:', senderSocketId);
      signalingService.sendAnswer(senderSocketId, answer, roomId);
      setConnectionStatus('connecting');
    } catch (err) {
      console.error('[WebRTC] Error handling offer:', err);
    }
  }, [createPeerConnection, roomId]);

  // Handle incoming Answer
  const handleReceiveAnswer = useCallback(async ({ sdp }) => {
    try {
      console.log('[WebRTC] Received SDP answer.');
      const pc = peerConnectionRef.current;
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        // Process queued ICE candidates
        while (iceCandidateQueueRef.current.length > 0) {
          const candidate = iceCandidateQueueRef.current.shift();
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
    } catch (err) {
      console.error('[WebRTC] Error setting remote answer description:', err);
    }
  }, []);

  // Handle incoming ICE Candidate
  const handleReceiveIceCandidate = useCallback(async ({ candidate }) => {
    try {
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        iceCandidateQueueRef.current.push(candidate);
      }
    } catch (err) {
      console.warn('[WebRTC] ICE candidate add warning:', err);
    }
  }, []);

  // Initialize signaling socket & event subscriptions
  useEffect(() => {
    if (!roomId) return;

    setConnectionStatus('signaling');
    signalingService.connect();
    signalingService.joinRoom(roomId, `user-${Math.floor(100 + Math.random() * 900)}`, role);

    const onRoomJoined = ({ existingPeers }) => {
      console.log('[Signaling] Room joined. Existing peers in room:', existingPeers);
      if (existingPeers && existingPeers.length > 0) {
        const targetPeer = existingPeers[0];
        setRemotePeerInfo(targetPeer);
        initiateCall(targetPeer.socketId);
      }
    };

    const onUserConnected = ({ socketId, userId, role: peerRole }) => {
      console.log(`[Signaling] New peer connected: ${userId} (${socketId})`);
      setRemotePeerInfo({ socketId, userId, role: peerRole });
      // If we are existing in room, the new joiner will be called or will call
    };

    const onUserDisconnected = ({ socketId }) => {
      console.log(`[Signaling] Peer left: ${socketId}`);
      if (remoteSocketIdRef.current === socketId) {
        setRemoteStream(null);
        setRemotePeerInfo(null);
        setConnectionStatus('disconnected');
        setIsDataChannelReady(false);
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
      }
    };

    const onRemoteSign = ({ sign }) => {
      if (callbacksRef.current.onRemoteSignReceived) {
        callbacksRef.current.onRemoteSignReceived(sign);
      }
    };

    const onRemoteSpeech = (data) => {
      if (callbacksRef.current.onRemoteTranscriptReceived) {
        callbacksRef.current.onRemoteTranscriptReceived(data);
      }
    };

    const onChat = (data) => {
      setChatMessages((prev) => [...prev, data]);
      if (callbacksRef.current.onChatMessageReceived) {
        callbacksRef.current.onChatMessageReceived(data);
      }
    };

    signalingService.on('room-joined', onRoomJoined);
    signalingService.on('user-connected', onUserConnected);
    signalingService.on('user-disconnected', onUserDisconnected);
    signalingService.on('offer', handleReceiveOffer);
    signalingService.on('answer', handleReceiveAnswer);
    signalingService.on('ice-candidate', handleReceiveIceCandidate);
    signalingService.on('remote-sign-event', onRemoteSign);
    signalingService.on('remote-speech-transcript', onRemoteSpeech);
    signalingService.on('chat-message', onChat);

    return () => {
      signalingService.off('room-joined', onRoomJoined);
      signalingService.off('user-connected', onUserConnected);
      signalingService.off('user-disconnected', onUserDisconnected);
      signalingService.off('offer', handleReceiveOffer);
      signalingService.off('answer', handleReceiveAnswer);
      signalingService.off('ice-candidate', handleReceiveIceCandidate);
      signalingService.off('remote-sign-event', onRemoteSign);
      signalingService.off('remote-speech-transcript', onRemoteSpeech);
      signalingService.off('chat-message', onChat);

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      signalingService.disconnect();
    };
  }, [roomId, role, initiateCall, handleReceiveOffer, handleReceiveAnswer, handleReceiveIceCandidate]);

  // Synchronize dynamic localStream track changes (mute/disable video)
  useEffect(() => {
    const pc = peerConnectionRef.current;
    if (pc && localStream) {
      const senders = pc.getSenders();
      localStream.getTracks().forEach((track) => {
        const sender = senders.find((s) => s.track && s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        }
      });
    }
  }, [localStream]);

  // Send Recognized Sign (DataChannel + Signaling Fallback)
  const sendSign = useCallback((sign) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify({ type: 'sign-event', data: sign }));
    } else {
      signalingService.sendSignEvent(roomId, sign);
    }
  }, [roomId]);

  // Send Speech Transcript (DataChannel + Signaling Fallback)
  const sendSpeechTranscript = useCallback((transcript, isFinal) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify({ type: 'speech-transcript', data: { transcript, isFinal } }));
    } else {
      signalingService.sendSpeechTranscript(roomId, transcript, isFinal);
    }
  }, [roomId]);

  // Send In-Call Chat Message
  const sendChatMessage = useCallback((message, senderName = 'Me') => {
    const msgObj = {
      id: Date.now() + Math.random().toString(36).substring(2, 7),
      senderName,
      text: message,
      timestamp: new Date().toLocaleTimeString()
    };

    setChatMessages((prev) => [...prev, msgObj]);

    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify({ type: 'chat-message', data: msgObj }));
    } else {
      signalingService.sendChatMessage(roomId, message, senderName);
    }
  }, [roomId]);

  return {
    connectionStatus,
    remoteStream,
    remotePeerInfo,
    isDataChannelReady,
    chatMessages,
    sendSign,
    sendSpeechTranscript,
    sendChatMessage
  };
}
