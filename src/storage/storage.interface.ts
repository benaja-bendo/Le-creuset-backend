import { Readable } from 'stream';

/**
 * Interface abstraite pour les drivers de stockage.
 * Permet de basculer entre stockage local et MinIO via configuration.
 */
export interface IStorageDriver {
  /**
   * Upload un fichier
   */
  uploadFile(
    objectName: string,
    data: Buffer | Readable,
    size: number,
    mimeType: string,
  ): Promise<UploadResult>;

  /**
   * Télécharge un fichier
   */
  downloadFile(objectName: string): Promise<Readable>;

  /**
   * Supprime un fichier
   */
  deleteFile(objectName: string): Promise<void>;

  /**
   * Vérifie si un fichier existe
   */
  fileExists(objectName: string): Promise<boolean>;

  /**
   * Récupère les métadonnées d'un fichier
   */
  getFileStats(objectName: string): Promise<FileStats>;

  /**
   * Génère une URL présignée pour l'accès au fichier (optionnel, retourne null si non supporté)
   */
  getPresignedUrl?(objectName: string, expirySeconds?: number): Promise<string>;
}

export interface UploadResult {
  storagePath: string;
  etag?: string;
  size: number;
}

export interface FileStats {
  size: number;
  mimeType: string;
  lastModified?: Date;
}

export const STORAGE_DRIVER = 'STORAGE_DRIVER';
