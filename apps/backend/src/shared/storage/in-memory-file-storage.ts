import { computeSha256 } from './file-hash.js';
import type { FileStorage, StoredFileInfo, UploadFileInput } from './file-storage.js';

interface StoredFileRecord {
  readonly info: StoredFileInfo;
  readonly content: Buffer;
}

/**
 * Adaptador en memoria del puerto FileStorage (RS-072, RNF-013, RNF-033).
 *
 * Permite a los casos de uso y pruebas subir, consultar URLs y eliminar archivos
 * sin depender de Cloudinary ni servicios externos.
 */
export class InMemoryFileStorage implements FileStorage {
  private readonly _files = new Map<string, StoredFileRecord>();
  private _counter = 0;

  async upload(input: UploadFileInput): Promise<StoredFileInfo> {
    this._counter += 1;
    const filename = `file-${this._counter}`;
    const publicId = input.folder ? `${input.folder}/${filename}` : filename;
    const sha256 = computeSha256(input.content);
    const url = `memory://${publicId}`;

    const info: StoredFileInfo = {
      provider: 'in-memory',
      publicId,
      url,
      mimeType: input.mimeType,
      sizeBytes: input.content.length,
      sha256,
    };

    this._files.set(publicId, {
      info: { ...info },
      content: Buffer.from(input.content),
    });

    return { ...info };
  }

  getUrl(publicId: string): string {
    return `memory://${publicId}`;
  }

  async delete(publicId: string): Promise<void> {
    this._files.delete(publicId);
  }

  /**
   * Obtiene el contenido binario almacenado para un publicId (solo para assertions de prueba).
   */
  getFile(publicId: string): Buffer | undefined {
    const record = this._files.get(publicId);
    return record ? Buffer.from(record.content) : undefined;
  }

  /**
   * Verifica si existe un archivo con el publicId dado.
   */
  hasFile(publicId: string): boolean {
    return this._files.has(publicId);
  }

  /**
   * Cantidad total de archivos almacenados.
   */
  get size(): number {
    return this._files.size;
  }

  /**
   * Limpia todos los archivos en memoria y reinicia el contador.
   */
  clear(): void {
    this._files.clear();
    this._counter = 0;
  }
}
