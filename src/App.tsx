import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Settings2, 
  Terminal, 
  Copy, 
  Download, 
  ImageIcon, 
  Monitor, 
  Maximize, 
  Maximize2,
  RefreshCcw,
  LayoutGrid,
  FileText,
  Activity,
  Zap,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Sun,
  Contrast as ContrastIcon,
  Eraser,
  Type
} from 'lucide-react';

// Character sets for different aesthetics
const CHARACTER_SETS = {
  standard: '@%#*+=-:. ',
  blocks: '█▓▒░ ',
  binary: '01',
  dots: '•· ',
  complex: '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`\'. '
};

type Mode = 'ascii' | 'pixel' | 'braille' | 'edge';
type ColorProfile = 'original' | 'matrix' | 'amber' | 'cyber' | 'mono';
type CharacterSetName = keyof typeof CHARACTER_SETS;

export default function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [output, setOutput] = useState<string | React.ReactNode[]>([]);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persistent Settings
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('tp_mode') as Mode) || 'ascii');
  const [charSet, setCharSet] = useState<CharacterSetName>(() => (localStorage.getItem('tp_charSet') as CharacterSetName) || 'standard');
  const [colorProfile, setColorProfile] = useState<ColorProfile>(() => (localStorage.getItem('tp_colorProfile') as ColorProfile) || 'original');
  const [useColor, setUseColor] = useState(() => localStorage.getItem('tp_useColor') !== 'false');
  const [isCrtEnabled, setIsCrtEnabled] = useState(() => localStorage.getItem('tp_crt') !== 'false');
  
  const [customChars, setCustomChars] = useState('');
  const [resolution, setResolution] = useState(100);
  const [contrast, setContrast] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [dithering, setDithering] = useState(false);
  const [fontSize, setFontSize] = useState(10);
  const [isInverted, setIsInverted] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence side effects
  useEffect(() => {
    localStorage.setItem('tp_mode', mode);
    localStorage.setItem('tp_charSet', charSet);
    localStorage.setItem('tp_colorProfile', colorProfile);
    localStorage.setItem('tp_useColor', String(useColor));
    localStorage.setItem('tp_crt', String(isCrtEnabled));
  }, [mode, charSet, colorProfile, useColor, isCrtEnabled]);

  // Core processing logic
  const processImage = useCallback(() => {
    const img = image;
    if (!img || !canvasRef.current) return;

    setIsProcessing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const sourceWidth = (img as HTMLImageElement).naturalWidth || (img as HTMLImageElement).width;
    const sourceHeight = (img as HTMLImageElement).naturalHeight || (img as HTMLImageElement).height;
    
    if (sourceWidth === 0 || sourceHeight === 0) return;

    const ratio = sourceHeight / sourceWidth;
    setAspectRatio(ratio);
    
    let heightScale = (mode === 'ascii' ? 0.55 : mode === 'edge' ? 0.55 : mode === 'braille' ? 0.5 : 1);
    const internalWidth = resolution * (mode === 'braille' ? 2 : 1);
    const internalHeight = Math.floor(resolution * ratio * (mode === 'braille' ? 4 : 1) * heightScale);

    canvas.width = internalWidth;
    canvas.height = internalHeight;
    ctx.drawImage(img, 0, 0, internalWidth, internalHeight);

    const imageData = ctx.getImageData(0, 0, internalWidth, internalHeight);
    const pixels = imageData.data;
    const chars = customChars || CHARACTER_SETS[charSet];
    
    const getProcessedPixel = (r: number, g: number, b: number) => {
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
      let nr = factor * (r - 128) + 128 + (brightness - 1) * 255;
      let ng = factor * (g - 128) + 128 + (brightness - 1) * 255;
      let nb = factor * (b - 128) + 128 + (brightness - 1) * 255;

      let fr = nr, fg = ng, fb = nb;
      const avg = (nr + ng + nb) / 3;
      
      switch (colorProfile) {
        case 'matrix': fr = avg * 0.1; fg = avg; fb = avg * 0.1; break;
        case 'amber': fr = avg; fg = avg * 0.6; fb = avg * 0.1; break;
        case 'cyber': fr = avg > 128 ? avg : avg * 0.2; fg = avg * 0.1; fb = avg > 128 ? avg * 0.2 : avg; break;
        case 'mono': fr = fg = fb = avg; break;
      }

      return {
        r: Math.max(0, Math.min(255, fr)),
        g: Math.max(0, Math.min(255, fg)),
        b: Math.max(0, Math.min(255, fb)),
        avg: Math.max(0, Math.min(255, avg))
      };
    };

    const frame: React.ReactNode[] = [];

    if (mode === 'pixel') {
      if (previewCanvasRef.current) {
        const pCanvas = previewCanvasRef.current;
        pCanvas.width = internalWidth;
        pCanvas.height = internalHeight;
        const pCtx = pCanvas.getContext('2d');
        if (pCtx) {
          const outData = pCtx.createImageData(internalWidth, internalHeight);
          for (let i = 0; i < pixels.length; i += 4) {
            const p = getProcessedPixel(pixels[i], pixels[i+1], pixels[i+2]);
            outData.data[i] = p.r;
            outData.data[i+1] = p.g;
            outData.data[i+2] = p.b;
            outData.data[i+3] = 255;
          }
          pCtx.putImageData(outData, 0, 0);
          setOutput([]); 
        }
      }
    } else {
      const frame: React.ReactNode[] = [];
      if (mode === 'braille') {
        for (let y = 0; y < internalHeight; y += 4) {
          const rowChars: React.ReactNode[] = [];
          for (let x = 0; x < internalWidth; x += 2) {
            let code = 0;
            let rTotal = 0, gTotal = 0, bTotal = 0, count = 0;
            const dotMap = [[0,0,1],[1,0,8],[0,1,2],[1,1,16],[0,2,4],[1,2,32],[0,3,64],[1,3,128]];
            for (const [dx, dy, bit] of dotMap) {
              const px = x + dx; const py = y + dy;
              if (px < internalWidth && py < internalHeight) {
                const i = (py * internalWidth + px) * 4;
                const p = getProcessedPixel(pixels[i], pixels[i+1], pixels[i+2]);
                const threshold = dithering ? (Math.random() * 255) : 128;
                if ((isInverted ? (255 - p.avg) : p.avg) > threshold) code |= bit;
                rTotal += p.r; gTotal += p.g; bTotal += p.b; count++;
              }
            }
            const char = String.fromCharCode(0x2800 + code);
            const color = useColor ? `rgb(${rTotal/count},${gTotal/count},${bTotal/count})` : undefined;
            rowChars.push(<span key={`${x}-${y}`} style={{ color }}>{char}</span>);
          }
          frame.push(<div key={`row-${y}`} className="leading-[1]">{rowChars}</div>);
        }
      } else if (mode === 'edge') {
        const getGray = (px: number, py: number) => {
          if (px < 0 || px >= internalWidth || py < 0 || py >= internalHeight) return 0;
          const i = (py * internalWidth + px) * 4;
          return (0.2126 * pixels[i] + 0.7152 * pixels[i+1] + 0.0722 * pixels[i+2]);
        };
        for (let y = 0; y < internalHeight; y++) {
          const rowChars: React.ReactNode[] = [];
          for (let x = 0; x < internalWidth; x++) {
            const gx = -1*getGray(x-1,y-1)+1*getGray(x+1,y-1)-2*getGray(x-1,y)+2*getGray(x+1,y)-1*getGray(x-1,y+1)+1*getGray(x+1,y+1);
            const gy = -1*getGray(x-1,y-1)-2*getGray(x,y-1)-1*getGray(x+1,y-1)+1*getGray(x-1,y+1)+2*getGray(x,y+1)+1*getGray(x+1,y+1);
            const mag = Math.sqrt(gx*gx + gy*gy);
            const angle = Math.atan2(gy, gx) * (180 / Math.PI);
            let char = ' ';
            if (mag > 40) {
              if (angle < 22.5 && angle > -22.5) char = '|';
              else if (angle < 67.5 && angle > 22.5) char = '/';
              else if (angle < 112.5 && angle > 67.5) char = '-';
              else if (angle < 157.5 && angle > 112.5) char = '\\';
              else if (angle < -157.5 || angle > 157.5) char = '|';
              else if (angle < -112.5 && angle > -157.5) char = '/';
              else if (angle < -67.5 && angle > -112.5) char = '-';
              else if (angle < -22.5 && angle > -67.5) char = '\\';
            }
            const i = (y * internalWidth + x) * 4;
            const p = getProcessedPixel(pixels[i], pixels[i+1], pixels[i+2]);
            rowChars.push(<span key={`${x}-${y}`} style={{ color: useColor ? `rgb(${p.r},${p.g},${p.b})` : undefined }}>{char}</span>);
          }
          frame.push(<div key={`row-${y}`} className="leading-[1]">{rowChars}</div>);
        }
      } else if (mode === 'ascii') {
        if (useColor) {
          for (let y = 0; y < internalHeight; y++) {
            const rowChars: React.ReactNode[] = [];
            for (let x = 0; x < internalWidth; x++) {
              const i = (y * internalWidth + x) * 4;
              const p = getProcessedPixel(pixels[i], pixels[i+1], pixels[i+2]);
              const brightnessVal = isInverted ? 1 - (p.avg / 255) : (p.avg / 255);
              const ditherFactor = dithering ? ((Math.random() - 0.5) * 0.2) : 0;
              const charIndex = Math.floor(Math.max(0, Math.min(1, 1 - brightnessVal + ditherFactor)) * (chars.length - 1));
              rowChars.push(<span key={`${x}-${y}`} style={{ color: `rgb(${p.r},${p.g},${p.b})` }}>{chars[charIndex] || ' '}</span>);
            }
            frame.push(<div key={`row-${y}`} className="leading-[1]">{rowChars}</div>);
          }
        } else {
          let textOutput = '';
          for (let y = 0; y < internalHeight; y++) {
            for (let x = 0; x < internalWidth; x++) {
              const i = (y * internalWidth + x) * 4;
              const p = getProcessedPixel(pixels[i], pixels[i+1], pixels[i+2]);
              const brightnessVal = isInverted ? 1 - (p.avg / 255) : (p.avg / 255);
              const ditherFactor = dithering ? ((Math.random() - 0.5) * 0.2) : 0;
              const charIndex = Math.floor(Math.max(0, Math.min(1, 1 - brightnessVal + ditherFactor)) * (chars.length - 1));
              textOutput += chars[charIndex] || ' ';
            }
            textOutput += '\n';
          }
          setOutput(textOutput);
          setIsProcessing(false);
          return;
        }
      }
      setOutput(frame);
    }

    setIsProcessing(false);
  }, [image, resolution, mode, charSet, customChars, useColor, contrast, brightness, isInverted, dithering, colorProfile]);

  // Debounced processing for static images
  useEffect(() => {
    const handler = setTimeout(() => {
      processImage();
    }, 150);
    return () => clearTimeout(handler);
  }, [processImage]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('INVALID_FILE: Only images accepted.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('SIZE_LIMIT: File too large (>5MB).');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Revoke Object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      // General cleanup if needed
    };
  }, []);

  // Auto-clear errors
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const copyToClipboard = () => {
    let text = '';
    if (typeof output === 'string') {
      text = output;
    } else if (Array.isArray(output)) {
      text = output.map(row => {
        if (React.isValidElement(row) && row.props.children) {
          const children = row.props.children;
          if (Array.isArray(children)) {
            return children.map(child => React.isValidElement(child) ? child.props.children : '').join('');
          }
        }
        return '';
      }).join('\n');
    }
    
    if (text) {
      navigator.clipboard.writeText(text);
    }
  };

  const buildOutputRows = () => {
    if (typeof output === 'string') {
      return output.split('\n').map((line) => ({ text: line }));
    }

    if (Array.isArray(output)) {
      return output.map((row) => {
        if (React.isValidElement(row) && row.props.children) {
          const children = Array.isArray(row.props.children)
            ? row.props.children
            : [row.props.children];

          const chars: string[] = [];
          const colors: string[] = [];

          for (const child of children) {
            if (React.isValidElement(child)) {
              const char = String(child.props.children ?? ' ');
              const color = child.props.style?.color as string | undefined;
              chars.push(char);
              colors.push(color || '#e5e7eb');
            } else {
              chars.push(String(child ?? ' '));
              colors.push('#e5e7eb');
            }
          }

          return { text: chars.join(''), colors };
        }

        return { text: '' };
      });
    }

    return [] as { text: string; colors?: string[] }[];
  };

  const downloadSVG = () => {
    let text = '';
    if (typeof output === 'string') {
      text = output;
    } else if (Array.isArray(output)) {
      text = output.map(row => {
        if (React.isValidElement(row) && row.props.children) {
          const children = row.props.children;
          if (Array.isArray(children)) {
            return children.map(child => React.isValidElement(child) ? child.props.children : '').join('');
          }
        }
        return '';
      }).join('\n');
    }

    const lines = text.split('\n');
    const svgWidth = lines[0]?.length * 6 || 600;
    const svgHeight = lines.length * 10 || 400;

    let svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" style="background: black;">`;
    svgData += `<text x="0" y="0" font-family="monospace" font-size="10" fill="#00ff41">`;
    lines.forEach((line, i) => {
      const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      svgData += `<tspan x="0" dy="10">${escaped}</tspan>`;
    });
    svgData += `</text></svg>`;

    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pixelized-${Date.now()}.svg`;
    link.click();
  };

  const downloadText = () => {
    let text = '';
    if (typeof output === 'string') {
      text = output;
    } else if (Array.isArray(output)) {
      text = output.map(row => {
        if (React.isValidElement(row) && row.props.children) {
          const children = row.props.children;
          if (Array.isArray(children)) {
            return children.map(child => React.isValidElement(child) ? child.props.children : '').join('');
          }
        }
        return '';
      }).join('\n');
    }

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pixelized-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadImage = () => {
    if (mode === 'pixel' && previewCanvasRef.current) {
      const source = previewCanvasRef.current;
      const scale = 6;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = source.width * scale;
      exportCanvas.height = source.height * scale;

      const exportCtx = exportCanvas.getContext('2d');
      if (!exportCtx) return;
      exportCtx.imageSmoothingEnabled = false;
      exportCtx.drawImage(source, 0, 0, exportCanvas.width, exportCanvas.height);

      const url = exportCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `pixelized-${Date.now()}.png`;
      link.click();
      return;
    }

    const rows = buildOutputRows();
    if (!rows.length) return;

    const exportCanvas = document.createElement('canvas');
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return;

    const padding = 24;
    exportCtx.font = `${fontSize}px "JetBrains Mono", monospace`;
    const charWidth = exportCtx.measureText('M').width || fontSize * 0.6;
    const lineHeight = Math.ceil(fontSize * 1.2);
    const maxLen = rows.reduce((max, row) => Math.max(max, row.text.length), 0);

    exportCanvas.width = Math.max(1, Math.ceil(maxLen * charWidth) + padding * 2);
    exportCanvas.height = Math.max(1, rows.length * lineHeight + padding * 2);

    exportCtx.fillStyle = '#020202';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.font = `${fontSize}px "JetBrains Mono", monospace`;
    exportCtx.textBaseline = 'top';

    rows.forEach((row, rowIndex) => {
      const y = padding + rowIndex * lineHeight;
      if (row.colors && row.colors.length === row.text.length) {
        for (let i = 0; i < row.text.length; i += 1) {
          exportCtx.fillStyle = row.colors[i] || '#e5e7eb';
          exportCtx.fillText(row.text[i], padding + i * charWidth, y);
        }
      } else {
        exportCtx.fillStyle = '#e5e7eb';
        exportCtx.fillText(row.text, padding, y);
      }
    });

    const url = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `pixelized-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="h-screen flex flex-col font-sans selection:bg-accent/30 selection:text-white bg-neutral-950 text-neutral-400 overflow-hidden">
      {/* Hidden Canvas for Processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Software Menu Bar */}
      <div className="h-9 border-b border-white/5 bg-neutral-900/50 backdrop-blur-xl flex items-center px-4 justify-between select-none z-[100]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-accent rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
            <span className="text-[11px] font-bold text-white tracking-widest uppercase">Pixelized</span>
          </div>
          <div className="flex gap-4 text-[11px] font-medium text-neutral-500">
            <button className="hover:text-white transition-colors">File</button>
            <button className="hover:text-white transition-colors">Edit</button>
            <button className="hover:text-white transition-colors font-semibold text-accent">Render</button>
            <button className="hover:text-white transition-colors">View</button>
            <button className="hover:text-white transition-colors">Help</button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest font-bold">
          <span className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded border border-white/5">
            <div className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            {isProcessing ? 'Engine Busy' : 'Engine Ready'}
          </span>
          <span className="opacity-40">{resolution}px // 2024.1.0</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbox */}
        <aside className="w-16 border-r border-white/5 flex flex-col items-center py-6 gap-6 bg-neutral-900/30 z-50">
          <button onClick={() => fileInputRef.current?.click()} className="group relative">
            <div className="p-3 bg-accent/20 text-accent rounded-2xl hover:bg-accent/30 transition-all border border-accent/20">
              <Upload size={20} />
            </div>
            <span className="absolute left-16 bg-neutral-800 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none uppercase tracking-widest">Import Asset</span>
          </button>
          
          <div className="w-8 h-[1px] bg-white/5 my-2" />
          
          {(['ascii', 'pixel', 'braille', 'edge'] as Mode[]).map((m) => (
            <button 
              key={m}
              onClick={() => setMode(m)} 
              className={`p-3 rounded-2xl transition-all group relative ${mode === m ? 'bg-white/10 text-white' : 'text-neutral-600 hover:text-neutral-400'}`}
            >
              {m === 'ascii' && <Type size={20} />}
              {m === 'pixel' && <LayoutGrid size={20} />}
              {m === 'braille' && <Activity size={20} />}
              {m === 'edge' && <Zap size={20} />}
              <span className="absolute left-16 bg-neutral-800 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none uppercase tracking-widest capitalize">{m} Mode</span>
            </button>
          ))}

          <div className="mt-auto pointer-events-none opacity-20">
            <Monitor size={20} />
          </div>
        </aside>

        {/* Main Workspace */}
        <section className="flex-1 flex flex-col relative group overflow-hidden bg-neutral-900/10">
          {isCrtEnabled && <div className="absolute inset-0 scanlines pointer-events-none opacity-40 z-20" />}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_transparent_0%,_black_95%)] opacity-40 z-10" />
          
          <div className="h-8 flex items-center px-6 justify-between select-none z-30 bg-neutral-950/20 shadow-sm">
             <div className="flex gap-1.5">
               <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/10" />
               <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/10" />
               <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/10" />
             </div>
             <span className="text-[10px] text-neutral-600 font-bold tracking-[0.3em] uppercase">Viewport Stage</span>
             <div className="flex gap-4">
               <button className="text-neutral-700 hover:text-neutral-400 transition-colors"><RefreshCcw size={14} /></button>
               <button className="text-neutral-700 hover:text-neutral-400 transition-colors"><Maximize2 size={14} /></button>
             </div>
          </div>
          
          <div className="flex-1 overflow-auto p-12 scroll-smooth z-0 relative flex items-start justify-center mono-grid" id="output-viewport">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-8 left-1/2 -translate-x-1/2 z-50 bg-red-950/90 border border-red-900 text-red-200 px-6 py-3 rounded-2xl text-[10px] font-bold tracking-[0.2em] shadow-2xl flex items-center gap-3 backdrop-blur-xl"
              >
                <Activity size={14} className="text-red-500" />
                {error}
                <button onClick={() => setError(null)} className="ml-4 hover:text-white underline">DISMISS</button>
              </motion.div>
            )}

            {image ? (
              <div className="min-w-fit mx-auto relative group/canvas">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${mode}-${charSet}-${resolution}-${useColor}-${customChars}-${isInverted}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="font-mono whitespace-pre inline-block select-all origin-top shadow-[0_40px_100px_rgba(0,0,0,0.8)] rounded-xl overflow-hidden"
                    style={{ 
                      fontSize: `${fontSize}px`,
                      lineHeight: mode === 'ascii' ? '1' : 'none',
                      letterSpacing: mode === 'ascii' ? '0.05em' : 'normal'
                    }}
                  >
                    {mode === 'pixel' ? (
                      <canvas 
                        ref={previewCanvasRef} 
                        className="pixel-render"
                        style={{ width: resolution * 6, height: resolution * aspectRatio * 6, maxWidth: '75vw' }}
                      />
                    ) : (
                      <div className="p-8 bg-[#020202]">
                        {output}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
                
                {/* Floating Studio Controls */}
                <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-1.5 glass-panel rounded-2xl shadow-2xl scale-110">
                   <button onClick={downloadText} className="glass-button !border-0 hover:!bg-white/10 h-10 px-6">TXT</button>
                   <div className="w-[1px] h-4 bg-white/10 mx-1" />
                   <button onClick={downloadImage} className="glass-button !border-0 hover:!bg-white/10 h-10 px-6">PNG</button>
                   <div className="w-[1px] h-4 bg-white/10 mx-1" />
                   <button onClick={downloadSVG} className="glass-button !border-0 hover:!bg-white/10 h-10 px-6">SVG</button>
                   <div className="w-10" />
                   <button 
                    onClick={copyToClipboard}
                    className="h-10 px-6 bg-accent text-white rounded-xl font-bold text-[10px] tracking-widest uppercase hover:bg-accent-hover transition-colors shadow-[0_10px_30px_rgba(59,130,246,0.3)] active:scale-95"
                  >
                    Export Result
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-8 text-neutral-800">
                <div className="w-40 h-40 rounded-[2.5rem] bg-neutral-900 border border-white/5 flex items-center justify-center shadow-inner group cursor-pointer hover:border-accent/40 transition-all" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon size={56} strokeWidth={0.5} className="group-hover:scale-110 transition-transform group-hover:text-neutral-500" />
                </div>
                <div className="text-center group" onClick={() => fileInputRef.current?.click()}>
                  <p className="text-[11px] font-bold tracking-[0.5em] uppercase text-neutral-600 transition-colors group-hover:text-accent">Studio Initialized</p>
                  <p className="text-[10px] mt-4 text-neutral-700 font-medium tracking-wide">Import graphical assets to begin encoding</p>
                </div>
              </div>
            )}
          </div>

          <footer className="h-7 border-t border-white/5 flex items-center px-6 justify-between z-30 bg-neutral-900/50 backdrop-blur-md select-none">
            <div className="flex items-center gap-6">
              <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" /> System State
              </span>
              <span className="text-[9px] font-mono text-neutral-600">FPS: 60 // RAM: 124MB // RES: {resolution}x{Math.floor(resolution * aspectRatio)}</span>
            </div>
            <div className="flex gap-4">
               <button onClick={() => setIsCrtEnabled(!isCrtEnabled)} className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${isCrtEnabled ? 'text-accent' : 'text-neutral-600 hover:text-neutral-400'}`}>CRT Filter</button>
               <button onClick={() => setIsInverted(!isInverted)} className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${isInverted ? 'text-accent' : 'text-neutral-600 hover:text-neutral-400'}`}>Inversion</button>
            </div>
          </footer>
        </section>

        {/* Right Inspector */}
        <aside className="w-72 border-l border-white/5 flex flex-col bg-neutral-950/20 backdrop-blur-2xl z-40 overflow-y-auto">
          <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white">Inspector</span>
          </div>

          <div className="p-6 space-y-8">
             {/* General Props */}
             <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Resolution</label>
                    <span className="text-[10px] font-mono text-accent">{resolution}px</span>
                  </div>
                  <input type="range" min="20" max="300" value={resolution} onChange={(e) => setResolution(parseInt(e.target.value))} className="w-full accent-accent" />
                </div>

                <div className="space-y-3">
                   <label className="block text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Color Grade</label>
                   <div className="grid grid-cols-3 gap-1.5">
                      {(['original', 'matrix', 'amber', 'cyber', 'mono'] as ColorProfile[]).map((profile) => (
                        <button
                          key={profile}
                          onClick={() => setColorProfile(profile)}
                          className={`py-2 text-[9px] border rounded-lg capitalize transition-all ${colorProfile === profile ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-white/[0.02] border-white/5 text-neutral-600 hover:text-neutral-400'}`}
                        >
                          {profile}
                        </button>
                      ))}
                   </div>
                </div>
             </div>

             <div className="h-[1px] bg-white/5" />

             {/* Rendering Options */}
             <div className="space-y-6">
                <div>
                  <label className="block text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-3">Visual Toggles</label>
                  <div className="space-y-3">
                     <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl border border-white/5">
                        <span className="text-[10px] text-neutral-400 uppercase font-medium">Bayer Dithering</span>
                        <button onClick={() => setDithering(!dithering)} className={`w-8 h-4 rounded-full relative transition-colors ${dithering ? 'bg-accent' : 'bg-neutral-800'}`}>
                           <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${dithering ? 'right-0.5' : 'left-0.5'}`} />
                        </button>
                     </div>
                     <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl border border-white/5">
                        <span className="text-[10px] text-neutral-400 uppercase font-medium">Native Color</span>
                        <button onClick={() => setUseColor(!useColor)} className={`w-8 h-4 rounded-full relative transition-colors ${useColor ? 'bg-accent' : 'bg-neutral-800'}`}>
                           <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${useColor ? 'right-0.5' : 'left-0.5'}`} />
                        </button>
                     </div>
                  </div>
                </div>

                {mode === 'ascii' && (
                  <div className="space-y-4">
                    <label className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Glyph Palette</label>
                    <input 
                      type="text" 
                      placeholder="Custom Glyph String..."
                      value={customChars}
                      onChange={(e) => setCustomChars(e.target.value)}
                      className="studio-input"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                       {Object.keys(CHARACTER_SETS).map((set) => (
                        <button
                          key={set}
                          onClick={() => { setCharSet(set as CharacterSetName); setCustomChars(''); }}
                          className={`py-2 text-[10px] border rounded-lg capitalize transition-all ${charSet === set && !customChars ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-white/[0.02] border-white/5 text-neutral-600 hover:text-neutral-400'}`}
                        >
                          {set}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
             </div>

             <div className="h-[1px] bg-white/5" />

             {/* Dynamic Props */}
             <div className="space-y-6">
                <div>
                   <div className="flex justify-between items-center mb-2">
                     <label className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Contrast</label>
                     <span className="text-[10px] font-mono text-accent">{Math.round(contrast * 100)}%</span>
                   </div>
                   <input type="range" min="0.5" max="2" step="0.1" value={contrast} onChange={(e) => setContrast(parseFloat(e.target.value))} className="w-full accent-accent" />
                </div>
                <div>
                   <div className="flex justify-between items-center mb-2">
                     <label className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Brightness</label>
                     <span className="text-[10px] font-mono text-accent">{Math.round(brightness * 100)}%</span>
                   </div>
                   <input type="range" min="0" max="2" step="0.1" value={brightness} onChange={(e) => setBrightness(parseFloat(e.target.value))} className="w-full accent-accent" />
                </div>
                <div>
                   <div className="flex justify-between items-center mb-2">
                     <label className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Glyph Size</label>
                     <span className="text-[10px] font-mono text-accent">{fontSize}px</span>
                   </div>
                   <input type="range" min="2" max="20" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="w-full accent-accent" />
                </div>
             </div>
          </div>

          <div className="mt-auto p-6 border-t border-white/5 bg-white/[0.01]">
             <button 
               onClick={() => { setImage(null); setOutput([]); }} 
               className="w-full py-3 glass-button !justify-center text-red-400/60 border-red-900/10 hover:!bg-red-500/5 hover:text-red-400"
             >
               <Eraser size={14} /> Reset Stage
             </button>
          </div>
        </aside>
      </div>

      <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
      {/* Bottom Command Bar */}
      <div className="h-7 bg-neutral-900 border-t border-white/5 text-[9px] font-bold text-neutral-600 px-6 flex items-center justify-between z-50 select-none">
        <div className="flex gap-8 tracking-widest uppercase items-center">
          <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-accent" /> ln 1, col 1</span>
          <span className="opacity-40 select-none">UTF-8</span>
          <span className="hover:text-neutral-400 cursor-pointer transition-colors flex items-center gap-1"><Terminal size={10} /> Terminal Access</span>
        </div>
        <div className="flex items-center gap-6 opacity-40 uppercase tracking-[0.2em]">
          <span>Pixelized Engine v.2024.1.B</span>
          <div className="flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-sm bg-neutral-800" />
             <div className="w-2 h-2 rounded-sm bg-neutral-700" />
             <div className="w-2 h-2 rounded-sm bg-neutral-600" />
          </div>
        </div>
      </div>
    </div>
  );
}
