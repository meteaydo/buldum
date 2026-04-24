import localforage from 'localforage';
import { useTeacherStore } from '../store/teacherStore';
import type { TeacherScheduleData } from '../store/teacherStore';
import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const SCHEDULE_KEY = 'teacher-schedules/program.json';
const ETAG_STORAGE_KEY = 'etag_teacher_schedule';

let s3Client: S3Client | null = null;

const getS3Client = (): S3Client | null => {
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

/**
 * R2 erişilemezken public/program.json'dan yedek yükleme yapar.
 * Development ve ilk test senaryosu için kullanılır.
 */
async function loadFromPublicFallback(
  onProgress?: (msg: string) => void
): Promise<void> {
  try {
    if (onProgress) onProgress('Öğretmen programı yükleniyor...');
    const response = await fetch('/program.json');
    if (!response.ok) {
      console.warn('public/program.json bulunamadı, atlanıyor.');
      return;
    }
    const scheduleData: TeacherScheduleData = await response.json();
    useTeacherStore.getState().setScheduleData(scheduleData);
  } catch (error) {
    console.error('[Fallback] Öğretmen programı yüklenemedi:', error);
  }
}

/**
 * R2'den öğretmen ders programı JSON'ını senkronize eder.
 * ETag mekanizması ile yalnızca değişiklik varsa indirir.
 */
export const syncTeacherSchedule = async (
  onProgress?: (msg: string) => void
): Promise<void> => {
  const client = getS3Client();
  const bucketName = import.meta.env.VITE_R2_BUCKET_NAME;

  // Store'da zaten veri varsa ve R2 erişilemezse tekrar yüklemeye gerek yok
  const existingData = useTeacherStore.getState().scheduleData;

  if (!client || !bucketName) {
    // R2 yapılandırması yoksa, public/program.json'dan fallback yükle
    if (!existingData) {
      await loadFromPublicFallback(onProgress);
    }
    return;
  }

  try {
    const cachedETag = await localforage.getItem<string>(ETAG_STORAGE_KEY);

    // HEAD isteği ile dosyanın ETag'ini kontrol et
    let headResult;
    try {
      headResult = await client.send(new HeadObjectCommand({
        Bucket: bucketName,
        Key: SCHEDULE_KEY,
      }));
    } catch (err: unknown) {
      const error = err as { name?: string };
      if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
        console.log('Öğretmen programı R2\'de bulunamadı.');
      }
      // R2'de bulunamadıysa ve store'da da veri yoksa fallback'e düş
      if (!existingData) {
        await loadFromPublicFallback(onProgress);
      }
      return;
    }

    const currentETag = headResult.ETag?.replace(/"/g, '');

    // ETag değişmemişse atla
    if (currentETag && cachedETag === currentETag) {
      return;
    }

    // Dosyayı indir
    if (onProgress) onProgress('Öğretmen programı güncelleniyor...');

    const getResult = await client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: SCHEDULE_KEY,
    }));

    const byteArray = await getResult.Body?.transformToByteArray();
    if (!byteArray) throw new Error('Öğretmen programı dosya içeriği okunamadı');

    // JSON olarak parse et
    const decoder = new TextDecoder('utf-8');
    const jsonText = decoder.decode(byteArray);
    const scheduleData: TeacherScheduleData = JSON.parse(jsonText);

    // Store'a kaydet
    useTeacherStore.getState().setScheduleData(scheduleData);

    // Yeni ETag'i kaydet
    if (currentETag) {
      await localforage.setItem(ETAG_STORAGE_KEY, currentETag);
    }
  } catch (error) {
    console.error('[Sync Hata] Öğretmen programı işlenemedi:', error);
    // Genel hata durumunda da fallback'e düş
    if (!existingData) {
      await loadFromPublicFallback(onProgress);
    }
  }
};
