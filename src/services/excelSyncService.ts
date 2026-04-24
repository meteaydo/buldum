import localforage from 'localforage';
import { useStudentStore } from '../store/studentStore';
import { parseClassList } from '../lib/excelStudentParser';
import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

export const CLASS_LISTS = [
  '9A.xlsx', '9B.xlsx', '9C.xlsx', '9D.xlsx', '9E.xlsx', '9F.xlsx', '9G.xlsx',
  '10A.xlsx', '10B.xlsx', '10C.xlsx', '10D.xlsx', '10E.xlsx', '10F.xlsx', '10G.xlsx',
  '11A.xlsx', '11B.xlsx', '11C.xlsx', '11E.xlsx', '11F.xlsx',
  '12A.xlsx', '12B.xlsx', '12C.xlsx', '12D.xlsx', '12E.xlsx', '12F.xlsx', '12G.xlsx'
];

let s3Client: S3Client | null = null;

const getS3Client = () => {
  if (s3Client) return s3Client;
  const accountId = import.meta.env.VITE_R2_ACCOUNT_ID;
  const accessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID;
  const secretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) return null;

  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
  return s3Client;
};

export const syncExcelFiles = async (
  onProgress?: (msg: string) => void
) => {
  const client = getS3Client();
  const bucketName = import.meta.env.VITE_R2_BUCKET_NAME;

  if (!client || !bucketName) {
    console.warn('R2 S3 API kimlik bilgileri (.env) tam değil. Senkronizasyon atlandı.');
    return;
  }

  if (onProgress) onProgress('Güncellemeler denetleniyor...');

  const syncPromises = CLASS_LISTS.map(async (fileName) => {
    try {
      const eTagKey = `etag_${fileName}`;
      const cachedETag = await localforage.getItem<string>(eTagKey);

      // HEAD isteği ile dosyanın ETag'ini kontrol et
      let headResult;
      const objectKey = `class-templates/${fileName}`;
      try {
        headResult = await client.send(new HeadObjectCommand({
          Bucket: bucketName,
          Key: objectKey
        }));
      } catch (err: any) {
        if (err.name === 'NotFound' || err.name === 'NoSuchKey') {
           console.log(`${objectKey} bulunamadı, atlanıyor.`);
        }
        return false; // güncellenmedi
      }

      const currentETag = headResult.ETag?.replace(/"/g, '');

      // ETag değişmemişse atla
      if (currentETag && cachedETag === currentETag) {
        return false;
      }

      // Dosyayı indir
      if (onProgress) onProgress(`${fileName} indiriliyor ve işleniyor...`);
      const getResult = await client.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey
      }));

      // R2'den gelen veriyi Blob'a çevir
      const byteArray = await getResult.Body?.transformToByteArray();
      if (!byteArray) throw new Error("Dosya içeriği okunamadı");
      
      const blob = new Blob([byteArray]);
      const file = new File([blob], fileName, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Excel'i parse et ve Store'a kaydet
      const parsedStudents = await parseClassList(file);
      useStudentStore.getState().upsertStudents(parsedStudents);

      // Yeni ETag'i kaydet
      if (currentETag) {
        await localforage.setItem(eTagKey, currentETag);
      }
      
      return true; // güncellendi
    } catch (error) {
      console.error(`[Sync Hata] ${fileName} işlenemedi:`, error);
      return false;
    }
  });

  const results = await Promise.all(syncPromises);
  const updatedCount = results.filter(Boolean).length;

  if (onProgress) {
    onProgress(updatedCount > 0 ? `${updatedCount} liste güncellendi.` : 'Tüm listeler güncel.');
  }
};
