// Copy and paste these commands in your browser console (F12) to debug audio issues

// 1. Test microphone permissions
console.log('🔧 Testing microphone access...');
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    console.log('✅ Microphone access granted:', {
      tracks: stream.getAudioTracks().length,
      deviceId: stream.getAudioTracks()[0]?.getSettings?.()?.deviceId,
      sampleRate: stream.getAudioTracks()[0]?.getSettings?.()?.sampleRate
    });
    stream.getTracks().forEach(track => track.stop());
  })
  .catch(err => {
    console.error('❌ Microphone access failed:', err);
    if (err.name === 'NotAllowedError') {
      console.log('🔧 Fix: Grant microphone permissions in browser settings');
    }
  });

// 2. Test MediaRecorder support
console.log('🔧 Testing MediaRecorder support...');
if (!window.MediaRecorder) {
  console.error('❌ MediaRecorder not supported in this browser');
} else {
  const codecs = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/wav'
  ];
  
  const supported = codecs.filter(codec => MediaRecorder.isTypeSupported(codec));
  console.log('✅ Supported audio codecs:', supported);
  
  if (supported.length === 0) {
    console.error('❌ No supported audio codecs found');
    console.log('🔧 Fix: Try Chrome or Edge browser');
  }
}

// 3. Test actual recording (requires user interaction)
async function testRecording() {
  try {
    console.log('🔧 Testing actual recording...');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { 
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm'
    });
    
    let dataReceived = false;
    recorder.ondataavailable = (e) => {
      dataReceived = true;
      console.log('✅ Audio data captured:', {
        hasData: !!e.data,
        size: e.data?.size || 0,
        type: e.data?.type
      });
    };
    
    recorder.start(1000); // 1 second chunks
    console.log('📹 Recording started, waiting 3 seconds...');
    
    setTimeout(() => {
      recorder.stop();
      stream.getTracks().forEach(track => track.stop());
      
      setTimeout(() => {
        if (dataReceived) {
          console.log('✅ Recording test successful!');
        } else {
          console.error('❌ Recording test failed - no data captured');
          console.log('🔧 Fix: Check microphone is not muted, try different browser');
        }
      }, 500);
    }, 3000);
    
  } catch (error) {
    console.error('❌ Recording test failed:', error);
  }
}

console.log('🔧 To test actual recording, run: testRecording()');
