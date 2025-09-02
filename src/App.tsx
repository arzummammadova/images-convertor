import React, { useState, useCallback, useRef } from 'react';
import { Upload, Download, Copy, FileImage, Settings, Zap } from 'lucide-react';

interface ConvertedFile {
  name: string;
  url: string;
  format: string;
}

function App() {
  const [svgFile, setSvgFile] = useState<File | null>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [convertedFiles, setConvertedFiles] = useState<ConvertedFile[]>([]);
  const [extractedPaths, setExtractedPaths] = useState<string[]>([]);
  const [quality, setQuality] = useState<number>(1);
  const [width, setWidth] = useState<number>(800);
  const [height, setHeight] = useState<number>(600);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const svgFile = files.find(file => file.type === 'image/svg+xml' || file.name.endsWith('.svg'));
    
    if (svgFile) {
      handleFileUpload(svgFile);
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    setSvgFile(file);
    const content = await file.text();
    setSvgContent(content);
    extractPaths(content);
    setConvertedFiles([]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const extractPaths = (svgContent: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const paths = Array.from(doc.querySelectorAll('path'));
    const pathData = paths.map(path => path.getAttribute('d')).filter(Boolean) as string[];
    setExtractedPaths(pathData);
  };

  const convertToFormat = async (format: 'png' | 'jpeg') => {
    if (!svgContent) return;
    
    setIsConverting(true);
    
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = width;
      canvas.height = height;

      const img = new Image();
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        if (format === 'jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob((blob) => {
          if (blob) {
            const convertedUrl = URL.createObjectURL(blob);
            const fileName = svgFile ? 
              svgFile.name.replace('.svg', `.${format}`) : 
              `converted.${format}`;
            
            setConvertedFiles(prev => [
              ...prev.filter(f => f.format !== format),
              {
                name: fileName,
                url: convertedUrl,
                format: format.toUpperCase()
              }
            ]);
          }
          setIsConverting(false);
        }, mimeType, quality);
        
        URL.revokeObjectURL(url);
      };

      img.src = url;
    } catch (error) {
      console.error('Conversion error:', error);
      setIsConverting(false);
    }
  };

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-blue-500 p-3 rounded-full mr-4">
              <Zap className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white">SVG Çevirici</h1>
          </div>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto">
            SVG dosyalarınızı PNG/JPEG formatlarına çevirin ve path verilerini çıkartın
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-blue-500 to-purple-600">
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <Upload className="mr-3 h-6 w-6" />
                  Dosya Yükle
                </h2>
              </div>
              
              <div className="p-8">
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
                    isDragging 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileImage className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    SVG dosyasını buraya sürükleyin
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    veya dosya seçmek için tıklayın
                  </p>
                  <button className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                    Dosya Seç
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".svg,image/svg+xml"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Settings */}
            {svgFile && (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-green-500 to-teal-600">
                  <h2 className="text-2xl font-semibold text-white flex items-center">
                    <Settings className="mr-3 h-6 w-6" />
                    Ayarlar
                  </h2>
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Genişlik (px)
                      </label>
                      <input
                        type="number"
                        value={width}
                        onChange={(e) => setWidth(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Yükseklik (px)
                      </label>
                      <input
                        type="number"
                        value={height}
                        onChange={(e) => setHeight(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kalite: {Math.round(quality * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={quality}
                      onChange={(e) => setQuality(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => convertToFormat('png')}
                      disabled={isConverting}
                      className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors font-medium"
                    >
                      {isConverting ? 'Çevriliyor...' : 'PNG\'ye Çevir'}
                    </button>
                    <button
                      onClick={() => convertToFormat('jpeg')}
                      disabled={isConverting}
                      className="flex-1 bg-purple-500 text-white py-3 px-4 rounded-lg hover:bg-purple-600 disabled:bg-gray-400 transition-colors font-medium"
                    >
                      {isConverting ? 'Çevriliyor...' : 'JPEG\'e Çevir'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Preview and Results Section */}
          <div className="space-y-6">
            {/* SVG Preview */}
            {svgContent && (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-indigo-500 to-blue-600">
                  <h2 className="text-2xl font-semibold text-white">
                    SVG Önizleme
                  </h2>
                </div>
                
                <div className="p-6">
                  <div 
                    className="border rounded-lg p-4 bg-gray-50 flex items-center justify-center min-h-[200px]"
                    dangerouslySetInnerHTML={{ __html: svgContent }}
                  />
                  <p className="text-sm text-gray-600 mt-2 text-center">
                    {svgFile?.name}
                  </p>
                </div>
              </div>
            )}

            {/* Converted Files */}
            {convertedFiles.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-green-500 to-emerald-600">
                  <h2 className="text-2xl font-semibold text-white flex items-center">
                    <Download className="mr-3 h-6 w-6" />
                    Çevrilmiş Dosyalar
                  </h2>
                </div>
                
                <div className="p-6 space-y-3">
                  {convertedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <FileImage className="h-8 w-8 text-gray-400 mr-3" />
                        <div>
                          <p className="font-medium text-gray-900">{file.name}</p>
                          <p className="text-sm text-gray-500">{file.format}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => downloadFile(file.url, file.name)}
                        className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        İndir
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SVG Paths */}
            {extractedPaths.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-orange-500 to-red-600">
                  <h2 className="text-2xl font-semibold text-white flex items-center">
                    <Copy className="mr-3 h-6 w-6" />
                    SVG Path'leri ({extractedPaths.length})
                  </h2>
                </div>
                
                <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
                  {extractedPaths.map((path, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <code className="text-sm font-mono text-gray-700 flex-1 mr-4 break-all">
                          {path.substring(0, 100)}{path.length > 100 ? '...' : ''}
                        </code>
                        <button
                          onClick={() => copyPath(path)}
                          className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 transition-colors flex items-center text-sm"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Kopyala
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;