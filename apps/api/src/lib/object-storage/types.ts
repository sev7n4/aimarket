export type StoredObject = {
  key: string;
  url: string;
  sizeBytes: number;
};

export interface ObjectStorage {
  name: string;
  put(
    buffer: Buffer,
    mimeType: string,
    originalName: string,
  ): Promise<StoredObject>;
}
