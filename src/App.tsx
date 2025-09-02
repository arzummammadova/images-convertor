import React, { useState, useCallback, useRef } from 'react';
import { Upload, Download, Copy, FileImage, Settings, Zap, ArrowLeftRight, Image, Code } from 'lucide-react';

interface ConvertedFile {
  name: string;
  url: string;
  format: string;
}

type ConversionMode = 'svg-to-raster' | 'raster-to-svg';

function App() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [convertedFiles, setConvertedFiles] = useState<ConvertedFile[]>([]);
  const [extractedPaths, setExtractedPaths] = useState<string[]>([]);
  const [quality, setQuality] = useState<number>(1);
  const [width, setWidth] = useState<number>(800);
  const [height, setHeight] = useState<number>(600);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionMode, setConversionMode] = useState<ConversionMode>('svg-to-raster');
  const [svgTraceSettings, setSvgTraceSettings] = useState({
    threshold: 128,
    simplify: true,
    smoothing: 1
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSvgFile = (file: File) => {
    return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  };

  const isRasterFile = (file: File) => {
    return file.type.startsWith('image/') && !isSvgFile(file);
  };

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
    const imageFile = files.find(file => 
      file.type.startsWith('image/') || file.name.match(/\.(svg|png|jpe?g)$/i)
    );
    
    if (imageFile) {
      handleFileUpload(imageFile);
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setConvertedFiles([]);
    setExtractedPaths([]);

    if (isSvgFile(file)) {
      setConversionMode('svg-to-raster');
      const content = await file.text();
      setFileContent(content);
      extractPaths(content);
    } else if (isRasterFile(file)) {
      setConversionMode('raster-to-svg');
      const reader = new FileReader();
      reader.onload = (e) => {
        setFileContent(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
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

  const convertSvgToRaster = async (format: 'png' | 'jpeg') => {
    if (!fileContent || conversionMode !== 'svg-to-raster') return;
    
    setIsConverting(true);
    
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = width;
      canvas.height = height;

      const img = new Image();
      const svgBlob = new Blob([fileContent], { type: 'image/svg+xml' });
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
            const fileName = uploadedFile ? 
              uploadedFile.name.replace('.svg', `.${format}`) : 
              `converted.${format}`;
            
            setConvertedFiles(prev => [
              ...prev.filter(f => f.format !== format.toUpperCase()),
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

  const convertRasterToSvg = async () => {
    if (!fileContent || conversionMode !== 'raster-to-svg') return;
    
    setIsConverting(true);
    
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const svgContent = convertImageDataToSvg(imageData, canvas.width, canvas.height);
        
        const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
        const svgUrl = URL.createObjectURL(svgBlob);
        
        const fileName = uploadedFile ? 
          uploadedFile.name.replace(/\.(png|jpe?g)$/i, '.svg') : 
          'converted.svg';
        
        setConvertedFiles([{
          name: fileName,
          url: svgUrl,
          format: 'SVG'
        }]);
        
        extractPaths(svgContent);
        setIsConverting(false);
      };

      img.src = fileContent;
    } catch (error) {
      console.error('Conversion error:', error);
      setIsConverting(false);
    }
  };

  const convertImageDataToSvg = (imageData: ImageData, width: number, height: number): string => {
    const { data } = imageData;
    const threshold = svgTraceSettings.threshold;
    let svgPaths = '';
    
    // Simple edge detection and path generation
    const visited = new Set<string>();
    
    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < width; x += 4) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        
        const brightness = (r + g + b) / 3;
        
        if (brightness < threshold && a > 128) {
          const path = tracePath(x, y, imageData, width, height, threshold, visited);
          if (path.length > 10) {
            const color = `rgb(${r},${g},${b})`;
            svgPaths += `<path d="${path}" fill="${color}" opacity="${a/255}" />\n`;
          }
        }
      }
    }
    
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
${svgPaths}
</svg>`;
  };

  const tracePath = (startX: number, startY: number, imageData: ImageData, width: number, height: number, threshold: number, visited: Set<string>): string => {
    const points: Array<{x: number, y: number}> = [];
    const stack = [{x: startX, y: startY}];
    
    while (stack.length > 0 && points.length < 50) {
      const {x, y} = stack.pop()!;
      const key = `${x},${y}`;
      
      if (visited.has(key) || x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const index = (y * width + x) * 4;
      const r = imageData.data[index];
      const g = imageData.data[index + 1];
      const b = imageData.data[index + 2];
      const brightness = (r + g + b) / 3;
      
      if (brightness >= threshold) continue;
      
      visited.add(key);
      points.push({x, y});
      
      // Add neighboring points
      for (let dx = -4; dx <= 4; dx += 4) {
        for (let dy = -4; dy <= 4; dy += 4) {
          if (dx === 0 && dy === 0) continue;
          stack.push({x: x + dx, y: y + dy});
        }
      }
    }
    
    if (points.length < 3) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    path += ' Z';
    
    return path;
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

  const getAcceptedFormats = () => {
    return conversionMode === 'svg-to-raster' 
      ? '.svg,image/svg+xml'
      : '.png,.jpg,.jpeg,image/png,image/jpeg';
  };

  const getUploadText = () => {
    return conversionMode === 'svg-to-raster'
      ? 'SVG dosyasını buraya sürükleyin'
      : 'PNG/JPEG dosyasını buraya sürükleyin';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-full mr-4">
              <Zap className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white">Format Çevirici</h1>
          </div>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto">
            SVG ↔ PNG/JPEG çift yönlü format çevirici ve path çıkartıcı
          </p>
        </div>

        {/* Conversion Mode Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-2xl p-2 shadow-xl">
            <div className="flex">
              <button
                onClick={() => {
                  setConversionMode('svg-to-raster');
                  setUploadedFile(null);
                  setFileContent('');
                  setConvertedFiles([]);
                  setExtractedPaths([]);
                }}
                className={`flex items-center px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                  conversionMode === 'svg-to-raster'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Code className="h-5 w-5 mr-2" />
                SVG → PNG/JPEG
              </button>
              <button
                onClick={() => {
                  setConversionMode('raster-to-svg');
                  setUploadedFile(null);
                  setFileContent('');
                  setConvertedFiles([]);
                  setExtractedPaths([]);
                }}
                className={`flex items-center px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                  conversionMode === 'raster-to-svg'
                    ? 'bg-gradient-to-r from-green-500 to-teal-600 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Image className="h-5 w-5 mr-2" />
                PNG/JPEG → SVG
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className={`p-6 ${
                conversionMode === 'svg-to-raster' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600'
                  : 'bg-gradient-to-r from-green-500 to-teal-600'
              }`}>
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <Upload className="mr-3 h-6 w-6" />
                  Dosya Yükle
                </h2>
              </div>
              
              <div className="p-8">
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${
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
                    {getUploadText()}
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    veya dosya seçmek için tıklayın
                  </p>
                  <div className="flex items-center justify-center">
                    <ArrowLeftRight className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">
                      {conversionMode === 'svg-to-raster' ? 'SVG → PNG/JPEG' : 'PNG/JPEG → SVG'}
                    </span>
                  </div>
                  <button className={`mt-4 text-white px-6 py-2 rounded-lg transition-colors ${
                    conversionMode === 'svg-to-raster'
                      ? 'bg-blue-500 hover:bg-blue-600'
                      : 'bg-green-500 hover:bg-green-600'
                  }`}>
                    Dosya Seç
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={getAcceptedFormats()}
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Settings */}
            {uploadedFile && (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className={`p-6 ${
                  conversionMode === 'svg-to-raster'
                    ? 'bg-gradient-to-r from-indigo-500 to-blue-600'
                    : 'bg-gradient-to-r from-orange-500 to-red-600'
                }`}>
                  <h2 className="text-2xl font-semibold text-white flex items-center">
                    <Settings className="mr-3 h-6 w-6" />
                    Ayarlar
                  </h2>
                </div>
                
                <div className="p-6 space-y-6">
                  {conversionMode === 'svg-to-raster' ? (
                    <>
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
                          onClick={() => convertSvgToRaster('png')}
                          disabled={isConverting}
                          className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors font-medium"
                        >
                          {isConverting ? 'Çevriliyor...' : 'PNG\'ye Çevir'}
                        </button>
                        <button
                          onClick={() => convertSvgToRaster('jpeg')}
                          disabled={isConverting}
                          className="flex-1 bg-purple-500 text-white py-3 px-4 rounded-lg hover:bg-purple-600 disabled:bg-gray-400 transition-colors font-medium"
                        >
                          {isConverting ? 'Çevriliyor...' : 'JPEG\'e Çevir'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Eşik Değeri: {svgTraceSettings.threshold}
                        </label>
                        <input
                          type="range"
                          min="50"
                          max="200"
                          value={svgTraceSettings.threshold}
                          onChange={(e) => setSvgTraceSettings(prev => ({
                            ...prev,
                            threshold: Number(e.target.value)
                          }))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Düşük değer daha fazla detay, yüksek değer daha basit şekiller
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Yumuşatma: {svgTraceSettings.smoothing}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="3"
                          step="0.5"
                          value={svgTraceSettings.smoothing}
                          onChange={(e) => setSvgTraceSettings(prev => ({
                            ...prev,
                            smoothing: Number(e.target.value)
                          }))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      <button
                        onClick={convertRasterToSvg}
                        disabled={isConverting}
                        className="w-full bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition-colors font-medium"
                      >
                        {isConverting ? 'SVG\'ye Çevriliyor...' : 'SVG\'ye Çevir'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Preview and Results Section */}
          <div className="space-y-6">
            {/* File Preview */}
            {fileContent && (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className={`p-6 ${
                  conversionMode === 'svg-to-raster'
                    ? 'bg-gradient-to-r from-indigo-500 to-blue-600'
                    : 'bg-gradient-to-r from-emerald-500 to-green-600'
                }`}>
                  <h2 className="text-2xl font-semibold text-white">
                    {conversionMode === 'svg-to-raster' ? 'SVG Önizleme' : 'Resim Önizleme'}
                  </h2>
                </div>
                
                <div className="p-6">
                  <div className="border rounded-lg p-4 bg-gray-50 flex items-center justify-center min-h-[200px]">
                    {conversionMode === 'svg-to-raster' ? (
                      <div dangerouslySetInnerHTML={{ __html: fileContent }} />
                    ) : (
                      <img 
                        src={fileContent} 
                        alt="Preview" 
                        className="max-w-full max-h-[300px] object-contain"
                      />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-2 text-center">
                    {uploadedFile?.name}
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

        {/* Info Section */}
        <div className="mt-12 bg-white/10 backdrop-blur-sm rounded-2xl p-8">
          <h3 className="text-2xl font-bold text-white mb-4 text-center">Özellikler</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="text-center">
              <div className="bg-blue-500/20 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <ArrowLeftRight className="h-8 w-8 text-blue-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Çift Yönlü Çevirme</h4>
              <p className="text-slate-300">SVG'den PNG/JPEG'e ve PNG/JPEG'den SVG'ye çevirme</p>
            </div>
            <div className="text-center">
              <div className="bg-purple-500/20 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Code className="h-8 w-8 text-purple-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Path Çıkartma</h4>
              <p className="text-slate-300">SVG path verilerini çıkart ve kopyala</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;