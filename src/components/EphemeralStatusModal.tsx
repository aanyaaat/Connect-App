import { useState, useRef, useEffect } from 'react';
import { Camera, Video, Mic, X, ArrowLeft, Sparkles, Send, Square, Play, Pause, RefreshCw } from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';

interface EphemeralStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'PHOTO' | 'VIDEO' | 'VOICE';

export function EphemeralStatusModal({ isOpen, onClose }: EphemeralStatusModalProps) {
  const { uploadEphemeralStatus } = useAppData();
  const [activeTab, setActiveTab] = useState<TabType>('PHOTO');
  const [mediaData, setMediaData] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Video recording state
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoCountdown, setVideoCountdown] = useState(3);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Clean up media streams
  useEffect(() => {
    return () => {
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setMediaData(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Voice Recording handlers
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setMediaData(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecordingVoice(true);
      setVoiceDuration(0);

      voiceTimerRef.current = setInterval(() => {
        setVoiceDuration((d) => {
          if (d >= 30) {
            stopVoiceRecording();
            return 30;
          }
          return d + 1;
        });
      }, 1000);
    } catch {
      setErrorMsg('Microphone access denied. Please allow audio permissions.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecordingVoice) {
      mediaRecorderRef.current.stop();
      setIsRecordingVoice(false);
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    }
  };

  // Video 3-sec clip recording
  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 480, height: 480 },
        audio: true,
      });
      videoStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }

      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setMediaData(reader.result as string);
        };
        reader.readAsDataURL(videoBlob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setIsRecordingVideo(true);
      setVideoCountdown(3);

      let count = 3;
      const timer = setInterval(() => {
        count -= 1;
        setVideoCountdown(count);
        if (count <= 0) {
          clearInterval(timer);
          recorder.stop();
          setIsRecordingVideo(false);
        }
      }, 1000);
    } catch {
      setErrorMsg('Camera access denied. Please allow camera permissions.');
    }
  };

  const handlePublish = async () => {
    if (!mediaData) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await uploadEphemeralStatus(activeTab, mediaData, caption, voiceDuration || 3);
      if (res.ok) {
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to post status');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error uploading status');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 sm:p-6 text-white animate-fade-in select-none">
      {/* Centered Modal Card */}
      <div className="w-full max-w-lg bg-[#140e1c] border border-white/20 rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Sticky Top Header with High-Contrast Desktop Controls */}
        <div className="sticky top-0 z-30 w-full flex items-center justify-between pb-4 border-b border-white/15 bg-[#140e1c]">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-bold text-xs transition-all shadow-md cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/40 px-3.5 py-1.5 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            <span className="text-xs font-bold tracking-wider uppercase text-rose-200">
              1-Hour Live Glance
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/20 hover:bg-rose-500 active:scale-95 text-white transition-all shadow-md cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col items-center justify-center my-4 w-full">
          {!mediaData ? (
            <div className="w-full flex flex-col items-center gap-5">
              {/* Tab Selectors */}
              <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/10 border border-white/10 w-full justify-around">
                <button
                  onClick={() => { setActiveTab('PHOTO'); setErrorMsg(''); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'PHOTO' ? 'bg-rose-500 text-white shadow-md' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Camera className="w-4 h-4" /> Photo
                </button>
                <button
                  onClick={() => { setActiveTab('VIDEO'); setErrorMsg(''); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'VIDEO' ? 'bg-purple-500 text-white shadow-md' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Video className="w-4 h-4" /> 3s Video
                </button>
                <button
                  onClick={() => { setActiveTab('VOICE'); setErrorMsg(''); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'VOICE' ? 'bg-pink-500 text-white shadow-md' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Mic className="w-4 h-4" /> Voice
                </button>
              </div>

              {/* Photo Capture / Upload */}
              {activeTab === 'PHOTO' && (
                <div className="w-full flex flex-col items-center gap-4 py-6">
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-44 h-44 rounded-3xl bg-gradient-to-tr from-rose-900/60 to-purple-900/60 border-2 border-dashed border-rose-500/40 hover:border-rose-400 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-xl"
                  >
                    <Camera className="w-10 h-10 text-rose-400" />
                    <span className="text-xs font-bold text-rose-200">Take or Pick Photo</span>
                  </button>
                  <p className="text-xs text-white/50 text-center">
                    Shared instantly with partner · Auto-deleted in 1 hour
                  </p>
                </div>
              )}

              {/* 3s Video Recording */}
              {activeTab === 'VIDEO' && (
                <div className="w-full flex flex-col items-center gap-4 py-4">
                  <div className="w-56 h-56 rounded-3xl overflow-hidden bg-black/60 border border-purple-500/40 flex items-center justify-center relative shadow-xl">
                    <video ref={videoPreviewRef} playsInline muted className="w-full h-full object-cover" />
                    {isRecordingVideo && (
                      <div className="absolute inset-0 bg-red-500/20 flex flex-col items-center justify-center">
                        <span className="text-4xl font-bold text-white animate-ping">{videoCountdown}</span>
                        <span className="text-xs font-semibold text-white mt-2">Recording 3s Clip...</span>
                      </div>
                    )}
                  </div>

                  {!isRecordingVideo && (
                    <button
                      onClick={startVideoRecording}
                      className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-500/30"
                    >
                      <Video className="w-4 h-4" /> Start 3-Second Recording
                    </button>
                  )}
                </div>
              )}

              {/* Voice Message Recording */}
              {activeTab === 'VOICE' && (
                <div className="w-full flex flex-col items-center gap-5 py-6">
                  <div className="relative flex items-center justify-center">
                    {isRecordingVoice && (
                      <div className="absolute w-36 h-36 bg-pink-500/30 rounded-full animate-ping pointer-events-none" />
                    )}
                    <button
                      onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
                      className={`w-28 h-28 rounded-full flex flex-col items-center justify-center gap-1 shadow-2xl transition-all ${
                        isRecordingVoice
                          ? 'bg-red-600 scale-105 shadow-red-500/50'
                          : 'bg-gradient-to-tr from-pink-600 to-rose-500 hover:scale-105 shadow-pink-500/40'
                      }`}
                    >
                      {isRecordingVoice ? (
                        <>
                          <Square className="w-8 h-8 text-white fill-white" />
                          <span className="text-[11px] font-bold text-white">{voiceDuration}s / 30s</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-8 h-8 text-white" />
                          <span className="text-[10px] font-bold text-white/90">TAP TO RECORD</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-white/50 text-center">
                    {isRecordingVoice ? 'Listening to your voice note...' : 'Record up to 30 seconds of love note'}
                  </p>
                </div>
              )}

              {errorMsg && (
                <div className="text-xs text-rose-400 bg-rose-500/10 px-3 py-2 rounded-xl border border-rose-500/20 text-center w-full">
                  {errorMsg}
                </div>
              )}
            </div>
          ) : (
            /* Preview Mode */
            <div className="w-full flex flex-col items-center gap-4">
              <div className="w-full max-h-72 rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black flex items-center justify-center relative">
                {activeTab === 'PHOTO' && (
                  <img src={mediaData} alt="Glance Preview" className="max-h-72 w-full object-contain" />
                )}
                {activeTab === 'VIDEO' && (
                  <video src={mediaData} autoPlay loop playsInline className="max-h-72 w-full object-contain" />
                )}
                {activeTab === 'VOICE' && (
                  <div className="w-full py-12 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-pink-950/60 to-purple-950/60">
                    <audio
                      ref={audioPlayerRef}
                      src={mediaData}
                      onEnded={() => setIsPlayingAudio(false)}
                      className="hidden"
                    />
                    <button
                      onClick={() => {
                        if (isPlayingAudio) {
                          audioPlayerRef.current?.pause();
                          setIsPlayingAudio(false);
                        } else {
                          audioPlayerRef.current?.play();
                          setIsPlayingAudio(true);
                        }
                      }}
                      className="w-16 h-16 rounded-full bg-pink-500 text-white flex items-center justify-center shadow-lg shadow-pink-500/40 active:scale-95"
                    >
                      {isPlayingAudio ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                    </button>
                    <span className="text-xs font-semibold text-pink-200">Voice Glance ({voiceDuration}s)</span>
                  </div>
                )}
              </div>

              {/* Caption Input */}
              <input
                type="text"
                placeholder="Add a cute caption (optional)..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-white/10 border border-white/15 text-sm text-white placeholder-white/40 focus:outline-none focus:border-rose-500"
              />

              {/* Action Buttons */}
              <div className="w-full flex items-center gap-2.5">
                <button
                  onClick={() => setMediaData(null)}
                  className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-semibold text-xs flex items-center justify-center gap-1.5 border border-white/10"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retake
                </button>
                <button
                  onClick={handlePublish}
                  disabled={isSubmitting}
                  className="flex-[2] py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Sharing...' : 'Share 1-Hour Glance'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Exit Button */}
        <div className="w-full pt-3 border-t border-white/10 flex flex-col items-center gap-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-98 text-xs font-semibold text-white/70 flex items-center justify-center gap-1.5 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Main Screen
          </button>
          <div className="text-[11px] text-white/40">
            Visible on Lock Screen Widget &amp; App · Auto-expires in 60 mins
          </div>
        </div>
      </div>
    </div>
  );
}
