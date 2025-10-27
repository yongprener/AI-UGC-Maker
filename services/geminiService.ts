import { GoogleGenAI, Modality } from "@google/genai";
import type { ImageFile } from '../types';
import { processAudio } from './audioService';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

type ImageData = {
    data: string;
    mimeType: string;
}

const extractImageUrl = (response: any): string => {
    if (response.promptFeedback?.blockReason) {
        throw new Error(`Request was blocked: ${response.promptFeedback.blockReason}`);
    }
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
        throw new Error("Invalid response from the model. No content parts found.");
    }
    for (const part of candidate.content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            const mimeType = part.inlineData.mimeType;
            return `data:${mimeType};base64,${base64ImageBytes}`;
        }
    }
    const textResponse = candidate.content.parts.find((p: any) => p.text)?.text;
    if (textResponse) {
        console.error("Model returned text instead of an image:", textResponse);
        throw new Error(`The model returned a text response but no image.`);
    }
    throw new Error("No image was generated in the response.");
};

export const generateModelImage = async (productImage: ImageData, productName: string, productDescription: string, modelDescription?: string): Promise<string> => {
    try {
        const modelPrompt = modelDescription
            ? modelDescription
            : "a friendly, relatable, and appealing model for a young audience.";

        const textPart = { text: `Based on this product (Product Name: "${productName}", Description: "${productDescription}"), generate a single, photorealistic, portrait-style (9:16) image. The image should feature: ${modelPrompt}. The background should be a simple, clean studio setting. IMPORTANT: The image must NOT contain any text, letters, or logos.` };
        const imagePart = { inlineData: { data: productImage.data, mimeType: productImage.mimeType } };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        return extractImageUrl(response);
    } catch (error) {
        console.error("Error generating model image:", error);
        if (error instanceof Error) throw error;
        throw new Error("An unknown error occurred while generating the model image.");
    }
};

export const determineModelGender = async (modelImage: ImageData): Promise<'male' | 'female'> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { data: modelImage.data, mimeType: modelImage.mimeType } },
                    { text: "Analyze the person in this image. Is the person male or female? Respond with only the word 'male' or 'female', with no other text or punctuation." }
                ]
            },
        });
        const gender = response.text.trim().toLowerCase();
        if (gender === 'male') {
            return 'male';
        }
        // Default to female if detection fails or returns something else
        return 'female';
    } catch (error) {
        console.error("Error determining model gender:", error);
        return 'female'; // Default on error
    }
};

export const generateAdsCopy = async (productName: string, productDescription: string): Promise<string> => {
    try {
        const prompt = `Create a short ad script for a TikTok video about "${productName}". The product is: "${productDescription}". The script must be in Indonesian. The tone must be casual and engaging, like a friendly influencer. The script's total word count must be between 50 and 60 words. This is a strict requirement to keep the speaking duration under 24 seconds. Structure it like this:
1.  A compelling hook (first ~3 seconds).
2.  A fun description of the product's benefits.
3.  A clear call to action at the end (e.g., "klik keranjang kuning ya!").
Respond with only the script text, without any labels like "Hook:" or "CTA:".`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error generating ads copy:", error);
        if (error instanceof Error) throw error;
        throw new Error("An unknown error occurred while generating the ads copy.");
    }
};

export const generateSpeech = async (
    text: string,
    voiceName: string,
    style: string,
    onProgress: (message: string) => void
): Promise<string> => {
    try {
        const language = 'id-ID';
        onProgress("Giving directions to the AI Actor...");

        const languageNames: { [key: string]: string } = { "id-ID": "Indonesia" };
        const stylePrompts: { [key: string]: (text: string, langName: string) => string } = {
            santai: (text, langName) => `Say this casually in ${langName} with a relaxed, easygoing vibe: "${text}"`,
            enerjik: (text, langName) => `Say this enthusiastically in ${langName} with an upbeat and energetic tone, perfect for an exciting ad: "${text}"`,
            profesional: (text, langName) => `Say this clearly and confidently in ${langName} with a professional and trustworthy tone: "${text}"`,
        };

        const langName = languageNames[language] || language;
        const promptFn = stylePrompts[style] || stylePrompts.santai;
        let finalPrompt = promptFn(text, langName);

        onProgress("Recording session in progress...");
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: { parts: [{ text: finalPrompt }] },
            config: {
                // @ts-ignore
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName }
                    }
                }
            }
        });

        const candidate = response.candidates?.[0];
        const part = candidate?.content?.parts?.[0];
        const audioData = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType;

        if (!audioData || !mimeType?.startsWith("audio/")) {
            throw new Error("Invalid audio data received from the API.");
        }

        onProgress("Mixing and mastering audio...");
        const audioUrl = await processAudio(audioData, mimeType, style, voiceName);
        onProgress("Finished!");
        return audioUrl;

    } catch (error) {
        console.error("Error generating speech:", error);
        if (error instanceof Error) throw new Error(`Failed to generate audio: ${error.message}`);
        throw new Error("An unknown error occurred while generating the audio.");
    }
};

export const generateAdImages = async (modelImage: ImageData, productImage: ImageData, adScript: string, productName: string, productDescription: string): Promise<string[]> => {
    try {
        const prompts = [
            `Generate a photorealistic, 9:16 UGC-style image of the **exact same person** from the model image, wearing the **exact same outfit**. The model is holding the **exact same product** ("${productName}") for the first time, looking excited and curious. This shot should match the ad script's hook: "${adScript}". The setting must be a realistic, everyday environment. IMPORTANT: The product MUST be clearly visible and held by the model. No text/logos. Person, outfit, and product must be identical to the inputs.`,
            `Generate the second ad frame, a photorealistic, 9:16 UGC-style image. The **exact same person** (in the **same outfit**) is now actively **using, wearing, or consuming** the **exact same product** ("${productName}"). Their face should show genuine happiness and satisfaction, illustrating the product's benefits from the ad script: "${adScript}". The focus is on the positive experience of the model using the product. The setting must be logical for the product's use. IMPORTANT: No text/logos. Person, outfit, and product must be identical.`,
            `Generate the final ad frame, a photorealistic, 9:16 UGC-style image. The **exact same person** (in the **same outfit**) is happily holding and showing the **exact same product** ("${productName}") towards the camera, as if recommending it to a friend. They should look confident and satisfied, matching the call-to-action part of the script: "${adScript}". The product is the hero of the shot. IMPORTANT: No text/logos. Person, outfit, and product must be identical.`
        ];


        const imageGenerationPromises = prompts.map(async (prompt) => {
            const modelImagePart = { inlineData: { data: modelImage.data, mimeType: modelImage.mimeType } };
            const productImagePart = { inlineData: { data: productImage.data, mimeType: productImage.mimeType } };
            const textPart = { text: prompt };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [modelImagePart, productImagePart, textPart] },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            return extractImageUrl(response);
        });

        return await Promise.all(imageGenerationPromises);
    } catch (error) {
        console.error("Error generating ad images:", error);
        if (error instanceof Error) throw error;
        throw new Error("An unknown error occurred while generating ad images.");
    }
};

export const regenerateAdImage = async (
    modelImage: ImageData,
    productImage: ImageData,
    prompt: string
): Promise<string> => {
     try {
        const modelImagePart = { inlineData: { data: modelImage.data, mimeType: modelImage.mimeType } };
        const productImagePart = { inlineData: { data: productImage.data, mimeType: productImage.mimeType } };
        const textPart = { text: prompt };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [modelImagePart, productImagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        return extractImageUrl(response);
    } catch (error) {
        console.error("Error regenerating ad image:", error);
        if (error instanceof Error) throw error;
        throw new Error("An unknown error occurred while regenerating ad image.");
    }
};


export const generateVideo = async (
    prompt: string,
    image: ImageData,
    onProgress: (message: string) => void
): Promise<string> => {
    try {
        onProgress("Initiating video generation...");

        let operation = await ai.models.generateVideos({
            model: 'veo-2.0-generate-001',
            prompt: prompt,
            image: {
                imageBytes: image.data,
                mimeType: image.mimeType,
            },
            config: {
                numberOfVideos: 1,
                aspectRatio: '9:16',
            }
        });

        onProgress("Processing video... this may take a few minutes.");

        const messages = [
            "Analyzing prompt and image...",
            "Composing video frames...",
            "Rendering video, this can take a while...",
            "Almost there...",
            "Finalizing the video..."
        ];
        let pollCount = 0;

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            onProgress(messages[pollCount % messages.length]);
            pollCount++;
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        if (operation.error) {
            throw new Error(`Video generation failed: ${operation.error.message}`);
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

        if (!downloadLink) {
            throw new Error("Video generation completed, but no download link was found.");
        }

        onProgress("Downloading generated video...");

        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.statusText}`);
        }

        const videoBlob = await videoResponse.blob();
        return URL.createObjectURL(videoBlob);

    } catch (error) {
        console.error("Error generating video:", error);
        if (error instanceof Error) throw new Error(`Failed to generate video: ${error.message}`);
        throw new Error("An unknown error occurred while generating the video.");
    }
};

export const generateCaptionAndHashtags = async (productName: string, productDescription: string): Promise<{ caption: string, hashtags: string }> => {
    try {
        const prompt = `Based on the product "${productName}" (Description: "${productDescription}"), create content for a TikTok post in Indonesian.
1.  **Caption:** A short, catchy, and engaging caption (max 150 characters) that creates curiosity and encourages comments.
2.  **Hashtags:** Exactly 5 hashtags. Mix relevant product keywords with currently trending but related hashtags to maximize reach and viral potential.

Format the output as follows, with no extra text or explanation:
Caption: [Your caption here]
Hashtags: [Your hashtags here]`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const text = response.text;
        const captionMatch = text.match(/Caption: (.*)/);
        const hashtagsMatch = text.match(/Hashtags: (.*)/);

        const caption = captionMatch ? captionMatch[1].trim() : "Check this out!";
        const hashtags = hashtagsMatch ? hashtagsMatch[1].trim() : "#fyp #racuntiktok";

        return { caption, hashtags };
    } catch (error) {
        console.error("Error generating caption and hashtags:", error);
        return {
            caption: `Wajib coba ${productName}! ✨`,
            hashtags: "#fyp #racuntiktok #productreview #xyzbca #tiktokmademebuyit"
        };
    }
};