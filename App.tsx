import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { generateModelImage, determineModelGender, generateAdsCopy, generateSpeech, generateAdImages, generateVideo, generateCaptionAndHashtags, regenerateAdImage } from './services/geminiService';
import type { ImageFile } from './types';
import { LoadingSpinner, DownloadIcon } from './components/ui';

// --- HELPER FUNCTIONS ---

const fileToImageFile = (file: File): Promise<ImageFile> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            const parts = result.split(',');
            if (parts.length !== 2) return reject(new Error("Invalid data URL"));
            const mimeType = parts[0].match(/:(.*?);/)?.[1];
            if (!mimeType) return reject(new Error("Could not determine mime type"));
            resolve({ data: parts[1], mimeType, previewUrl: result });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const imageUrlToImageFile = (imageUrl: string): ImageFile => {
    const parts = imageUrl.split(',');
    if (parts.length !== 2) throw new Error("Invalid data URL");
    const mimeType = parts[0].match(/:(.*?);/)?.[1];
    if (!mimeType) throw new Error("Could not determine mime type");
    return { data: parts[1], mimeType, previewUrl: imageUrl };
};

// --- UI COMPONENTS ---

const Header: React.FC = () => (
    <header className="bg-slate-800 border-b border-slate-700">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-lg flex-shrink-0"></div>
            <h1 className="text-2xl font-bold text-slate-200 tracking-tight">
                STUDIO IKLAN <a href="https://markasai.com/vidabot" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">VIDABOT</a>
            </h1>
        </div>
    </header>
);

const Stepper: React.FC<{ currentStep: number }> = ({ currentStep }) => {
    const steps = ["Produk", "Model Iklan", "Ads Copy", "Studio Iklan", "Finishing"];
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <ol className="flex items-center w-full">
                {steps.map((label, index) => {
                    const stepNumber = index + 1;
                    const isCompleted = currentStep > stepNumber;
                    const isCurrent = currentStep === stepNumber;
                    return (
                        <li key={label} className={`flex w-full items-center ${stepNumber < steps.length ? "after:content-[''] after:w-full after:h-1 after:border-b after:border-4 after:inline-block" : ""} ${isCompleted ? 'after:border-orange-500' : 'after:border-slate-700'}`}>
                            <div className="flex flex-col items-center justify-center">
                                <span className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${isCurrent || isCompleted ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                    {isCompleted ? (
                                        <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 12"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 5.917 5.724 10.5 15 1.5" /></svg>
                                    ) : (
                                        stepNumber
                                    )}
                                </span>
                                <span className={`mt-2 text-sm font-medium ${isCurrent ? 'text-orange-400' : 'text-slate-400'}`}>{label}</span>
                            </div>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
};

const StepCard: React.FC<{ children: React.ReactNode, title: string }> = ({ children, title }) => (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-slate-200 mb-6">{title}</h2>
        <div className="space-y-6">
            {children}
        </div>
    </div>
);

const ImageUpload: React.FC<{ onUpload: (file: File) => void; currentImage: ImageFile | null; label: string; }> = ({ onUpload, currentImage, label }) => (
    <div>
        <label className="block text-sm font-medium text-slate-200 mb-2">{label}</label>
        <div className="relative w-full h-64 bg-slate-700/50 border-2 border-dashed border-slate-600 rounded-lg flex items-center justify-center hover:border-orange-500 transition-colors">
            <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => e.target.files && onUpload(e.target.files[0])} accept="image/*" aria-label={`Upload ${label}`} />
            {currentImage ? <img src={currentImage.previewUrl} alt="Preview" className="object-contain w-full h-full rounded-lg p-1" /> : <span className="text-slate-500">+ Add Image</span>}
        </div>
    </div>
);

// --- STEP COMPONENTS ---

const Step1Product: React.FC<{
    product: { name: string; description: string; image: ImageFile | null };
    setProduct: React.Dispatch<React.SetStateAction<any>>;
    onNext: () => void;
}> = ({ product, setProduct, onNext }) => {
    const [error, setError] = useState<string | null>(null);

    const handleNext = () => {
        if (!product.image || !product.name.trim()) {
            setError("Please upload a product photo and enter a product name.");
            return;
        }
        setError(null);
        onNext();
    };

    const handleImageUpload = async (file: File) => {
        try {
            const imageFile = await fileToImageFile(file);
            setProduct(p => ({ ...p, image: imageFile }));
        } catch (err) {
            setError("Failed to load image.");
        }
    };

    return (
        <StepCard title="Step 1: Detail Produk">
            <ImageUpload label="Foto Produk" currentImage={product.image} onUpload={handleImageUpload} />
            <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Nama Produk</label>
                <input
                    type="text"
                    value={product.name}
                    onChange={e => setProduct(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Organic Honey Serum"
                    className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Deskripsi Singkat (Opsional)</label>
                <textarea
                    value={product.description}
                    onChange={e => setProduct(p => ({ ...p, description: e.target.value }))}
                    placeholder="e.g., A nourishing face serum for glowing skin."
                    rows={3}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={handleNext} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md">Next</button>
        </StepCard>
    );
};

const Step2Model: React.FC<{
    productImage: ImageFile;
    productName: string;
    productDescription: string;
    model: { source: 'manual' | 'ai'; image: ImageFile | null; description: string; };
    setModel: React.Dispatch<React.SetStateAction<any>>;
    onNext: () => void;
    onBack: () => void;
}> = ({ productImage, productName, productDescription, model, setModel, onNext, onBack }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerateAIModel = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const imageUrl = await generateModelImage(productImage, productName, productDescription, model.description);
            setModel(m => ({ ...m, image: imageUrlToImageFile(imageUrl) }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate model.');
        } finally {
            setIsLoading(false);
        }
    }, [productImage, productName, productDescription, model.description, setModel]);

    const handleManualUpload = async (file: File) => {
        try {
            const imageFile = await fileToImageFile(file);
            setModel(m => ({ ...m, image: imageFile }));
        } catch (err) {
            setError("Failed to load image.");
        }
    };

    const handleNext = () => {
        if (!model.image) {
            setError("Please provide a model image.");
            return;
        }
        onNext();
    };

    return (
        <StepCard title="Step 2: Model Iklan">
            <div className="text-center">
                <img src={productImage.previewUrl} alt="Product" className="max-h-40 mx-auto rounded-lg" />
                <p className="font-bold mt-2">{productName}</p>
            </div>
            <div className="flex justify-center space-x-4">
                {(['ai', 'manual'] as const).map(source => (
                    <button
                        key={source}
                        onClick={() => setModel(m => ({ ...m, source }))}
                        className={`px-6 py-2 rounded-full font-semibold transition-colors ${model.source === source ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                    >
                        {source === 'ai' ? 'Rekomendasi AI' : 'Upload Manual'}
                    </button>
                ))}
            </div>

            {model.source === 'ai' && (
                <div className="text-center space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-slate-200 mb-2 text-left">Jelaskan model yang Anda inginkan (Opsional)</label>
                        <textarea
                            value={model.description}
                            onChange={e => setModel(m => ({ ...m, description: e.target.value }))}
                            placeholder="Contoh: Pria Kaukasia, rambut pirang, tersenyum, mengenakan kemeja biru."
                            rows={2}
                            className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                        />
                    </div>

                    {isLoading ? <LoadingSpinner message="Generating AI model..." /> : model.image ? (
                        <img src={model.image.previewUrl} alt="AI Model" className="max-h-64 mx-auto rounded-lg" />
                    ) : <div className="h-64 flex items-center justify-center text-slate-500">Pratinjau model akan muncul di sini</div>}
                    <button onClick={handleGenerateAIModel} disabled={isLoading} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">
                        {isLoading ? 'Generating...' : model.image ? 'Regenerate' : 'Generate'}
                    </button>
                </div>
            )}

            {model.source === 'manual' && (
                <ImageUpload label="Foto Model" currentImage={model.image} onUpload={handleManualUpload} />
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex space-x-4">
                <button onClick={onBack} className="w-full bg-slate-600 hover:bg-slate-500 text-slate-200 font-bold py-3 px-4 rounded-lg transition-colors">Back</button>
                <button onClick={handleNext} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md">Next</button>
            </div>
        </StepCard>
    );
};

const Step3AdsCopy: React.FC<{
    productName: string;
    productDescription: string;
    modelImage: ImageFile;
    adsCopy: { script: string; audioUrl: string | null; voiceGender: 'male' | 'female'; voiceStyle: string; };
    setAdsCopy: React.Dispatch<React.SetStateAction<any>>;
    onNext: () => void;
    onBack: () => void;
}> = ({ productName, productDescription, modelImage, adsCopy, setAdsCopy, onNext, onBack }) => {
    const [isLoading, setIsLoading] = useState<'script' | 'audio' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState('');

    useEffect(() => {
        // Auto-detect gender when model image changes
        if(modelImage) {
            determineModelGender(modelImage).then(gender => {
                setAdsCopy(ac => ({ ...ac, voiceGender: gender }));
            });
        }
    }, [modelImage, setAdsCopy]);

    const handleGenerateScript = useCallback(async () => {
        setIsLoading('script');
        setError(null);
        setAdsCopy(ac => ({ ...ac, script: '', audioUrl: null }));
        try {
            setLoadingMessage('Menulis naskah iklan...');
            const script = await generateAdsCopy(productName, productDescription);
            setAdsCopy(ac => ({ ...ac, script }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal membuat naskah.');
        } finally {
            setIsLoading(null);
        }
    }, [productName, productDescription, setAdsCopy]);
    
    const handleGenerateAudio = useCallback(async () => {
        if (!adsCopy.script) {
            setError("Naskah tidak boleh kosong.");
            return;
        }
        setIsLoading('audio');
        setError(null);
        setAdsCopy(ac => ({ ...ac, audioUrl: null }));
        try {
            const voiceName = adsCopy.voiceGender === 'male' ? 'Puck' : 'Kore';
            const audioUrl = await generateSpeech(adsCopy.script, voiceName, adsCopy.voiceStyle, setLoadingMessage);
            setAdsCopy(ac => ({ ...ac, audioUrl }));
        } catch(err) {
            setError(err instanceof Error ? err.message : 'Gagal membuat audio.');
        } finally {
            setIsLoading(null);
            setLoadingMessage('');
        }
    }, [adsCopy.script, adsCopy.voiceGender, adsCopy.voiceStyle, setAdsCopy]);


    const handleNext = () => {
        if (!adsCopy.script || !adsCopy.audioUrl) {
            setError("Harap buat naskah dan audio terlebih dahulu.");
            return;
        }
        onNext();
    };

    return (
        <StepCard title="Step 3: Ads Copy">
            <button onClick={handleGenerateScript} disabled={!!isLoading} className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 transition-colors shadow-md">
                {isLoading === 'script' ? 'Menulis...' : adsCopy.script ? 'Buat Ulang Naskah' : 'Buat Naskah Iklan'}
            </button>

            {isLoading === 'script' && <LoadingSpinner message={loadingMessage} />}
            
            {adsCopy.script && (
                <div className="space-y-4 border-t border-slate-700 pt-4">
                     <div>
                        <label className="block text-sm font-medium text-slate-200 mb-2">Naskah Iklan (bisa diedit)</label>
                        <textarea
                            value={adsCopy.script}
                            onChange={e => setAdsCopy(ac => ({ ...ac, script: e.target.value }))}
                            rows={5}
                            className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-200 mb-2">Suara</label>
                            <select value={adsCopy.voiceGender} onChange={e => setAdsCopy(ac => ({...ac, voiceGender: e.target.value as 'male' | 'female'}))} className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500">
                                <option value="female">Wanita</option>
                                <option value="male">Pria</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-200 mb-2">Gaya Bicara</label>
                            <select value={adsCopy.voiceStyle} onChange={e => setAdsCopy(ac => ({...ac, voiceStyle: e.target.value}))} className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500">
                                <option value="santai">Santai</option>
                                <option value="enerjik">Enerjik</option>
                                <option value="profesional">Profesional</option>
                            </select>
                        </div>
                    </div>
                     <button onClick={handleGenerateAudio} disabled={!!isLoading} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 transition-colors shadow-md">
                        {isLoading === 'audio' ? 'Merekam...' : 'Buat Audio'}
                    </button>
                    {isLoading === 'audio' && <LoadingSpinner message={loadingMessage} />}
                    {adsCopy.audioUrl && (
                        <div>
                            <h3 className="font-semibold mb-2 text-slate-300">Hasil Audio:</h3>
                            <audio controls src={adsCopy.audioUrl} className="w-full" />
                        </div>
                    )}
                </div>
            )}
            
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex space-x-4 pt-4 border-t border-slate-700">
                <button onClick={onBack} className="w-full bg-slate-600 hover:bg-slate-500 text-slate-200 font-bold py-3 px-4 rounded-lg transition-colors">Back</button>
                <button onClick={handleNext} disabled={!adsCopy.audioUrl} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
            </div>
        </StepCard>
    );
};

const Step4Studio: React.FC<{
    modelImage: ImageFile;
    productImage: ImageFile;
    productName: string;
    productDescription: string;
    adsCopyScript: string;
    studio: { adImages: string[], adVideos: string[] };
    setStudio: React.Dispatch<React.SetStateAction<any>>;
    onNext: () => void;
    onBack: () => void;
}> = ({ modelImage, productImage, productName, productDescription, adsCopyScript, studio, setStudio, onNext, onBack }) => {
    const [isLoading, setIsLoading] = useState<'images' | 'videos' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [regeneratingImageIndex, setRegeneratingImageIndex] = useState<number | null>(null);
    const [regeneratingVideoIndex, setRegeneratingVideoIndex] = useState<number | null>(null);
    const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(null);

    const getVideoPrompts = useMemo(() => [
        `Animate this image into a photorealistic video. The camera should subtly zoom in on the product as the person interacts with it for the first time. The person's movements should be natural and curious, focusing entirely on the product in their hands. They must NOT speak or look at the camera. The video should feel like an authentic 'unboxing' moment.`,
        `Create a cinematic, close-up video from this image, focusing on the product being actively used, worn, or consumed by the person. The animation should be smooth and realistic, highlighting the product's texture and function. The person's expression should show genuine satisfaction, but their face is not the main focus. They must NOT speak or look at the camera. The shot should feel like a high-quality product demonstration.`,
        `Animate this image into a beautiful 'hero shot' video. The person holds the product up, and the camera performs a slow, elegant pan or subtle rotation to showcase the product from a flattering angle. The person's expression should be confident and happy, but their gaze should be on the product, not the camera. They must NOT speak. The final shot should make the product look incredibly appealing.`
    ], []);

    const adImagePrompts = useMemo(() => [
        `Generate a photorealistic, 9:16 UGC-style image of the **exact same person** from the model image, wearing the **exact same outfit**. The model is holding the **exact same product** ("${productName}") for the first time, looking excited and curious. This shot should match the ad script's hook: "${adsCopyScript}". The setting must be a realistic, everyday environment. IMPORTANT: The product MUST be clearly visible and held by the model. No text/logos. Person, outfit, and product must be identical to the inputs.`,
        `Generate the second ad frame, a photorealistic, 9:16 UGC-style image. The **exact same person** (in the **same outfit**) is now actively **using, wearing, or consuming** the **exact same product** ("${productName}"). Their face should show genuine happiness and satisfaction, illustrating the product's benefits from the ad script: "${adsCopyScript}". The focus is on the positive experience of the model using the product. The setting must be logical for the product's use. IMPORTANT: No text/logos. Person, outfit, and product must be identical.`,
        `Generate the final ad frame, a photorealistic, 9:16 UGC-style image. The **exact same person** (in the **same outfit**) is happily holding and showing the **exact same product** ("${productName}") towards the camera, as if recommending it to a friend. They should look confident and satisfied, matching the call-to-action part of the script: "${adsCopyScript}". The product is the hero of the shot. IMPORTANT: No text/logos. Person, outfit, and product must be identical.`
    ], [productName, adsCopyScript]);

    const handleGenerateImages = useCallback(async () => {
        setIsLoading('images');
        setError(null);
        setStudio({ adImages: [], adVideos: [] });
        try {
            setLoadingMessage('Membuat adegan iklan sesuai naskah...');
            const images = await generateAdImages(modelImage, productImage, adsCopyScript, productName, productDescription);
            setStudio(s => ({ ...s, adImages: images }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal membuat gambar.');
        } finally {
            setIsLoading(null);
        }
    }, [modelImage, productImage, adsCopyScript, productName, productDescription, setStudio]);

    const handleRegenerateImage = useCallback(async (indexToRegen: number) => {
        setRegeneratingImageIndex(indexToRegen);
        setError(null);
        try {
            const prompt = adImagePrompts[indexToRegen];
            const newImageUrl = await regenerateAdImage(modelImage, productImage, prompt);
            setStudio(s => {
                const newAdImages = [...s.adImages];
                newAdImages[indexToRegen] = newImageUrl;
                return { ...s, adImages: newAdImages, adVideos: [] }; // Reset videos
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal membuat ulang gambar.');
        } finally {
            setRegeneratingImageIndex(null);
        }
    }, [modelImage, productImage, adImagePrompts, setStudio]);

    const handleGenerateVideos = useCallback(async () => {
        if (studio.adImages.length === 0) {
            setError("Buat gambar terlebih dahulu.");
            return;
        }
        setIsLoading('videos');
        setError(null);
        setStudio(s => ({ ...s, adVideos: [] }));
        try {
            const generatedVideos: string[] = [];
            for (let i = 0; i < studio.adImages.length; i++) {
                const imageFile = imageUrlToImageFile(studio.adImages[i]);
                const prompt = getVideoPrompts[i % getVideoPrompts.length];
                const videoUrl = await generateVideo(prompt, imageFile, (msg) => setLoadingMessage(`Video ${i+1}/3: ${msg}`));
                generatedVideos.push(videoUrl);
                setStudio(s => ({ ...s, adImages: s.adImages, adVideos: [...generatedVideos] }));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal membuat video.');
        } finally {
            setIsLoading(null);
        }
    }, [studio.adImages, setStudio, getVideoPrompts]);
    
    const handleStartVideoGeneration = () => {
        if (studio.adImages.length === 0) {
            setError("Buat gambar terlebih dahulu.");
            return;
        }
        // Directly start video generation (license gating removed)
        handleGenerateVideos();
    };

    const handleRegenerateVideo = useCallback(async (indexToRegen: number) => {
        setRegeneratingVideoIndex(indexToRegen);
        setError(null);
        try {
            const imageFile = imageUrlToImageFile(studio.adImages[indexToRegen]);
            const prompt = getVideoPrompts[indexToRegen % getVideoPrompts.length];
            const videoUrl = await generateVideo(prompt, imageFile, (msg) => setLoadingMessage(`Regenerating Video ${indexToRegen + 1}/3: ${msg}`));

            setStudio(s => {
                const newAdVideos = [...s.adVideos];
                newAdVideos[indexToRegen] = videoUrl;
                return { ...s, adVideos: newAdVideos };
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal membuat ulang video.');
        } finally {
            setRegeneratingVideoIndex(null);
        }
    }, [studio.adImages, setStudio, getVideoPrompts]);

    const handleCopyPrompt = (promptToCopy: string, index: number) => {
        navigator.clipboard.writeText(promptToCopy).then(() => {
            setCopiedPromptIndex(index);
            setTimeout(() => setCopiedPromptIndex(null), 2000);
        }).catch(err => {
            console.error('Failed to copy prompt: ', err);
        });
    };


    const handleNext = () => {
        if (studio.adVideos.length < 3) {
            setError("Harap buat ke-3 video terlebih dahulu.");
            return;
        }
        onNext();
    };

    const isBusy = !!isLoading || regeneratingImageIndex !== null || regeneratingVideoIndex !== null;

    return (
        <StepCard title="Step 4: Studio Iklan">
            <div className="text-center">
                <button onClick={handleGenerateImages} disabled={isBusy} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 transition-colors shadow-md">
                    {isLoading === 'images' ? 'Membuat Adegan...' : studio.adImages.length > 0 ? 'Buat Ulang 3 Adegan' : 'Buat 3 Adegan Iklan'}
                </button>
            </div>
            {isLoading === 'images' && <LoadingSpinner message={loadingMessage} />}
            {studio.adImages.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {studio.adImages.map((src, i) => 
                        <div key={i} className="space-y-2">
                            {regeneratingImageIndex === i ? (
                                <div className="w-full aspect-[9/16] bg-slate-700 flex items-center justify-center rounded-lg">
                                    <LoadingSpinner message="Generating..." />
                                </div>
                            ) : (
                                <img src={src} alt={`Ad scene ${i+1}`} className="rounded-lg w-full aspect-[9/16] object-cover" />
                            )}
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => handleRegenerateImage(i)}
                                    disabled={isBusy}
                                    className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 text-sm"
                                >
                                    {regeneratingImageIndex === i ? '...' : 'Regenerate'}
                                </button>
                                <a
                                    href={src}
                                    download={`vidabot-scene-${i + 1}.png`}
                                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm"
                                    >
                                    <DownloadIcon className="w-4 h-4" />
                                    Download
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {studio.adImages.length > 0 && (
                <div className="text-center">
                    <button onClick={handleStartVideoGeneration} disabled={isBusy} className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 transition-colors shadow-md">
                        {isLoading === 'videos' ? 'Membuat Video...' : 'Buat Video dari Adegan'}
                    </button>
                </div>
            )}
            {(isLoading === 'videos' || regeneratingVideoIndex !== null) && <LoadingSpinner message={loadingMessage} />}
            {studio.adVideos.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {studio.adVideos.map((src, i) => (
                        <div key={src+i} className="space-y-2">
                            <video src={src} controls className="rounded-lg w-full aspect-[9/16] object-cover" />
                            <button 
                                onClick={() => handleRegenerateVideo(i)}
                                disabled={isBusy}
                                className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50"
                            >
                                {regeneratingVideoIndex === i ? 'Regenerating...' : 'Regenerate Video'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
            
            {error && (
                error.includes('Lifetime quota exceeded') || error.includes('RESOURCE_EXHAUSTED') ? (
                    <div className="bg-slate-700/50 p-4 rounded-lg space-y-4 border border-amber-500/50">
                        <h3 className="font-bold text-amber-400 text-lg">Batas Pembuatan Video Tercapai</h3>
                        <p className="text-slate-300">
                            Anda telah mencapai batas pembuatan video untuk alat ini. Anda masih dapat membuat video secara manual menggunakan prompt di bawah ini dengan Vidabot VEO-3.
                        </p>
                        <div className="space-y-3">
                            {getVideoPrompts.map((prompt, index) => (
                                <div key={index} className="bg-slate-800 p-3 rounded">
                                    <div className="flex justify-between items-center gap-4">
                                        <div>
                                            <p className="font-semibold text-slate-200">Prompt Video {index + 1}:</p>
                                            <p className="text-sm text-slate-400 italic">"{prompt}"</p>
                                        </div>
                                        <button
                                            onClick={() => handleCopyPrompt(prompt, index)}
                                            className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm whitespace-nowrap shrink-0"
                                        >
                                            {copiedPromptIndex === index ? 'Copied!' : 'Copy'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                         <a 
                            href="https://vidabot.markasai.com/generate-veo3" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block text-center w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md"
                        >
                            Buat Video dengan Vidabot VEO-3
                        </a>
                    </div>
                ) : (
                    <p className="text-red-500 text-sm">{error}</p>
                )
            )}
            <div className="flex space-x-4">
                <button onClick={onBack} className="w-full bg-slate-600 hover:bg-slate-500 text-slate-200 font-bold py-3 px-4 rounded-lg transition-colors">Back</button>
                <button onClick={handleNext} disabled={studio.adVideos.length < 3 || studio.adVideos.some(v => !v)} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md disabled:opacity-50">Next</button>
            </div>
        </StepCard>
    );
};


const Step5Finishing: React.FC<{
    adVideos: string[];
    audioUrl: string;
    productName: string;
    productDescription: string;
    finalVideo: { url: string | null; extension: string };
    setFinalVideo: (video: { url: string | null; extension: string }) => void;
    onBack: () => void;
    onReset: () => void;
}> = ({ adVideos, audioUrl, productName, productDescription, finalVideo, setFinalVideo, onBack, onReset }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [captionData, setCaptionData] = useState<{ caption: string, hashtags: string } | null>(null);
    const [isCopying, setIsCopying] = useState(false);

    const combineVideosAndAudio = useCallback(async (videoUrls: string[], audioUrl:string): Promise<{ url: string, extension: string }> => {
        setLoadingMessage('Initializing render engine...');
        const canvas = document.createElement('canvas');
        const width = 720;
        const height = 1280;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error("Could not get canvas context");
    
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }
    
        setLoadingMessage('Downloading media assets...');
        const [audioBuffer, videos] = await Promise.all([
            fetch(audioUrl).then(res => res.arrayBuffer()).then(buf => audioCtx.decodeAudioData(buf)),
            Promise.all(videoUrls.map(url => new Promise<HTMLVideoElement>((resolve, reject) => {
                const video = document.createElement('video');
                video.src = url;
                video.muted = true;
                video.playsInline = true;
                video.preload = 'auto';
                video.onloadedmetadata = () => resolve(video);
                video.onerror = (e) => reject(new Error(`Failed to load video. Please try again. ${e}`));
                video.load();
            })))
        ]);
    
        const audioDestination = audioCtx.createMediaStreamDestination();
        const videoStream = canvas.captureStream(30); // 30 FPS
        const combinedStream = new MediaStream([
            videoStream.getVideoTracks()[0],
            audioDestination.stream.getAudioTracks()[0]
        ]);
    
        const mimeTypesToTry = [
            // Prioritize MP4 with common codecs for broad compatibility
            'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
            'video/mp4',
            // Fallback to WebM, which is great for browsers but less common on devices
            'video/webm; codecs="vp8, opus"',
            'video/webm',
        ];
    
        const supportedMimeType = mimeTypesToTry.find(type => MediaRecorder.isTypeSupported(type));
        if (!supportedMimeType) {
            audioCtx.close();
            throw new Error("Your browser does not support the required video recording formats.");
        }
        
        const options = { mimeType: supportedMimeType, videoBitsPerSecond: 3000000 };
        const extension = supportedMimeType.includes('webm') ? 'webm' : 'mp4';
        const recorder = new MediaRecorder(combinedStream, options);
        const chunks: Blob[] = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    
        let animationFrameId: number;
        const recorderPromise = new Promise<{ url: string, extension: string }>((resolve, reject) => {
            recorder.onstop = () => {
                cancelAnimationFrame(animationFrameId);
                audioCtx.close();
                if (chunks.length === 0) {
                    reject(new Error("Recording failed, resulting in an empty file. This can be a browser issue."));
                } else {
                    const blob = new Blob(chunks, { type: options.mimeType });
                    resolve({ url: URL.createObjectURL(blob), extension });
                }
            };
            recorder.onerror = (e) => {
                cancelAnimationFrame(animationFrameId);
                audioCtx.close();
                console.error("MediaRecorder error:", e);
                reject(new Error("A fatal error occurred during video recording."));
            };
        });
    
        // Audio source will be the master clock
        const audioSource = audioCtx.createBufferSource();
        audioSource.buffer = audioBuffer;
        audioSource.connect(audioDestination);
        audioSource.onended = () => {
            if (recorder.state === 'recording') {
                recorder.stop();
            }
        };
        
        recorder.start();
        audioSource.start(0);
    
        let currentVideoIndex = 0;
        const playNextVideo = () => {
            if (currentVideoIndex >= videos.length) {
                // All videos have been played
                return;
            }
            
            const video = videos[currentVideoIndex];
            // When one video ends, play the next
            video.onended = () => {
                currentVideoIndex++;
                setLoadingMessage(`Rendering scene ${Math.min(currentVideoIndex + 1, videos.length)}/${videos.length}...`);
                playNextVideo();
            };
            
            video.currentTime = 0;
            video.play().catch(e => {
                console.error(`Video ${currentVideoIndex} failed to play`, e);
                if (recorder.state === 'recording') recorder.stop(); // Stop on error
            });
        };
        
        const renderLoop = () => {
            // Determine which video to draw
            const videoToDraw = videos[currentVideoIndex] || videos[videos.length - 1];
            if (videoToDraw) {
                ctx.drawImage(videoToDraw, 0, 0, width, height);
            }
            animationFrameId = requestAnimationFrame(renderLoop);
        };
    
        setLoadingMessage(`Rendering scene 1/${videos.length}...`);
        playNextVideo(); // Start the video playback chain
        animationFrameId = requestAnimationFrame(renderLoop); // Start the rendering loop
        
        return recorderPromise;
    }, []);

    const handleCombine = useCallback(async () => {
        if (finalVideo.url || isLoading) return;

        setIsLoading(true);
        setError(null);
        setFinalVideo({ url: null, extension: 'mp4' });
        try {
            const finalVideoData = await combineVideosAndAudio(adVideos, audioUrl);
            setFinalVideo(finalVideoData);
            setLoadingMessage('Membuat caption & hashtag...');
            const captions = await generateCaptionAndHashtags(productName, productDescription);
            setCaptionData(captions);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal menggabungkan video dan audio.");
        } finally {
            setIsLoading(false);
        }
    }, [adVideos, audioUrl, setFinalVideo, combineVideosAndAudio, finalVideo.url, isLoading, productName, productDescription]);
    
    useEffect(() => {
        handleCombine();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCopy = () => {
        if (!captionData) return;
        const textToCopy = `${captionData.caption}\n\n${captionData.hashtags}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            setIsCopying(true);
            setTimeout(() => setIsCopying(false), 2000);
        });
    };

    const handleDownload = () => {
        if (!finalVideo.url || !captionData) return;
    
        const textContent = `${captionData.caption}\n\n${captionData.hashtags}`;
        const textBlob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const textUrl = URL.createObjectURL(textBlob);
        const textLink = document.createElement('a');
        textLink.href = textUrl;
        textLink.download = 'vidabot-caption.txt';
        document.body.appendChild(textLink);
        textLink.click();
        document.body.removeChild(textLink);
        URL.revokeObjectURL(textUrl);
    
        const videoLink = document.createElement('a');
        videoLink.href = finalVideo.url;
        videoLink.download = `vidabot-ad.${finalVideo.extension}`;
        document.body.appendChild(videoLink);
        videoLink.click();
        document.body.removeChild(videoLink);
    };

    return (
        <StepCard title="Step 5: Finishing">
            {isLoading && <LoadingSpinner message={loadingMessage || "Processing..."} />}

            {!isLoading && finalVideo.url && (
                <div className="space-y-6">
                    <h3 className="text-center font-bold text-lg text-green-400">Video Iklan Anda Sudah Siap!</h3>
                    <video src={finalVideo.url} controls className="rounded-lg w-full max-w-sm mx-auto aspect-[9/16] object-cover" />
                    
                    {captionData && (
                        <div className="space-y-4">
                             <div className="bg-slate-700/50 rounded-lg p-4 space-y-2">
                                <p className="text-slate-300 whitespace-pre-wrap">{captionData.caption}</p>
                                <p className="text-orange-400 font-semibold">{captionData.hashtags}</p>
                            </div>
                            <button onClick={handleCopy} className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg">
                                {isCopying ? 'Copied!' : 'Copy Caption & Hashtags'}
                            </button>
                        </div>
                    )}

                    <div className="text-center">
                         <button onClick={handleDownload} className="inline-flex items-center justify-center bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md">
                            Simpan Video & Caption
                        </button>
                    </div>
                </div>
            )}
            
            {!isLoading && !finalVideo.url && !error && (
                 <div className="text-center">
                    <p className="text-slate-400">Mempersiapkan video final Anda...</p>
                 </div>
            )}

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <div className="flex space-x-4 pt-4 border-t border-slate-700">
                <button onClick={onBack} className="w-1/2 bg-slate-600 hover:bg-slate-500 text-slate-200 font-bold py-3 px-4 rounded-lg transition-colors">Back</button>
                <button onClick={onReset} className="w-1/2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">Buat Video Lagi</button>
            </div>
        </StepCard>
    );
};


// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
    const initialProductState = { name: '', description: '', image: null };
    const initialModelState = { source: 'ai' as 'manual' | 'ai', image: null, description: '' };
    const initialAdsCopyState = { script: '', audioUrl: null, voiceGender: 'female' as 'male' | 'female', voiceStyle: 'santai' };
    const initialStudioState = { adImages: [], adVideos: [] };
    const initialFinalVideoState = { url: null, extension: 'mp4' };

    const [currentStep, setCurrentStep] = useState(1);
    const [product, setProduct] = useState<{ name: string; description: string; image: ImageFile | null }>(initialProductState);
    const [model, setModel] = useState<{ source: 'manual' | 'ai'; image: ImageFile | null; description: string; }>(initialModelState);
    const [adsCopy, setAdsCopy] = useState<{ script: string; audioUrl: string | null; voiceGender: 'male' | 'female'; voiceStyle: string; }>(initialAdsCopyState);
    const [studio, setStudio] = useState<{ adImages: string[]; adVideos: string[] }>(initialStudioState);
    const [finalVideo, setFinalVideo] = useState<{ url: string | null; extension: string; }>(initialFinalVideoState);

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 5));
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
    const resetState = () => {
        setProduct(initialProductState);
        setModel(initialModelState);
        setAdsCopy(initialAdsCopyState);
        setStudio(initialStudioState);
        setFinalVideo(initialFinalVideoState);
        setCurrentStep(1);
    };

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 1:
                return <Step1Product product={product} setProduct={setProduct} onNext={nextStep} />;
            case 2:
                if (!product.image) {
                    setCurrentStep(1);
                    return null;
                }
                return <Step2Model
                    productImage={product.image}
                    productName={product.name}
                    productDescription={product.description}
                    model={model}
                    setModel={setModel}
                    onNext={nextStep}
                    onBack={prevStep}
                />;
            case 3:
                if (!model.image) {
                    setCurrentStep(2);
                    return null;
                }
                return <Step3AdsCopy
                    productName={product.name}
                    productDescription={product.description}
                    modelImage={model.image}
                    adsCopy={adsCopy}
                    setAdsCopy={setAdsCopy}
                    onNext={nextStep}
                    onBack={prevStep}
                />;
            case 4:
                if (!model.image || !product.image || !adsCopy.script) {
                    setCurrentStep(3);
                    return null;
                }
                return <Step4Studio
                    modelImage={model.image}
                    productImage={product.image}
                    productName={product.name}
                    productDescription={product.description}
                    adsCopyScript={adsCopy.script}
                    studio={studio}
                    setStudio={setStudio}
                    onNext={nextStep}
                    onBack={prevStep}
                />;
            case 5:
                 if (studio.adVideos.length < 3 || !adsCopy.audioUrl) {
                    setCurrentStep(4);
                    return null;
                }
                return <Step5Finishing
                    adVideos={studio.adVideos}
                    audioUrl={adsCopy.audioUrl}
                    productName={product.name}
                    productDescription={product.description}
                    finalVideo={finalVideo}
                    setFinalVideo={setFinalVideo}
                    onBack={prevStep}
                    onReset={resetState}
                />;
            default:
                return <Step1Product product={product} setProduct={setProduct} onNext={nextStep} />;
        }
    };
    
    const renderContent = () => {
        // License gating removed: always render app flow
        return (
            <>
                <Stepper currentStep={currentStep} />
                {renderCurrentStep()}
            </>
        )
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-900">
            <Header />
            <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                <div className="max-w-2xl mx-auto">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

export default App;