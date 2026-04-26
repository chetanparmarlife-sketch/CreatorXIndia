import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { createMobileApiClient } from "./queryClient";

const MAX_IMAGE_DIMENSION = 2000;

export interface PickAndUploadImageConfig {
  type: "avatar" | "deliverable" | "kyc";
  campaignId?: string;
  onProgress?: (pct: number) => void;
}

interface UploadableImage {
  uri: string;
  width: number;
  height: number;
}

function reportProgress(config: PickAndUploadImageConfig, pct: number): void {
  config.onProgress?.(pct);
}

function resizeAction(width: number, height: number): ImageManipulator.ActionResize | null {
  if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) return null;
  if (width >= height) return { resize: { width: MAX_IMAGE_DIMENSION } };
  return { resize: { height: MAX_IMAGE_DIMENSION } };
}

async function resizedImageIfNeeded(image: UploadableImage): Promise<UploadableImage> {
  const action = resizeAction(image.width, image.height);

  const resized = await ImageManipulator.manipulateAsync(
    image.uri,
    action ? [action] : [],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );

  return {
    uri: resized.uri,
    width: resized.width,
    height: resized.height,
  };
}

async function blobFromUri(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error("Could not read selected image");
  }
  return response.blob();
}

export async function pickAndUploadImage(config: PickAndUploadImageConfig): Promise<string | null> {
  reportProgress(config, 0);

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.8,
    base64: false,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset) return null;

  reportProgress(config, 15);

  const resized = await resizedImageIfNeeded({
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
  });

  reportProgress(config, 35);

  const api = createMobileApiClient();
  const filename = `${Date.now()}.jpg`;
  const presign = await api.creator.presignUpload({
    type: config.type,
    filename,
    ...(config.campaignId ? { campaignId: config.campaignId } : {}),
  });

  reportProgress(config, 55);

  const imageBlob = await blobFromUri(resized.uri);
  const uploadResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "image/jpeg",
    },
    body: imageBlob,
  });

  if (!uploadResponse.ok) {
    throw new Error("Image upload failed");
  }

  reportProgress(config, 100);

  if (config.type === "kyc") {
    if (!presign.uploadKey) throw new Error("KYC upload key missing");
    return presign.uploadKey;
  }

  if (!presign.publicUrl) throw new Error("Public upload URL missing");
  return presign.publicUrl;
}
