import { useState, useRef, useEffect } from 'react'
import './App.css'
import { AlertCircle, CheckCircle, Download } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// Types for download state
type DownloadStatus = 'idle' | 'processing' | 'ready' | 'error';

interface DownloadState {
  status: DownloadStatus;
  progress: number;
  url?: string;
  filename?: string;
  error?: string;
  downloadId?: string;
}

// Backend API URL - will be replaced in production by environment variable
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '/api/proxy';

function App() {
  const [isLoading, setIsLoading] = useState(false)
  const [downloadState, setDownloadState] = useState<DownloadState>({
    status: 'idle',
    progress: 0
  });
  const downloadFrameRef = useRef<HTMLIFrameElement>(null)
  const statusCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Auto-dismiss error notifications after 5 seconds
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (downloadState.status === 'error') {
      timer = setTimeout(() => {
        setDownloadState(prev => ({...prev, status: 'idle'}));
      }, 5000);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [downloadState.status]);

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }
    };
  }, []);

  // Start polling for status when we have a download ID
  useEffect(() => {
    if (downloadState.downloadId && downloadState.status === 'processing') {
      // Clear any existing interval
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }
      
      // Start polling for status
      statusCheckInterval.current = setInterval(async () => {
        try {
          const response = await fetch(`${BACKEND_URL}/download/${downloadState.downloadId}/status`);
          const data = await response.json();
          
          if (data.error) {
            setDownloadState(prev => ({
              ...prev,
              status: 'error',
              error: data.error
            }));
            if (statusCheckInterval.current) {
              clearInterval(statusCheckInterval.current);
              statusCheckInterval.current = null;
            }
            return;
          }
          
          setDownloadState(prev => ({
            ...prev,
            status: data.status,
            progress: data.progress,
            url: data.url,
            filename: data.filename
          }));
          
          // If download is complete or errored, stop polling
          if (data.status === 'ready' || data.status === 'error') {
            if (statusCheckInterval.current) {
              clearInterval(statusCheckInterval.current);
              statusCheckInterval.current = null;
            }
          }
        } catch (error) {
          console.error('Error checking download status:', error);
        }
      }, 1000);
    }
    
    return () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }
    };
  }, [downloadState.downloadId, downloadState.status]);

  // Reset the download state to idle
  const handleReset = () => {
    setDownloadState({
      status: 'idle',
      progress: 0
    });
    setIsLoading(false);
  };

  const handleDownloadComplete = () => {
    if (!downloadState.downloadId || !downloadState.url) return;
    
    // Create a download link - remove any duplicate /api prefixes
    let downloadPath = downloadState.url;
    
    // Fix the URL path to avoid double /api/ prefixes
    if (downloadPath.includes('/api/')) {
      // Extract just the download ID and filename part
      const parts = downloadPath.split('/');
      const downloadIdIndex = parts.findIndex((part: string) => part === 'download');
      if (downloadIdIndex >= 0 && downloadIdIndex + 1 < parts.length) {
        // Reconstruct with just the essential parts
        downloadPath = `/download/${parts[downloadIdIndex + 1]}/file`;
      }
    }
    
    // Ensure we're using the proxy endpoint
    const downloadUrl = `${BACKEND_URL}${downloadPath.startsWith('/') ? downloadPath : '/' + downloadPath}`;
    console.log(`Initiating download from: ${downloadUrl}`);
    
    // Create a temporary anchor element to trigger download
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = downloadState.filename || 'download.mp4';
    a.setAttribute('target', '_blank'); // Add target attribute
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Reset download state after a short delay
    setTimeout(() => {
      setDownloadState({
        status: 'idle',
        progress: 0
      });
    }, 1000);
  }

  const handlePasteAndProcess = async () => {
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      setDownloadState({
        status: 'idle',
        progress: 0
      });
      
      // Get clipboard content with error handling
      let clipboardText = '';
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          clipboardText = await navigator.clipboard.readText();
        } else {
          // If clipboard API is not available, show an error message
          setDownloadState({
            status: 'error',
            progress: 0,
            error: 'Clipboard API not available'
          });
          setIsLoading(false);
          return;
        }
      } catch (clipboardError) {
        console.error('Clipboard error:', clipboardError);
        // Show an error message on clipboard error
        setDownloadState({
          status: 'error',
          progress: 0,
          error: 'Clipboard permission denied'
        });
        setIsLoading(false);
        return;
      }
      
      if (!clipboardText || !clipboardText.trim()) {
        setDownloadState({
          status: 'error',
          progress: 0,
          error: 'Invalid Link'
        });
        setIsLoading(false);
        return;
      }
      
      // Simple URL validation
      try {
        new URL(clipboardText);
      } catch {
        setDownloadState({
          status: 'error',
          progress: 0,
          error: 'Invalid Link'
        });
        setIsLoading(false);
        return;
      }
      
      // Send URL to backend for processing
      const response = await fetch(`${BACKEND_URL}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: clipboardText })
      });
      
      const data = await response.json();
      
      if (data.error) {
        setDownloadState({
          status: 'error',
          progress: 0,
          error: data.error
        });
      } else if (data.downloadId) {
        // Start tracking download progress
        setDownloadState({
          status: 'processing',
          progress: 0,
          downloadId: data.downloadId
        });
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        setDownloadState({
          status: 'error',
          progress: 0,
          error: 'Clipboard permission denied'
        });
      } else {
        setDownloadState({
          status: 'error',
          progress: 0,
          error: 'Connection error'
        });
        console.error(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-b from-purple-950 to-slate-950">
      {/* Hidden iframe for download (if needed) */}
      <iframe ref={downloadFrameRef} style={{ display: 'none' }} />
      
      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="container max-w-2xl flex flex-col items-center">
          
          {/* Fetch Button - Now integrates the alert states */}
          <motion.div
            whileHover={downloadState.status === 'idle' ? { scale: 1.05 } : {}}
            whileTap={downloadState.status === 'idle' ? { scale: 0.95 } : {}}
            className="relative"
          >
            <motion.button
              onClick={downloadState.status === 'idle' ? handlePasteAndProcess : 
                      downloadState.status === 'ready' ? handleDownloadComplete : 
                      downloadState.status === 'error' ? handleReset : undefined}
              disabled={downloadState.status === 'processing'}
              className={`w-36 h-36 rounded-xl flex flex-col items-center justify-center text-white font-medium relative overflow-hidden
                        ${downloadState.status === 'idle' ? 'bg-purple-600' : 
                          downloadState.status === 'processing' ? 'bg-blue-500' : 
                          downloadState.status === 'ready' ? 'bg-green-500' : 
                          downloadState.status === 'error' ? 'bg-red-500' : 'bg-purple-600'}`}
            >
              {/* Pulsing glow effect */}
              <div className={`absolute inset-0 rounded-xl ${
                downloadState.status === 'idle' ? 'glow-purple' : 
                downloadState.status === 'processing' ? 'glow-blue' : 
                downloadState.status === 'ready' ? 'glow-green' : 
                downloadState.status === 'error' ? 'glow-red' : 'glow-purple'
              }`} />
              
              {/* Content based on state */}
              <AnimatePresence mode="wait">
                {downloadState.status === 'idle' && (
                  <motion.span 
                    key="idle"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                    className="z-20 text-2xl"
                  >
                    Fetch
                  </motion.span>
                )}
                
                {downloadState.status === 'processing' && (
                  <motion.div 
                    key="processing"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center justify-center z-20 p-2"
                  >
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                    <span className="text-sm text-center">Processing...</span>
                  </motion.div>
                )}
                
                {downloadState.status === 'ready' && (
                  <motion.div 
                    key="ready"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center justify-center z-20 p-2"
                  >
                    <CheckCircle className="h-8 w-8 mb-1" />
                    <span className="text-sm text-center">Download</span>
                    <span className="text-xs mt-1 flex items-center">
                      <Download className="h-3 w-3 mr-1" />
                      Now
                    </span>
                  </motion.div>
                )}
                
                {downloadState.status === 'error' && (
                  <motion.div 
                    key="error"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center justify-center z-20 p-2"
                  >
                    <AlertCircle className="h-8 w-8 mb-1" />
                    <span className="text-xs text-center">{downloadState.error || 'Error'}</span>
                    <span className="text-xs mt-1 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="ml-1">Retry</span>
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default App;
